//! Duplicate files among the scanned files: size first, then a hash of the first 64 KiB, then the
//! full hash. Read-only; nothing is ever deleted automatically.

use crate::scan::ScanControl;
use crate::tree::{NodeView, Tree};
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;

const HEAD: usize = 64 * 1024;
const MAX_GROUPS: usize = 200;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DupGroup {
    /// Size of each file.
    pub size: u64,
    /// Space that could be freed by keeping one file: `size * (n - 1)`.
    pub wasted: u64,
    pub files: Vec<NodeView>,
}

fn hash(path: &Path, head_only: bool) -> Option<[u8; 32]> {
    let mut f = File::open(path).ok()?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; if head_only { HEAD } else { 256 * 1024 }];
    loop {
        let n = f.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
        if head_only {
            break;
        }
    }
    Some(h.finalize().into())
}

/// Groups of identical files below `under`, biggest waste first. Files that cannot be read are
/// left out; cloud placeholders (size 0 locally) are never opened. Only files the scan kept as
/// their own entry (at or above the scan's size threshold) can be found.
pub fn find_duplicates(tree: &Tree, under: u32, control: &ScanControl) -> Vec<DupGroup> {
    let mut by_size: HashMap<u64, Vec<u32>> = HashMap::new();
    for id in tree.files_under(under) {
        if let Some(v) = tree.view(id) {
            if v.logical_bytes > 0 {
                by_size.entry(v.logical_bytes).or_default().push(id);
            }
        }
    }
    let candidates: Vec<(u64, Vec<u32>)> = by_size
        .into_iter()
        .filter(|(_, ids)| ids.len() > 1)
        .collect();
    let mut groups: Vec<DupGroup> = candidates
        .into_par_iter()
        .flat_map(|(size, ids)| {
            if control.is_cancelled() {
                return Vec::new();
            }
            let split = |ids: Vec<u32>, head_only: bool| -> Vec<Vec<u32>> {
                let mut map: HashMap<[u8; 32], Vec<u32>> = HashMap::new();
                for id in ids {
                    if control.is_cancelled() {
                        break;
                    }
                    if let Some(h) = tree.path(id).and_then(|p| hash(&p, head_only)) {
                        map.entry(h).or_default().push(id);
                    }
                }
                map.into_values().filter(|g| g.len() > 1).collect()
            };
            split(ids, true)
                .into_iter()
                .flat_map(|g| split(g, false))
                .map(|g| DupGroup {
                    size,
                    wasted: size * (g.len() as u64 - 1),
                    files: g
                        .into_iter()
                        .filter_map(|id| tree.view_with_path(id))
                        .collect(),
                })
                .collect::<Vec<_>>()
        })
        .collect();
    groups.sort_by(|a, b| b.wasted.cmp(&a.wasted).then(b.size.cmp(&a.size)));
    groups.truncate(MAX_GROUPS);
    groups
}
