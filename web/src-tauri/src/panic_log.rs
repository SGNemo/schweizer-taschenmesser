//! Panic log for the diagnostics export: a panic on the Rust side leaves one short line in
//! `<data folder>/logs/panic.log` (time, source line, message cut to 200 characters). The file is
//! rotated at 64 KiB (one `panic.log.1` is kept). The next start hands it to the webview once
//! (`desktop_take_panic_log`), which scrubs it and adds it to the diagnostics buffer; nothing is
//! sent anywhere. Messages can only come from the program's own code, never from user entries.

use std::fs;
use std::io::Write;
use std::panic;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const FILE: &str = "panic.log";
const MAX_BYTES: u64 = 64 * 1024;
const MAX_MESSAGE: usize = 200;

/// One log line: `<unix seconds> <file>:<line> <message>`; the file keeps only its last two path
/// parts so no build machine path ends up in a report.
pub fn format_line(unix: u64, location: Option<(&str, u32)>, message: &str) -> String {
    let place = match location {
        Some((file, line)) => {
            let parts: Vec<&str> = file.split(['/', '\\']).collect();
            let tail = parts[parts.len().saturating_sub(2)..].join("/");
            format!("{tail}:{line}")
        }
        None => "unknown".to_string(),
    };
    let message: String = message
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .take(MAX_MESSAGE)
        .collect();
    format!("{unix} {place} {message}\n")
}

/// Appends a line; moves the file to `panic.log.1` first when it would grow past the limit.
pub fn append(dir: &Path, line: &str) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    let file = dir.join(FILE);
    if fs::metadata(&file).map(|m| m.len()).unwrap_or(0) + line.len() as u64 > MAX_BYTES {
        let _ = fs::remove_file(dir.join(format!("{FILE}.1")));
        fs::rename(&file, dir.join(format!("{FILE}.1")))?;
    }
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(file)?
        .write_all(line.as_bytes())
}

/// Reads and removes the log (both files, oldest first). `None` when there is nothing.
pub fn take(dir: &Path) -> Option<String> {
    let mut text = String::new();
    for name in [format!("{FILE}.1"), FILE.to_string()] {
        let path = dir.join(name);
        if let Ok(part) = fs::read_to_string(&path) {
            text.push_str(&part);
            let _ = fs::remove_file(&path);
        }
    }
    (!text.is_empty()).then_some(text)
}

fn describe(
    payload: &(dyn std::any::Any + Send),
    location: Option<&panic::Location<'_>>,
) -> String {
    let message = payload
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "panic".to_string());
    let unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format_line(unix, location.map(|l| (l.file(), l.line())), &message)
}

/// Writes every later panic into `dir`, then runs the previous hook (the default one prints to stderr).
pub fn install(dir: PathBuf) {
    let previous = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        let _ = append(&dir, &describe(info.payload(), info.location()));
        previous(info);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nemo-panic-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn line_has_no_build_machine_path_and_is_cut() {
        let line = format_line(
            1_790_000_000,
            Some(("C:\\Users\\erika\\src\\build\\src\\capture.rs", 42)),
            &"x".repeat(500),
        );
        assert!(line.starts_with("1790000000 src/capture.rs:42 "));
        assert!(!line.contains("erika"));
        assert!(line.len() < 260);
        assert!(line.ends_with('\n'));
    }

    #[test]
    fn control_characters_cannot_break_the_line_format() {
        let line = format_line(1, None, "a\nb\r\tc");
        assert_eq!(line, "1 unknown a b  c\n");
    }

    #[test]
    fn append_then_take_returns_everything_once() {
        let dir = temp("take");
        append(&dir, "1 a:1 one\n").unwrap();
        append(&dir, "2 b:2 two\n").unwrap();
        assert_eq!(take(&dir).unwrap(), "1 a:1 one\n2 b:2 two\n");
        assert!(take(&dir).is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rotates_at_the_size_limit_and_keeps_one_old_file() {
        let dir = temp("rotate");
        let big = format!("{}\n", "y".repeat(40_000));
        append(&dir, &big).unwrap();
        append(&dir, &big).unwrap(); // would exceed 64 KiB: first one moves to .1
        assert!(dir.join("panic.log.1").exists());
        assert!(fs::metadata(dir.join("panic.log")).unwrap().len() < MAX_BYTES);
        append(&dir, &big).unwrap();
        append(&dir, &big).unwrap();
        // still only the two files
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 2);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_folder_is_created_and_nothing_to_take_is_none() {
        let dir = temp("missing").join("logs");
        assert!(take(&dir).is_none());
        append(&dir, "1 a:1 x\n").unwrap();
        assert!(dir.join("panic.log").exists());
        let _ = fs::remove_dir_all(dir.parent().unwrap());
    }
}
