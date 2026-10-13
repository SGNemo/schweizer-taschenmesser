//! Steam games inside a scan with the time they were last played, so the clean-up view can tell an
//! untouched game from one that only got an update. Read-only: Steam's own text files
//! (`steamapps/appmanifest_<id>.acf`, `userdata/<user>/config/localconfig.vdf`) are parsed, never
//! changed. Nothing here is stored or sent anywhere; the webview gets it on request for one scan.

use crate::tree::{NodeView, Tree};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Steam's files are small; anything bigger is not what we expect and is skipped.
const MAX_MANIFEST_BYTES: u64 = 1 << 20;
const MAX_LOCALCONFIG_BYTES: u64 = 64 << 20;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamGame {
    pub app_id: u32,
    /// Name from the app manifest (the folder name can differ).
    pub title: String,
    /// Unix seconds; `None` when Steam has no date (never started, or an old Steam version).
    pub last_played: Option<i64>,
    /// The game's install folder in the scan tree (with its parent path).
    pub node: NodeView,
}

/// A parsed Valve KeyValues text ("VDF"): nested `"key" "value"` / `"key" { ... }`.
#[derive(Debug, PartialEq)]
pub(crate) enum Vdf {
    Str(String),
    Obj(Vec<(String, Vdf)>),
}

impl Vdf {
    /// First child called `key` (ASCII case ignored; Steam is not consistent about it).
    pub(crate) fn get(&self, key: &str) -> Option<&Vdf> {
        match self {
            Vdf::Obj(items) => items
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v),
            Vdf::Str(_) => None,
        }
    }

    pub(crate) fn at(&self, path: &[&str]) -> Option<&Vdf> {
        path.iter().try_fold(self, |v, k| v.get(k))
    }

    pub(crate) fn str(&self) -> Option<&str> {
        match self {
            Vdf::Str(s) => Some(s),
            Vdf::Obj(_) => None,
        }
    }

    fn int(&self) -> Option<i64> {
        self.str()?.trim().parse().ok()
    }
}

#[derive(Debug, PartialEq)]
enum Token {
    Open,
    Close,
    Text(String),
}

fn tokens(text: &str) -> Vec<Token> {
    let mut out = Vec::new();
    let mut chars = text.chars().peekable();
    while let Some(&c) = chars.peek() {
        match c {
            c if c.is_whitespace() => {
                chars.next();
            }
            '{' => {
                chars.next();
                out.push(Token::Open);
            }
            '}' => {
                chars.next();
                out.push(Token::Close);
            }
            '/' => {
                chars.next();
                if chars.peek() == Some(&'/') {
                    // Comment up to the end of the line.
                    for c in chars.by_ref() {
                        if c == '\n' {
                            break;
                        }
                    }
                } else {
                    out.push(Token::Text("/".into()));
                }
            }
            '"' => {
                chars.next();
                let mut s = String::new();
                while let Some(c) = chars.next() {
                    match c {
                        '"' => break,
                        '\\' => match chars.next() {
                            Some('n') => s.push('\n'),
                            Some('t') => s.push('\t'),
                            Some(other) => s.push(other),
                            None => break,
                        },
                        c => s.push(c),
                    }
                }
                out.push(Token::Text(s));
            }
            _ => {
                let mut s = String::new();
                while let Some(&c) = chars.peek() {
                    if c.is_whitespace() || c == '{' || c == '}' || c == '"' {
                        break;
                    }
                    s.push(c);
                    chars.next();
                }
                // `[$WIN32]`-style conditions after a value carry no data for us.
                if !(s.starts_with('[') && s.ends_with(']')) {
                    out.push(Token::Text(s));
                }
            }
        }
    }
    out
}

/// Parses a VDF text into one object of its top-level entries. Tolerant: whatever cannot be read
/// ends the object it is in, so a damaged file yields what came before the damage.
pub(crate) fn parse_vdf(text: &str) -> Vdf {
    fn object(tokens: &[Token], pos: &mut usize) -> Vdf {
        let mut items = Vec::new();
        while *pos < tokens.len() {
            match &tokens[*pos] {
                Token::Close => {
                    *pos += 1;
                    break;
                }
                Token::Open => {
                    // A brace without a key: read and drop it.
                    *pos += 1;
                    object(tokens, pos);
                }
                Token::Text(key) => {
                    *pos += 1;
                    match tokens.get(*pos) {
                        Some(Token::Open) => {
                            *pos += 1;
                            items.push((key.clone(), object(tokens, pos)));
                        }
                        Some(Token::Text(value)) => {
                            *pos += 1;
                            items.push((key.clone(), Vdf::Str(value.clone())));
                        }
                        Some(Token::Close) | None => {}
                    }
                }
            }
        }
        Vdf::Obj(items)
    }
    let t = tokens(text);
    object(&t, &mut 0)
}

fn read_small(path: &Path, max: u64) -> Option<String> {
    let md = fs::metadata(path).ok()?;
    if !md.is_file() || md.len() > max {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

struct Manifest {
    app_id: u32,
    title: String,
    install_dir: String,
    last_played: i64,
}

fn read_manifest(path: &Path) -> Option<Manifest> {
    let vdf = parse_vdf(&read_small(path, MAX_MANIFEST_BYTES)?);
    let app = vdf.get("AppState")?;
    let install_dir = app.get("installdir")?.str()?.trim().to_string();
    if install_dir.is_empty() || install_dir.contains(['/', '\\']) || install_dir == ".." {
        return None;
    }
    Some(Manifest {
        app_id: u32::try_from(app.get("appid")?.int()?).ok()?,
        title: app
            .get("name")
            .and_then(Vdf::str)
            .unwrap_or(&install_dir)
            .to_string(),
        last_played: app.get("LastPlayed").and_then(Vdf::int).unwrap_or(0),
        install_dir,
    })
}

fn manifests_in(steamapps: &Path) -> Vec<Manifest> {
    let Ok(rd) = fs::read_dir(steamapps) else {
        return Vec::new();
    };
    let mut out: Vec<Manifest> = rd
        .flatten()
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_ascii_lowercase();
            name.starts_with("appmanifest_") && name.ends_with(".acf")
        })
        .filter_map(|e| read_manifest(&e.path()))
        .collect();
    out.sort_by_key(|m| m.app_id);
    out
}

/// `LastPlayed` per app id from every Steam user's `localconfig.vdf` below a Steam install folder.
fn local_last_played(steam_root: &Path, into: &mut HashMap<u32, i64>) {
    let Ok(users) = fs::read_dir(steam_root.join("userdata")) else {
        return;
    };
    for user in users.flatten() {
        let file = user.path().join("config").join("localconfig.vdf");
        let Some(text) = read_small(&file, MAX_LOCALCONFIG_BYTES) else {
            continue;
        };
        let vdf = parse_vdf(&text);
        let Some(Vdf::Obj(apps)) = vdf.at(&[
            "UserLocalConfigStore",
            "Software",
            "Valve",
            "Steam",
            "apps",
        ]) else {
            continue;
        };
        for (id, app) in apps {
            let (Ok(id), Some(t)) = (id.parse::<u32>(), app.get("LastPlayed").and_then(Vdf::int))
            else {
                continue;
            };
            let e = into.entry(id).or_insert(0);
            *e = (*e).max(t);
        }
    }
}

/// The Steam install folder from the registry (`SteamPath`), where `userdata` lives even when the
/// games sit in a library on another drive.
#[cfg(windows)]
pub fn steam_install_dirs() -> Vec<PathBuf> {
    use windows::core::w;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};
    let mut buffer = [0u16; 1024];
    let mut bytes = (buffer.len() * 2) as u32;
    // SAFETY: `buffer` is valid for `bytes` bytes; the API writes at most that many.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Valve\\Steam"),
            w!("SteamPath"),
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
    };
    if status != ERROR_SUCCESS {
        return Vec::new();
    }
    let chars = (bytes as usize / 2).saturating_sub(1).min(buffer.len());
    let path = String::from_utf16_lossy(&buffer[..chars]);
    if path.is_empty() {
        Vec::new()
    } else {
        vec![PathBuf::from(path)]
    }
}

/// Elsewhere Steam's `userdata` sits next to `steamapps` of the main library, which the scan finds.
#[cfg(not(windows))]
pub fn steam_install_dirs() -> Vec<PathBuf> {
    Vec::new()
}

/// Steam games installed inside the scanned folder: every `steamapps` folder in the tree (or the
/// scan root's own, when `steamapps` or `steamapps/common` was scanned) is matched with its app
/// manifests. `steam_roots` are extra Steam install folders whose `userdata` is read for the
/// last-played time ([`steam_install_dirs`]). Sorted longest unplayed first, unknown dates last.
pub fn steam_games(tree: &Tree, steam_roots: &[PathBuf]) -> Vec<SteamGame> {
    // (steamapps folder on disk, node of its `common` folder)
    let mut libraries: Vec<(PathBuf, u32)> = Vec::new();
    let root = tree.root_path();
    let is = |p: &Path, name: &str| {
        p.file_name()
            .is_some_and(|n| n.to_string_lossy().eq_ignore_ascii_case(name))
    };
    if is(root, "steamapps") {
        if let Some(common) = tree.child_dir_named(tree.root_id(), "common") {
            libraries.push((root.to_path_buf(), common));
        }
    } else if is(root, "common") && root.parent().is_some_and(|p| is(p, "steamapps")) {
        if let Some(parent) = root.parent() {
            libraries.push((parent.to_path_buf(), tree.root_id()));
        }
    }
    for id in tree.dirs_named("steamapps") {
        if let (Some(path), Some(common)) = (tree.path(id), tree.child_dir_named(id, "common")) {
            libraries.push((path, common));
        }
    }
    if libraries.is_empty() {
        return Vec::new();
    }

    let mut last: HashMap<u32, i64> = HashMap::new();
    let mut roots: Vec<PathBuf> = steam_roots.to_vec();
    roots.extend(libraries.iter().filter_map(|(p, _)| p.parent().map(Path::to_path_buf)));
    roots.sort();
    roots.dedup();
    for r in &roots {
        local_last_played(r, &mut last);
    }

    let mut out = Vec::new();
    for (steamapps, common) in &libraries {
        for m in manifests_in(steamapps) {
            let Some(node) = tree
                .child_dir_named(*common, &m.install_dir)
                .and_then(|id| tree.view_with_path(id))
            else {
                continue; // not installed here (or not part of the scan)
            };
            let played = m.last_played.max(last.get(&m.app_id).copied().unwrap_or(0));
            out.push(SteamGame {
                app_id: m.app_id,
                title: m.title,
                last_played: (played > 0).then_some(played),
                node,
            });
        }
    }
    out.sort_by_key(|g| (g.last_played.is_none(), g.last_played, g.node.id));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_values_comments_escapes_and_conditions() {
        let v = parse_vdf(
            r#"// made-up manifest
"AppState"
{
	"appid"		"4242"
	"name"		"Sky \"Ferry\" Tales"
	"LastPlayed"		"1700000000" [$WIN32]
	"UserConfig" { "language" "german" }
}"#,
        );
        let app = v.get("appstate").unwrap();
        assert_eq!(app.get("APPID").and_then(Vdf::int), Some(4242));
        assert_eq!(app.get("name").and_then(Vdf::str), Some("Sky \"Ferry\" Tales"));
        assert_eq!(app.get("LastPlayed").and_then(Vdf::int), Some(1_700_000_000));
        assert_eq!(
            v.at(&["AppState", "UserConfig", "language"]).and_then(Vdf::str),
            Some("german")
        );
    }

    #[test]
    fn a_damaged_file_keeps_what_came_before() {
        let v = parse_vdf("\"a\" \"1\" \"b\" { \"c\" \"2\" ");
        assert_eq!(v.get("a").and_then(Vdf::int), Some(1));
        assert_eq!(v.at(&["b", "c"]).and_then(Vdf::int), Some(2));
        assert_eq!(parse_vdf(""), Vdf::Obj(Vec::new()));
        assert_eq!(parse_vdf("}}}{{"), Vdf::Obj(Vec::new()));
    }
}
