use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

/// Bytes written so far and the expected total.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Progress {
    pub done: u64,
    pub total: u64,
}

#[derive(Debug)]
pub enum DownloadError {
    /// Only `https://` is accepted (and `http://127.0.0.1` for tests).
    UnsupportedUrl,
    Http(String),
    Io(String),
    /// The finished file does not have the announced size or SHA-256; it was deleted.
    ChecksumMismatch {
        expected: String,
        actual: String,
    },
    SizeMismatch {
        expected: u64,
        actual: u64,
    },
    Cancelled,
}

impl std::fmt::Display for DownloadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedUrl => write!(f, "unsupported url"),
            Self::Http(e) => write!(f, "http: {e}"),
            Self::Io(e) => write!(f, "io: {e}"),
            Self::ChecksumMismatch { .. } => write!(f, "checksum mismatch"),
            Self::SizeMismatch { .. } => write!(f, "size mismatch"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::error::Error for DownloadError {}

fn part_path(dest: &Path) -> PathBuf {
    let mut name = dest
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(".part");
    dest.with_file_name(name)
}

fn hash_file(path: &Path) -> Result<String, DownloadError> {
    let mut file = File::open(path).map_err(|e| DownloadError::Io(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| DownloadError::Io(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex(&hasher.finalize()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Downloads `url` to `dest` (through `dest.part`, resumed with a `Range` request when a partial
/// file exists), checks the size and the SHA-256 and only then renames it. A file that does not
/// match is deleted, so a model that is on disk has always been verified.
///
/// `on_progress` is called at most every 256 KiB. The call returns `Cancelled` when `cancel` is set
/// (the partial file stays so the user can resume).
pub fn download_verified(
    url: &str,
    dest: &Path,
    expected_sha256: &str,
    expected_size: u64,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(Progress),
) -> Result<(), DownloadError> {
    let local = url.starts_with("http://127.0.0.1") || url.starts_with("http://localhost");
    if !url.starts_with("https://") && !local {
        return Err(DownloadError::UnsupportedUrl);
    }
    if let Some(dir) = dest.parent() {
        fs::create_dir_all(dir).map_err(|e| DownloadError::Io(e.to_string()))?;
    }
    let part = part_path(dest);
    let mut have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    if have > expected_size {
        let _ = fs::remove_file(&part);
        have = 0;
    }

    if have < expected_size {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(None)
            .timeout_connect(Some(std::time::Duration::from_secs(30)))
            .build()
            .into();
        let mut request = agent.get(url);
        if have > 0 {
            request = request.header("Range", format!("bytes={have}-"));
        }
        let response = request
            .call()
            .map_err(|e| DownloadError::Http(e.to_string()))?;
        // 200 = the server ignored the Range header: start over.
        let append = have > 0 && response.status().as_u16() == 206;
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .append(append)
            .truncate(!append)
            .open(&part)
            .map_err(|e| DownloadError::Io(e.to_string()))?;
        let mut done = if append { have } else { 0 };
        let mut body = response.into_body().into_reader();
        let mut buf = vec![0u8; 256 * 1024];
        on_progress(Progress {
            done,
            total: expected_size,
        });
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err(DownloadError::Cancelled);
            }
            let n = body
                .read(&mut buf)
                .map_err(|e| DownloadError::Io(e.to_string()))?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n])
                .map_err(|e| DownloadError::Io(e.to_string()))?;
            done += n as u64;
            on_progress(Progress {
                done,
                total: expected_size,
            });
        }
        file.flush().map_err(|e| DownloadError::Io(e.to_string()))?;
    }

    let size = fs::metadata(&part)
        .map(|m| m.len())
        .map_err(|e| DownloadError::Io(e.to_string()))?;
    if size != expected_size {
        let _ = fs::remove_file(&part);
        return Err(DownloadError::SizeMismatch {
            expected: expected_size,
            actual: size,
        });
    }
    let actual = hash_file(&part)?;
    if !actual.eq_ignore_ascii_case(expected_sha256) {
        let _ = fs::remove_file(&part);
        return Err(DownloadError::ChecksumMismatch {
            expected: expected_sha256.to_lowercase(),
            actual,
        });
    }
    fs::rename(&part, dest).map_err(|e| DownloadError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::net::TcpListener;
    use std::thread;

    /// A one-shot local HTTP server that honours `Range` and serves `body`.
    fn serve(body: Vec<u8>) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!(
            "http://127.0.0.1:{}/model.gguf",
            listener.local_addr().unwrap().port()
        );
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut start = 0usize;
            loop {
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                if line == "\r\n" || line.is_empty() {
                    break;
                }
                if let Some(v) = line.to_ascii_lowercase().strip_prefix("range: bytes=") {
                    start = v.trim().trim_end_matches('-').parse().unwrap();
                }
            }
            let (status, payload) = if start > 0 {
                ("206 Partial Content", &body[start..])
            } else {
                ("200 OK", &body[..])
            };
            let head = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                payload.len()
            );
            stream.write_all(head.as_bytes()).unwrap();
            stream.write_all(payload).unwrap();
        });
        (url, handle)
    }

    fn sha(bytes: &[u8]) -> String {
        hex(&Sha256::digest(bytes))
    }

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("nemo-llm-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn keeps_a_file_that_matches() {
        let body: Vec<u8> = (0..300_000u32).map(|i| (i % 251) as u8).collect();
        let (url, server) = serve(body.clone());
        let dest = temp("ok").join("m.gguf");
        let mut last = Progress { done: 0, total: 0 };
        download_verified(
            &url,
            &dest,
            &sha(&body),
            body.len() as u64,
            &AtomicBool::new(false),
            |p| last = p,
        )
        .unwrap();
        server.join().unwrap();
        assert_eq!(fs::read(&dest).unwrap(), body);
        assert_eq!(
            last,
            Progress {
                done: body.len() as u64,
                total: body.len() as u64
            }
        );
        assert!(!part_path(&dest).exists());
    }

    #[test]
    fn deletes_a_file_with_the_wrong_checksum() {
        let body = vec![7u8; 10_000];
        let (url, server) = serve(body.clone());
        let dest = temp("bad").join("m.gguf");
        let err = download_verified(
            &url,
            &dest,
            &sha(b"something else"),
            10_000,
            &AtomicBool::new(false),
            |_| {},
        )
        .unwrap_err();
        server.join().unwrap();
        assert!(matches!(err, DownloadError::ChecksumMismatch { .. }));
        assert!(!dest.exists() && !part_path(&dest).exists());
    }

    #[test]
    fn deletes_a_file_with_the_wrong_size() {
        let body = vec![1u8; 4_000];
        let (url, server) = serve(body.clone());
        let dest = temp("size").join("m.gguf");
        let err = download_verified(
            &url,
            &dest,
            &sha(&body),
            5_000,
            &AtomicBool::new(false),
            |_| {},
        )
        .unwrap_err();
        server.join().unwrap();
        assert!(matches!(
            err,
            DownloadError::SizeMismatch {
                expected: 5_000,
                actual: 4_000
            }
        ));
        assert!(!dest.exists() && !part_path(&dest).exists());
    }

    #[test]
    fn resumes_a_partial_file() {
        let body: Vec<u8> = (0..120_000u32).map(|i| (i % 199) as u8).collect();
        let dest = temp("resume").join("m.gguf");
        fs::create_dir_all(dest.parent().unwrap()).unwrap();
        fs::write(part_path(&dest), &body[..50_000]).unwrap();
        let (url, server) = serve(body.clone());
        download_verified(
            &url,
            &dest,
            &sha(&body),
            body.len() as u64,
            &AtomicBool::new(false),
            |_| {},
        )
        .unwrap();
        server.join().unwrap();
        assert_eq!(fs::read(&dest).unwrap(), body);
    }

    #[test]
    fn refuses_plain_http_to_the_internet_and_stops_on_cancel() {
        let dest = temp("url").join("m.gguf");
        let no = AtomicBool::new(false);
        assert!(matches!(
            download_verified("http://example.org/m.gguf", &dest, "00", 1, &no, |_| {}),
            Err(DownloadError::UnsupportedUrl)
        ));
        let body = vec![3u8; 1_000_000];
        let (url, server) = serve(body.clone());
        let yes = AtomicBool::new(true);
        let err = download_verified(&url, &dest, &sha(&body), 1_000_000, &yes, |_| {}).unwrap_err();
        assert!(matches!(err, DownloadError::Cancelled));
        assert!(!dest.exists());
        drop(server); // the server thread ends when its connection closes
    }
}
