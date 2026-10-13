//! A small, growing picture of a running scan: the folders of the top [`LIVE_DEPTH`] levels with
//! what has been counted below them so far. The walk adds to it once per folder (one short lock);
//! the webview asks for snapshots while the scan runs, so the map can fill up instead of staying
//! empty until the end. Deeper folders count towards their ancestor on the last live level.

use crate::kinds::{FileKind, KIND_COUNT};
use crate::tree::{dominant, NodeKind, NodeView};
use crate::AGE_COUNT;
use std::sync::Mutex;

/// Folder levels below the scan root that get their own live node (the map draws two levels).
pub const LIVE_DEPTH: usize = 2;
/// Ids of the "files directly here" entries: the folder's id plus this offset.
pub const OWN_FILES_ID: u32 = 1 << 31;
const NO_PARENT: u32 = u32::MAX;

#[derive(Default)]
struct LiveNode {
    parent: u32,
    name: String,
    /// Counted directly in this folder (or, on the last live level, anywhere below it).
    own_bytes: u64,
    own_files: u64,
    modified: i64,
    kind_bytes: [u64; KIND_COUNT],
    children: Vec<u32>,
}

/// What one folder contributes after its entries were read.
#[derive(Default, Clone)]
pub(crate) struct Counted {
    pub bytes: u64,
    pub files: u64,
    pub modified: i64,
    pub kind_bytes: [u64; KIND_COUNT],
}

#[derive(Default)]
pub struct LiveTree {
    nodes: Mutex<Vec<LiveNode>>,
}

impl LiveTree {
    /// Starts over with only the root (called when a scan begins).
    pub(crate) fn reset(&self, root_name: String) {
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        n.clear();
        n.push(LiveNode {
            parent: NO_PARENT,
            name: root_name,
            ..Default::default()
        });
    }

    /// Adds a sub-folder below `parent` and returns its live id.
    pub(crate) fn add_folder(&self, parent: u32, name: &str) -> u32 {
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        let id = n.len() as u32;
        n.push(LiveNode {
            parent,
            name: name.to_string(),
            ..Default::default()
        });
        if let Some(p) = n.get_mut(parent as usize) {
            p.children.push(id);
        }
        id
    }

    pub(crate) fn add(&self, id: u32, c: &Counted) {
        if c.bytes == 0 && c.files == 0 {
            return;
        }
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(node) = n.get_mut(id as usize) {
            node.own_bytes += c.bytes;
            node.own_files += c.files;
            node.modified = node.modified.max(c.modified);
            for i in 0..KIND_COUNT {
                node.kind_bytes[i] += c.kind_bytes[i];
            }
        }
    }

    /// The live folders with their totals so far, biggest first within a folder, without entries
    /// smaller than `min_bytes`. A folder whose own files count gets an extra "files here" entry
    /// so the map shows their share. Empty before the scan started.
    pub fn snapshot(&self, min_bytes: u64) -> Vec<NodeView> {
        let n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        if n.is_empty() {
            return Vec::new();
        }
        // Totals bottom-up: children always have a higher index than their parent.
        let mut total: Vec<Counted> = n
            .iter()
            .map(|x| Counted {
                bytes: x.own_bytes,
                files: x.own_files,
                modified: x.modified,
                kind_bytes: x.kind_bytes,
            })
            .collect();
        for i in (1..n.len()).rev() {
            let p = n[i].parent as usize;
            let c = total[i].clone();
            let t = &mut total[p];
            t.bytes += c.bytes;
            t.files += c.files;
            t.modified = t.modified.max(c.modified);
            for k in 0..KIND_COUNT {
                t.kind_bytes[k] += c.kind_bytes[k];
            }
        }
        let view = |id: u32, kind: NodeKind, c: &Counted, child_count: u32| NodeView {
            id,
            parent_id: match kind {
                NodeKind::Small => Some(id - OWN_FILES_ID),
                _ => (n[id as usize].parent != NO_PARENT).then_some(n[id as usize].parent),
            },
            name: if kind == NodeKind::Small {
                String::new()
            } else {
                n[id as usize].name.clone()
            },
            kind,
            bytes: c.bytes,
            logical_bytes: c.bytes,
            files: c.files,
            modified: c.modified,
            file_kind: if c.bytes == 0 {
                FileKind::Other
            } else {
                dominant(&c.kind_bytes)
            },
            kind_bytes: c.kind_bytes,
            age_bytes: [0; AGE_COUNT],
            child_count,
            rel_path: String::new(),
        };
        let mut out = vec![view(
            0,
            NodeKind::Dir,
            &total[0],
            n[0].children.len() as u32,
        )];
        let mut level = vec![0u32];
        while !level.is_empty() {
            let mut next = Vec::new();
            for &p in &level {
                let mut kids: Vec<u32> = n[p as usize]
                    .children
                    .iter()
                    .copied()
                    .filter(|&c| {
                        total[c as usize].bytes >= min_bytes && total[c as usize].bytes > 0
                    })
                    .collect();
                kids.sort_by(|&a, &b| total[b as usize].bytes.cmp(&total[a as usize].bytes));
                for c in kids {
                    let kids_of_c = n[c as usize].children.len() as u32;
                    out.push(view(c, NodeKind::Dir, &total[c as usize], kids_of_c));
                    next.push(c);
                }
                let node = &n[p as usize];
                if !node.children.is_empty() && node.own_bytes > 0 && node.own_bytes >= min_bytes {
                    let own = Counted {
                        bytes: node.own_bytes,
                        files: node.own_files,
                        modified: node.modified,
                        kind_bytes: node.kind_bytes,
                    };
                    out.push(view(p + OWN_FILES_ID, NodeKind::Small, &own, 0));
                }
            }
            level = next;
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn totals_grow_bottom_up_and_own_files_get_their_own_entry() {
        let live = LiveTree::default();
        assert!(live.snapshot(0).is_empty());
        live.reset("/data".into());
        let games = live.add_folder(0, "games");
        let old = live.add_folder(games, "old");
        let mut k = [0; KIND_COUNT];
        k[FileKind::Game.index()] = 500;
        live.add(
            old,
            &Counted {
                bytes: 500,
                files: 2,
                modified: 10,
                kind_bytes: k,
            },
        );
        live.add(
            0,
            &Counted {
                bytes: 100,
                files: 1,
                modified: 20,
                kind_bytes: [0; KIND_COUNT],
            },
        );
        let s = live.snapshot(0);
        let by = |id: u32| s.iter().find(|v| v.id == id).unwrap();
        assert_eq!(by(0).bytes, 600);
        assert_eq!(by(0).modified, 20);
        assert_eq!(by(games).bytes, 500);
        assert_eq!(by(games).file_kind, FileKind::Game);
        assert_eq!(by(old).parent_id, Some(games));
        // The root's own file shows as "files here" next to its folders.
        let own = by(OWN_FILES_ID);
        assert_eq!(
            (own.kind, own.bytes, own.parent_id),
            (NodeKind::Small, 100, Some(0))
        );
        // Small entries are left out, the root always stays.
        assert_eq!(live.snapshot(200).len(), 3);
    }
}
