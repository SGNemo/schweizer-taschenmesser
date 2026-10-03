use crate::kinds::{FileKind, KIND_COUNT};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const NO_PARENT: u32 = u32::MAX;
/// Upper bound of nodes handed to the webview per request; keeps the IPC payload small.
const MAX_VIEWS: usize = 20_000;
const MAX_QUERY: usize = 500;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeKind {
    Dir,
    File,
    /// All files of one folder below the size threshold, folded into one entry.
    Small,
}

struct Node {
    parent: u32,
    name: String,
    kind: NodeKind,
    /// Space used on the volume (rounded to clusters); the main measure.
    bytes: u64,
    /// Plain file size; differs from `bytes` for cluster rounding, sparse files, cloud placeholders.
    logical: u64,
    files: u64,
    /// Newest modification (Unix seconds) in the subtree.
    modified: i64,
    kind_bytes: [u64; KIND_COUNT],
    children: Vec<u32>,
    /// Deleted (or inside a deleted folder) after the scan; hidden from every query.
    removed: bool,
}

/// What the scanner collects per folder before the arena is built (lock-free, bottom-up).
#[derive(Default)]
pub(crate) struct DirTemp {
    pub name: String,
    pub modified: i64,
    pub dirs: Vec<DirTemp>,
    pub files: Vec<FileTemp>,
    pub small: SmallAgg,
}

pub(crate) struct FileTemp {
    pub name: String,
    pub bytes: u64,
    pub logical: u64,
    pub modified: i64,
}

#[derive(Default)]
pub(crate) struct SmallAgg {
    pub count: u64,
    pub bytes: u64,
    pub logical: u64,
    pub modified: i64,
    pub kind_bytes: [u64; KIND_COUNT],
}

/// A node as the webview sees it. `id` is only meaningful for the scan it came from.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeView {
    pub id: u32,
    pub parent_id: Option<u32>,
    pub name: String,
    pub kind: NodeKind,
    pub bytes: u64,
    pub logical_bytes: u64,
    pub files: u64,
    pub modified: i64,
    /// Dominant file type by bytes.
    pub file_kind: FileKind,
    pub kind_bytes: [u64; KIND_COUNT],
    pub child_count: u32,
    /// Path relative to the scan root (OS separator; empty for the root). Only filled in
    /// query results, where the caller needs to show where an entry lives.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub rel_path: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QueryScope {
    Dirs,
    Files,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub scope: QueryScope,
    /// Restrict to the subtree below this node (default: whole scan).
    pub under: Option<u32>,
    /// Only nodes whose newest change is older than this Unix time.
    pub older_than: Option<i64>,
    /// Only this file type (folders rank by the bytes of this type).
    pub file_kind: Option<FileKind>,
    pub min_bytes: Option<u64>,
    pub limit: Option<usize>,
    /// Folders without any file (own or nested); ranked by name. Folders only.
    #[serde(default)]
    pub only_empty: bool,
}

pub struct Tree {
    nodes: Vec<Node>,
    root: PathBuf,
}

fn dominant(kind_bytes: &[u64; KIND_COUNT]) -> FileKind {
    let mut best = FileKind::Other;
    let mut max = 0;
    for k in FileKind::ALL {
        if kind_bytes[k.index()] > max {
            max = kind_bytes[k.index()];
            best = k;
        }
    }
    best
}

impl Tree {
    pub(crate) fn from_temp(root: PathBuf, temp: DirTemp) -> Tree {
        let mut tree = Tree {
            nodes: Vec::new(),
            root,
        };
        tree.add_dir(NO_PARENT, temp);
        tree
    }

    fn add_dir(&mut self, parent: u32, dir: DirTemp) -> u32 {
        let id = self.nodes.len() as u32;
        self.nodes.push(Node {
            parent,
            name: dir.name,
            kind: NodeKind::Dir,
            bytes: 0,
            logical: 0,
            files: 0,
            modified: dir.modified,
            kind_bytes: [0; KIND_COUNT],
            children: Vec::new(),
            removed: false,
        });
        let mut children = Vec::new();
        for child in dir.dirs {
            children.push(self.add_dir(id, child));
        }
        for f in dir.files {
            let fid = self.nodes.len() as u32;
            let mut kind_bytes = [0; KIND_COUNT];
            kind_bytes[crate::kinds::classify(&f.name).index()] = f.bytes;
            self.nodes.push(Node {
                parent: id,
                name: f.name,
                kind: NodeKind::File,
                bytes: f.bytes,
                logical: f.logical,
                files: 1,
                modified: f.modified,
                kind_bytes,
                children: Vec::new(),
                removed: false,
            });
            children.push(fid);
        }
        if dir.small.count > 0 {
            let sid = self.nodes.len() as u32;
            self.nodes.push(Node {
                parent: id,
                name: String::new(),
                kind: NodeKind::Small,
                bytes: dir.small.bytes,
                logical: dir.small.logical,
                files: dir.small.count,
                modified: dir.small.modified,
                kind_bytes: dir.small.kind_bytes,
                children: Vec::new(),
                removed: false,
            });
            children.push(sid);
        }
        let (mut bytes, mut logical, mut files, mut modified) =
            (0, 0, 0, self.nodes[id as usize].modified);
        let mut kind_bytes = [0; KIND_COUNT];
        for &c in &children {
            let n = &self.nodes[c as usize];
            bytes += n.bytes;
            logical += n.logical;
            files += n.files;
            modified = modified.max(n.modified);
            for i in 0..KIND_COUNT {
                kind_bytes[i] += n.kind_bytes[i];
            }
        }
        let n = &mut self.nodes[id as usize];
        n.bytes = bytes;
        n.logical = logical;
        n.files = files;
        n.modified = modified;
        n.kind_bytes = kind_bytes;
        n.children = children;
        id
    }

    pub fn root_id(&self) -> u32 {
        0
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    fn make_view(&self, id: u32) -> NodeView {
        let n = &self.nodes[id as usize];
        NodeView {
            id,
            parent_id: (n.parent != NO_PARENT).then_some(n.parent),
            name: if id == 0 {
                self.root.to_string_lossy().into_owned()
            } else {
                n.name.clone()
            },
            kind: n.kind,
            bytes: n.bytes,
            logical_bytes: n.logical,
            files: n.files,
            modified: n.modified,
            file_kind: dominant(&n.kind_bytes),
            kind_bytes: n.kind_bytes,
            child_count: n.children.len() as u32,
            rel_path: String::new(),
        }
    }

    /// Parent folder of `id` relative to the scan root (aggregates: their folder).
    fn parent_rel_path(&self, id: u32) -> String {
        let mut names = Vec::new();
        let mut cur = self.nodes[id as usize].parent;
        while cur != NO_PARENT && cur != 0 {
            names.push(self.nodes[cur as usize].name.as_str());
            cur = self.nodes[cur as usize].parent;
        }
        names.reverse();
        names.join(std::path::MAIN_SEPARATOR_STR)
    }

    pub fn view(&self, id: u32) -> Option<NodeView> {
        self.nodes
            .get(id as usize)
            .filter(|n| !n.removed)
            .map(|_| self.make_view(id))
    }

    /// Descendants of `id` down to `depth` levels (breadth first), biggest first within a parent,
    /// skipping everything smaller than `min_bytes`. Capped so a huge folder cannot flood the IPC.
    pub fn children(&self, id: u32, depth: u32, min_bytes: u64) -> Vec<NodeView> {
        let mut out = Vec::new();
        if self.nodes.get(id as usize).is_none_or(|n| n.removed) {
            return out;
        }
        let mut level = vec![id];
        for _ in 0..depth {
            let mut next = Vec::new();
            for &p in &level {
                let mut kids: Vec<u32> = self.nodes[p as usize]
                    .children
                    .iter()
                    .copied()
                    .filter(|&c| self.nodes[c as usize].bytes >= min_bytes)
                    .collect();
                kids.sort_by(|&a, &b| {
                    self.nodes[b as usize]
                        .bytes
                        .cmp(&self.nodes[a as usize].bytes)
                });
                for c in kids {
                    if out.len() >= MAX_VIEWS {
                        return out;
                    }
                    out.push(self.make_view(c));
                    next.push(c);
                }
            }
            if next.is_empty() {
                break;
            }
            level = next;
        }
        out
    }

    /// Ranked lists behind the quick filters (biggest folders/files, older than, by type).
    pub fn query(&self, q: &Query) -> Vec<NodeView> {
        let want = match q.scope {
            QueryScope::Dirs => NodeKind::Dir,
            QueryScope::Files => NodeKind::File,
        };
        let under = q.under.unwrap_or(0);
        let min = q.min_bytes.unwrap_or(0);
        let mut hits: Vec<(u64, u32)> = Vec::new();
        for (i, n) in self.nodes.iter().enumerate() {
            let id = i as u32;
            if n.removed || n.kind != want || (want == NodeKind::Dir && id == under) {
                continue;
            }
            if under != 0 && !self.is_under_inner(id, under) {
                continue;
            }
            if q.older_than.is_some_and(|t| n.modified >= t) {
                continue;
            }
            if q.only_empty {
                if want == NodeKind::Dir && n.files == 0 && n.bytes == 0 {
                    hits.push((0, id));
                }
                continue;
            }
            let key = match q.file_kind {
                Some(k) => n.kind_bytes[k.index()],
                None => n.bytes,
            };
            if key == 0 || n.bytes < min {
                continue;
            }
            hits.push((key, id));
        }
        hits.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        hits.truncate(q.limit.unwrap_or(100).min(MAX_QUERY));
        hits.into_iter()
            .map(|(_, id)| {
                let mut v = self.make_view(id);
                v.rel_path = self.parent_rel_path(id);
                v
            })
            .collect()
    }

    /// Ids of all files (not folders, not aggregates) below `under`, in tree order.
    pub fn files_under(&self, under: u32) -> Vec<u32> {
        let mut out = Vec::new();
        if self.nodes.get(under as usize).is_none_or(|n| n.removed) {
            return out;
        }
        let mut stack = vec![under];
        while let Some(x) = stack.pop() {
            let n = &self.nodes[x as usize];
            if n.kind == NodeKind::File {
                out.push(x);
            }
            stack.extend(n.children.iter().copied());
        }
        out.sort_unstable();
        out
    }

    /// Like `view`, with the parent folder path filled in (for lists that show where an entry lives).
    pub fn view_with_path(&self, id: u32) -> Option<NodeView> {
        let mut v = self.view(id)?;
        v.rel_path = self.parent_rel_path(id);
        Some(v)
    }

    /// True when `id` lies inside `ancestor` (or is it).
    pub fn is_under(&self, id: u32, ancestor: u32) -> bool {
        (id as usize) < self.nodes.len() && self.is_under_inner(id, ancestor)
    }

    fn is_under_inner(&self, mut id: u32, ancestor: u32) -> bool {
        while id != NO_PARENT {
            if id == ancestor {
                return true;
            }
            id = self.nodes[id as usize].parent;
        }
        false
    }

    /// Takes a deleted entry out of the tree and subtracts its sums from every folder above, so the
    /// view stays right without rescanning. Returns false for the root, unknown or removed ids.
    pub fn remove(&mut self, id: u32) -> bool {
        if id == 0 || self.nodes.get(id as usize).is_none_or(|n| n.removed) {
            return false;
        }
        let (bytes, logical, files, kind_bytes, parent) = {
            let n = &self.nodes[id as usize];
            (n.bytes, n.logical, n.files, n.kind_bytes, n.parent)
        };
        let mut cur = parent;
        while cur != NO_PARENT {
            let a = &mut self.nodes[cur as usize];
            a.bytes = a.bytes.saturating_sub(bytes);
            a.logical = a.logical.saturating_sub(logical);
            a.files = a.files.saturating_sub(files);
            for (i, b) in kind_bytes.iter().enumerate() {
                a.kind_bytes[i] = a.kind_bytes[i].saturating_sub(*b);
            }
            cur = a.parent;
        }
        if parent != NO_PARENT {
            self.nodes[parent as usize].children.retain(|&c| c != id);
        }
        let mut stack = vec![id];
        while let Some(x) = stack.pop() {
            self.nodes[x as usize].removed = true;
            stack.extend(self.nodes[x as usize].children.iter().copied());
        }
        true
    }

    /// Full path of a folder or file. `None` for aggregates ("small files") and unknown ids.
    pub fn path(&self, id: u32) -> Option<PathBuf> {
        let n = self.nodes.get(id as usize)?;
        if n.kind == NodeKind::Small || n.removed {
            return None;
        }
        let mut parts = Vec::new();
        let mut cur = id;
        while cur != 0 {
            let n = &self.nodes[cur as usize];
            parts.push(n.name.as_str());
            cur = n.parent;
        }
        let mut p = self.root.clone();
        for part in parts.iter().rev() {
            p.push(part);
        }
        Some(p)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(name: &str, bytes: u64, modified: i64) -> FileTemp {
        FileTemp {
            name: name.into(),
            bytes,
            logical: bytes,
            modified,
        }
    }

    fn sample() -> Tree {
        let root = DirTemp {
            name: String::new(),
            modified: 10,
            dirs: vec![
                DirTemp {
                    name: "videos".into(),
                    modified: 20,
                    files: vec![file("a.mp4", 900, 20), file("b.mp4", 300, 5)],
                    ..Default::default()
                },
                DirTemp {
                    name: "docs".into(),
                    modified: 1,
                    files: vec![file("x.pdf", 100, 1)],
                    small: SmallAgg {
                        count: 5,
                        bytes: 50,
                        logical: 40,
                        modified: 2,
                        kind_bytes: {
                            let mut k = [0; KIND_COUNT];
                            k[FileKind::Document.index()] = 50;
                            k
                        },
                    },
                    ..Default::default()
                },
            ],
            files: vec![file("readme.txt", 10, 3)],
            small: SmallAgg::default(),
        };
        Tree::from_temp(PathBuf::from("/data"), root)
    }

    #[test]
    fn sums_bubble_up() {
        let t = sample();
        let root = t.view(0).unwrap();
        assert_eq!(root.bytes, 900 + 300 + 100 + 50 + 10);
        assert_eq!(root.files, 2 + 1 + 5 + 1);
        assert_eq!(root.modified, 20);
        assert_eq!(root.file_kind, FileKind::Video);
        assert_eq!(root.logical_bytes, 900 + 300 + 100 + 40 + 10);
    }

    #[test]
    fn children_are_sorted_and_filtered() {
        let t = sample();
        let kids = t.children(0, 1, 0);
        assert_eq!(
            kids.iter().map(|k| k.name.as_str()).collect::<Vec<_>>(),
            ["videos", "docs", "readme.txt"]
        );
        let big = t.children(0, 1, 200);
        assert_eq!(big.len(), 1);
        let deep = t.children(0, 2, 0);
        assert!(deep.len() > kids.len());
        assert!(t.children(999, 1, 0).is_empty());
    }

    #[test]
    fn paths_are_rebuilt_from_names() {
        let t = sample();
        let videos = t.children(0, 1, 0)[0].id;
        let a = t.children(videos, 1, 0)[0].id;
        assert_eq!(t.path(a).unwrap(), PathBuf::from("/data/videos/a.mp4"));
        assert_eq!(t.path(0).unwrap(), PathBuf::from("/data"));
        let docs = t.children(0, 1, 0)[1].id;
        let small = t
            .children(docs, 1, 0)
            .into_iter()
            .find(|n| n.kind == NodeKind::Small)
            .unwrap();
        assert!(t.path(small.id).is_none());
    }

    #[test]
    fn queries_rank_and_filter() {
        let t = sample();
        let dirs = t.query(&Query {
            scope: QueryScope::Dirs,
            under: None,
            older_than: None,
            file_kind: None,
            min_bytes: None,
            limit: None,
            only_empty: false,
        });
        assert_eq!(
            dirs.iter().map(|d| d.name.as_str()).collect::<Vec<_>>(),
            ["videos", "docs"]
        );
        let files = t.query(&Query {
            scope: QueryScope::Files,
            under: None,
            older_than: None,
            file_kind: None,
            min_bytes: None,
            limit: Some(2),
            only_empty: false,
        });
        assert_eq!(
            files.iter().map(|d| d.name.as_str()).collect::<Vec<_>>(),
            ["a.mp4", "b.mp4"]
        );
        let old = t.query(&Query {
            scope: QueryScope::Files,
            under: None,
            older_than: Some(4),
            file_kind: None,
            min_bytes: None,
            limit: None,
            only_empty: false,
        });
        assert_eq!(
            old.iter().map(|d| d.name.as_str()).collect::<Vec<_>>(),
            ["x.pdf", "readme.txt"]
        );
        let docs_only = t.query(&Query {
            scope: QueryScope::Dirs,
            under: None,
            older_than: None,
            file_kind: Some(FileKind::Document),
            min_bytes: None,
            limit: None,
            only_empty: false,
        });
        assert_eq!(docs_only.len(), 1);
        assert_eq!(docs_only[0].name, "docs");
        let videos = t.children(0, 1, 0)[0].id;
        let deep = t.query(&Query {
            scope: QueryScope::Files,
            under: None,
            older_than: None,
            file_kind: None,
            min_bytes: None,
            limit: Some(1),
            only_empty: false,
        });
        assert_eq!(deep[0].rel_path, "videos");
        let under = t.query(&Query {
            scope: QueryScope::Files,
            under: Some(videos),
            older_than: None,
            file_kind: None,
            min_bytes: None,
            limit: None,
            only_empty: false,
        });
        assert_eq!(under.len(), 2);
    }
}
