use crate::kinds::{age_bucket, FileKind, AGE_COUNT, KIND_COUNT};
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
    /// Newest file access (Unix seconds) in the subtree; folders' own times are left out, the
    /// scan itself touches them.
    accessed: i64,
    kind_bytes: [u64; KIND_COUNT],
    /// Bytes per age bucket (`kinds::AGE_LIMITS_DAYS`) by each file's own change time.
    age_bytes: [u64; AGE_COUNT],
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
    pub accessed: i64,
}

#[derive(Default)]
pub(crate) struct SmallAgg {
    pub count: u64,
    pub bytes: u64,
    pub logical: u64,
    pub modified: i64,
    pub accessed: i64,
    pub kind_bytes: [u64; KIND_COUNT],
    pub age_bytes: [u64; AGE_COUNT],
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
    /// Newest file access in the subtree (Unix seconds; 0 = unknown). Only meaningful where the
    /// scan reports access times as tracked.
    pub accessed: i64,
    /// Dominant file type by bytes.
    pub file_kind: FileKind,
    pub kind_bytes: [u64; KIND_COUNT],
    /// Bytes per age bucket of the files below (relative to the scan start).
    pub age_bytes: [u64; AGE_COUNT],
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
    /// Folders and files (never the "small files" aggregates).
    All,
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
    /// Compare `older_than` (and `topmost`) with the last access instead of the last change.
    #[serde(default)]
    pub by_access: bool,
    /// Folders without any file (own or nested); ranked by name. Folders only.
    #[serde(default)]
    pub only_empty: bool,
    /// With `older_than`: leave out entries whose folder is old as well, so a list of clean-up
    /// candidates shows each untouched folder once instead of everything inside it, too.
    #[serde(default)]
    pub topmost: bool,
}

pub struct Tree {
    nodes: Vec<Node>,
    root: PathBuf,
}

pub(crate) fn dominant(kind_bytes: &[u64; KIND_COUNT]) -> FileKind {
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
    /// Builds the arena; `now` (Unix seconds, the scan start) anchors the age buckets.
    pub(crate) fn from_temp(root: PathBuf, temp: DirTemp, now: i64) -> Tree {
        let mut tree = Tree {
            nodes: Vec::new(),
            root,
        };
        tree.add_dir(NO_PARENT, temp, now);
        tree
    }

    fn add_dir(&mut self, parent: u32, dir: DirTemp, now: i64) -> u32 {
        let id = self.nodes.len() as u32;
        self.nodes.push(Node {
            parent,
            name: dir.name,
            kind: NodeKind::Dir,
            bytes: 0,
            logical: 0,
            files: 0,
            modified: dir.modified,
            accessed: 0,
            kind_bytes: [0; KIND_COUNT],
            age_bytes: [0; AGE_COUNT],
            children: Vec::new(),
            removed: false,
        });
        let mut children = Vec::new();
        for child in dir.dirs {
            children.push(self.add_dir(id, child, now));
        }
        for f in dir.files {
            let fid = self.nodes.len() as u32;
            let mut kind_bytes = [0; KIND_COUNT];
            kind_bytes[crate::kinds::classify(&f.name).index()] = f.bytes;
            let mut age_bytes = [0; AGE_COUNT];
            age_bytes[age_bucket(f.modified, now)] = f.bytes;
            self.nodes.push(Node {
                parent: id,
                name: f.name,
                kind: NodeKind::File,
                bytes: f.bytes,
                logical: f.logical,
                files: 1,
                modified: f.modified,
                accessed: f.accessed,
                kind_bytes,
                age_bytes,
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
                accessed: dir.small.accessed,
                kind_bytes: dir.small.kind_bytes,
                age_bytes: dir.small.age_bytes,
                children: Vec::new(),
                removed: false,
            });
            children.push(sid);
        }
        let (mut bytes, mut logical, mut files, mut modified, mut accessed) =
            (0, 0, 0, self.nodes[id as usize].modified, 0);
        let mut kind_bytes = [0; KIND_COUNT];
        let mut age_bytes = [0; AGE_COUNT];
        for &c in &children {
            let n = &self.nodes[c as usize];
            bytes += n.bytes;
            logical += n.logical;
            files += n.files;
            modified = modified.max(n.modified);
            accessed = accessed.max(n.accessed);
            for i in 0..KIND_COUNT {
                kind_bytes[i] += n.kind_bytes[i];
            }
            for i in 0..AGE_COUNT {
                age_bytes[i] += n.age_bytes[i];
            }
        }
        let n = &mut self.nodes[id as usize];
        n.bytes = bytes;
        n.logical = logical;
        n.files = files;
        n.modified = modified;
        n.accessed = accessed;
        n.kind_bytes = kind_bytes;
        n.age_bytes = age_bytes;
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
            accessed: n.accessed,
            file_kind: dominant(&n.kind_bytes),
            kind_bytes: n.kind_bytes,
            age_bytes: n.age_bytes,
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
        let wanted = |k: NodeKind| match q.scope {
            QueryScope::Dirs => k == NodeKind::Dir,
            QueryScope::Files => k == NodeKind::File,
            QueryScope::All => k != NodeKind::Small,
        };
        let under = q.under.unwrap_or(0);
        let min = q.min_bytes.unwrap_or(0);
        let stamp = |n: &Node| if q.by_access { n.accessed } else { n.modified };
        let mut hits: Vec<(u64, u32)> = Vec::new();
        for (i, n) in self.nodes.iter().enumerate() {
            let id = i as u32;
            if n.removed || !wanted(n.kind) || id == under {
                continue;
            }
            if under != 0 && !self.is_under_inner(id, under) {
                continue;
            }
            if q.older_than.is_some_and(|t| stamp(n) >= t) {
                continue;
            }
            if q.topmost
                && q.older_than.is_some_and(|t| {
                    n.parent != NO_PARENT
                        && n.parent != under
                        && stamp(&self.nodes[n.parent as usize]) < t
                })
            {
                continue;
            }
            if q.only_empty {
                if n.kind == NodeKind::Dir && n.files == 0 && n.bytes == 0 {
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
        let (bytes, logical, files, kind_bytes, age_bytes, parent) = {
            let n = &self.nodes[id as usize];
            (
                n.bytes,
                n.logical,
                n.files,
                n.kind_bytes,
                n.age_bytes,
                n.parent,
            )
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
            for (i, b) in age_bytes.iter().enumerate() {
                a.age_bytes[i] = a.age_bytes[i].saturating_sub(*b);
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

    /// The folder that was scanned.
    pub fn root_path(&self) -> &std::path::Path {
        &self.root
    }

    /// Folders (not the root) whose name matches `name`, ignoring ASCII case.
    pub fn dirs_named(&self, name: &str) -> Vec<u32> {
        (1..self.nodes.len() as u32)
            .filter(|&i| {
                let n = &self.nodes[i as usize];
                n.kind == NodeKind::Dir && !n.removed && n.name.eq_ignore_ascii_case(name)
            })
            .collect()
    }

    /// The sub-folder of `id` called `name` (ASCII case ignored).
    pub fn child_dir_named(&self, id: u32, name: &str) -> Option<u32> {
        let n = self.nodes.get(id as usize).filter(|n| !n.removed)?;
        n.children.iter().copied().find(|&c| {
            let c = &self.nodes[c as usize];
            c.kind == NodeKind::Dir && c.name.eq_ignore_ascii_case(name)
        })
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
            accessed: modified,
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
                        accessed: 2,
                        kind_bytes: {
                            let mut k = [0; KIND_COUNT];
                            k[FileKind::Document.index()] = 50;
                            k
                        },
                        age_bytes: [50, 0, 0, 0, 0, 0],
                    },
                    ..Default::default()
                },
            ],
            files: vec![file("readme.txt", 10, 3)],
            small: SmallAgg::default(),
        };
        Tree::from_temp(PathBuf::from("/data"), root, 100)
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
            topmost: false,
            by_access: false,
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
            topmost: false,
            by_access: false,
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
            topmost: false,
            by_access: false,
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
            topmost: false,
            by_access: false,
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
            topmost: false,
            by_access: false,
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
            topmost: false,
            by_access: false,
        });
        assert_eq!(under.len(), 2);
    }

    /// Folders `games/old/deep` and `games/new` changed long ago / just now (days before `NOW`).
    fn aged() -> Tree {
        const NOW: i64 = 2_000_000_000;
        let ago = |d: i64| NOW - d * 86_400;
        let root = DirTemp {
            name: String::new(),
            modified: ago(1),
            dirs: vec![DirTemp {
                name: "games".into(),
                modified: ago(1),
                dirs: vec![
                    DirTemp {
                        name: "old".into(),
                        modified: ago(900),
                        files: vec![file("old.pak", 500, ago(900))],
                        dirs: vec![DirTemp {
                            name: "deep".into(),
                            modified: ago(800),
                            files: vec![file("deep.pak", 300, ago(800))],
                            ..Default::default()
                        }],
                        ..Default::default()
                    },
                    DirTemp {
                        name: "new".into(),
                        modified: ago(2),
                        files: vec![
                            file("fresh.pak", 200, ago(2)),
                            file("stale.mp4", 400, ago(400)),
                        ],
                        ..Default::default()
                    },
                ],
                ..Default::default()
            }],
            ..Default::default()
        };
        Tree::from_temp(PathBuf::from("/data"), root, NOW)
    }

    #[test]
    fn age_buckets_add_up_per_folder() {
        let t = aged();
        let root = t.view(0).unwrap();
        // 200 new, 400 between one and two years, 500 + 300 between two and three years.
        assert_eq!(root.age_bytes, [200, 0, 0, 400, 800, 0]);
        assert_eq!(root.age_bytes.iter().sum::<u64>(), root.bytes);
        assert_eq!(root.file_kind, FileKind::Game);
    }

    #[test]
    fn topmost_lists_each_untouched_folder_once() {
        let t = aged();
        let year_ago = 2_000_000_000 - 365 * 86_400;
        let q = |topmost: bool, under: Option<u32>| Query {
            scope: QueryScope::All,
            under,
            older_than: Some(year_ago),
            file_kind: None,
            min_bytes: None,
            limit: None,
            only_empty: false,
            topmost,
            by_access: false,
        };
        let names = |v: Vec<NodeView>| v.into_iter().map(|n| n.name).collect::<Vec<_>>();
        // Without `topmost` the old folder and everything inside it show up.
        assert_eq!(
            names(t.query(&q(false, None))),
            ["old", "old.pak", "stale.mp4", "deep", "deep.pak"]
        );
        // With it: the old folder once, plus the old file in a folder that is still in use.
        assert_eq!(names(t.query(&q(true, None))), ["old", "stale.mp4"]);
        // Looking inside the old folder itself lists its direct entries.
        let old = t.query(&q(true, None))[0].id;
        assert_eq!(names(t.query(&q(true, Some(old)))), ["old.pak", "deep"]);
    }

    #[test]
    fn by_access_ranks_by_the_last_opening_and_ignores_folder_times() {
        let opened = |name: &str, modified: i64, accessed: i64| FileTemp {
            accessed,
            ..file(name, 100, modified)
        };
        // Both files changed long ago; only one was opened recently.
        let t = Tree::from_temp(
            PathBuf::from("/data"),
            DirTemp {
                name: String::new(),
                modified: 1,
                dirs: vec![
                    DirTemp {
                        name: "played".into(),
                        // A folder's own time (the scan touches it) never counts as an access.
                        modified: 900,
                        files: vec![opened("save.dat", 5, 950)],
                        ..Default::default()
                    },
                    DirTemp {
                        name: "forgotten".into(),
                        modified: 5,
                        files: vec![opened("old.dat", 5, 6)],
                        ..Default::default()
                    },
                ],
                ..Default::default()
            },
            1000,
        );
        assert_eq!(t.view(0).unwrap().accessed, 950);
        let q = |by_access: bool| Query {
            scope: QueryScope::Dirs,
            under: None,
            older_than: Some(500),
            file_kind: None,
            min_bytes: None,
            limit: None,
            only_empty: false,
            topmost: true,
            by_access,
        };
        let names = |v: Vec<NodeView>| v.into_iter().map(|n| n.name).collect::<Vec<_>>();
        assert_eq!(names(t.query(&q(false))), ["forgotten"]);
        assert_eq!(names(t.query(&q(true))), ["forgotten"]);
        // By change date the old save looks unused; by access it is not.
        let files = |by_access: bool| Query {
            scope: QueryScope::Files,
            topmost: false,
            ..q(by_access)
        };
        assert_eq!(names(t.query(&files(false))), ["save.dat", "old.dat"]);
        assert_eq!(names(t.query(&files(true))), ["old.dat"]);
    }

    #[test]
    fn removing_an_entry_takes_its_ages_along() {
        let mut t = aged();
        let old = t.query(&Query {
            scope: QueryScope::Dirs,
            under: None,
            older_than: Some(2_000_000_000 - 365 * 86_400),
            file_kind: None,
            min_bytes: None,
            limit: None,
            only_empty: false,
            topmost: true,
            by_access: false,
        })[0]
            .id;
        assert!(t.remove(old));
        assert_eq!(t.view(0).unwrap().age_bytes, [200, 0, 0, 400, 0, 0]);
    }
}
