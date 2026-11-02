//! Download manager against a local HTTP server (Range, Content-Disposition, 404). No network.

use std::{
    io::{BufRead, BufReader, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use downloader::{AddError, HashCheck, Job, Manager, State};
use sha2::{Digest, Sha256};

struct Server {
    base: String,
    ranges: Arc<Mutex<Vec<String>>>,
}

/// Serves `/data.bin` (honours `Range: bytes=N-`), `/cd` (same body, `Content-Disposition`), 404 else.
fn serve(body: Vec<u8>) -> Server {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
    let ranges = Arc::new(Mutex::new(Vec::new()));
    let seen = ranges.clone();
    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let body = body.clone();
            let seen = seen.clone();
            thread::spawn(move || {
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut request = String::new();
                reader.read_line(&mut request).unwrap();
                let path = request.split_whitespace().nth(1).unwrap_or("/").to_string();
                let mut start = 0usize;
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap_or(0) == 0 || line == "\r\n" {
                        break;
                    }
                    if let Some(v) = line.to_ascii_lowercase().strip_prefix("range: bytes=") {
                        seen.lock().unwrap().push(v.trim().to_string());
                        start = v.trim().trim_end_matches('-').parse().unwrap_or(0);
                    }
                }
                if path != "/data.bin" && path != "/cd" {
                    let _ = stream.write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    );
                    return;
                }
                let extra = if path == "/cd" {
                    "Content-Disposition: attachment; filename=\"named.bin\"\r\n"
                } else {
                    ""
                };
                let head = if start > 0 {
                    format!(
                        "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {}-{}/{}\r\nContent-Length: {}\r\n{extra}Connection: close\r\n\r\n",
                        start,
                        body.len() - 1,
                        body.len(),
                        body.len() - start
                    )
                } else {
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\n{extra}Connection: close\r\n\r\n",
                        body.len()
                    )
                };
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(&body[start..]);
            });
        }
    });
    Server { base, ranges }
}

fn body(len: usize) -> Vec<u8> {
    (0..len).map(|i| (i * 31 % 251) as u8).collect()
}

fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

struct Env {
    root: PathBuf,
    dir: PathBuf,
    state: PathBuf,
}

fn env(name: &str) -> Env {
    let root = std::env::temp_dir().join(format!("dl-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let dir = root.join("files");
    std::fs::create_dir_all(&dir).unwrap();
    Env {
        state: root.join("downloads.json"),
        dir,
        root,
    }
}

fn open(e: &Env) -> Manager {
    Manager::open(e.state.clone(), Arc::new(|| {}))
}

fn wait(m: &Manager, id: u64, what: &str, ok: impl Fn(&Job) -> bool) -> Job {
    let end = Instant::now() + Duration::from_secs(20);
    loop {
        if let Some(j) = m.snapshot().into_iter().find(|j| j.id == id) {
            if ok(&j) {
                return j;
            }
        }
        assert!(Instant::now() < end, "timeout waiting for {what}");
        thread::sleep(Duration::from_millis(20));
    }
}

fn done(m: &Manager, id: u64) -> Job {
    wait(m, id, "done", |j| j.state == State::Done)
}

fn files(dir: &Path) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    v.sort();
    v
}

#[test]
fn downloads_and_shows_the_checksum() {
    let e = env("basic");
    let data = body(200_000);
    let s = serve(data.clone());
    let m = open(&e);
    let job = m
        .add(&format!("{}/data.bin", s.base), &e.dir, None)
        .unwrap();
    let j = done(&m, job.id);
    assert_eq!(std::fs::read(e.dir.join("data.bin")).unwrap(), data);
    assert_eq!(j.sha256.as_deref(), Some(sha(&data).as_str()));
    assert_eq!(j.total, Some(200_000));
    assert_eq!(files(&e.dir), ["data.bin"], "no .part file is left");
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn pasted_hash_is_checked_and_a_wrong_file_is_deleted() {
    let e = env("hash");
    let data = body(50_000);
    let s = serve(data.clone());
    let m = open(&e);
    let url = format!("{}/data.bin", s.base);
    let ok = m
        .add(&url, &e.dir, Some(&sha(&data).to_uppercase()))
        .unwrap();
    assert_eq!(done(&m, ok.id).hash_check, Some(HashCheck::Match));
    let bad = m.add(&url, &e.dir, Some(&"0".repeat(64))).unwrap();
    let j = wait(&m, bad.id, "failure", |j| j.state == State::Failed);
    assert_eq!(j.error.as_deref(), Some("checksum"));
    assert_eq!(j.hash_check, Some(HashCheck::Mismatch));
    assert_eq!(files(&e.dir), ["data.bin"], "the mismatching file is gone");
    // Later check of a finished file.
    m.verify(ok.id, &"1".repeat(64)).unwrap();
    wait(&m, ok.id, "verify", |j| {
        j.hash_check == Some(HashCheck::Mismatch)
    });
    assert_eq!(m.verify(ok.id, "abc"), Err(AddError::Hash));
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn pause_then_resume_after_a_restart_uses_a_range_request() {
    let e = env("resume");
    let data = body(300_000);
    let s = serve(data.clone());
    let m = open(&e);
    m.set_global_limit(100_000);
    let job = m
        .add(&format!("{}/data.bin", s.base), &e.dir, None)
        .unwrap();
    wait(&m, job.id, "some progress", |j| j.done >= 64 * 1024);
    m.pause(job.id);
    let paused = wait(&m, job.id, "paused", |j| j.state == State::Paused);
    assert!(paused.done < 300_000);
    let part = e.dir.join("data.bin.part");
    let have = std::fs::metadata(&part).unwrap().len();
    assert!(have > 0 && have < 300_000);
    drop(m);

    // "Restart": a new manager reads the saved list. The job waits; it does not start by itself.
    let m = open(&e);
    let back = m.snapshot().into_iter().find(|j| j.id == job.id).unwrap();
    assert_eq!(back.state, State::Paused);
    assert_eq!(back.done, have);
    assert_eq!(m.global_limit(), 100_000, "the limit is remembered");
    m.set_global_limit(0);
    m.resume(job.id);
    done(&m, job.id);
    assert_eq!(std::fs::read(e.dir.join("data.bin")).unwrap(), data);
    assert!(
        s.ranges
            .lock()
            .unwrap()
            .iter()
            .any(|r| r.starts_with(&format!("{have}-"))),
        "resumed with Range from {have}: {:?}",
        s.ranges.lock().unwrap()
    );
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn a_job_that_was_running_when_the_program_ended_comes_back_paused() {
    let e = env("crash");
    std::fs::write(e.dir.join("big.iso.part"), vec![7u8; 4096]).unwrap();
    let saved = serde_json::json!({
        "next_id": 5, "global_bps": 0,
        "jobs": [{
            "id": 4, "url": "http://127.0.0.1:9/big.iso", "fileName": "big.iso",
            "dir": e.dir, "state": "running", "done": 100, "total": 9999, "limitBps": 0,
            "error": null, "sha256": null, "expectedHash": null, "hashCheck": null
        }]
    });
    std::fs::write(&e.state, saved.to_string()).unwrap();
    let m = open(&e);
    let j = &m.snapshot()[0];
    assert_eq!((j.state, j.done), (State::Paused, 4096));
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn speed_limit_slows_the_download_down() {
    let e = env("limit");
    let s = serve(body(200_000));
    let m = open(&e);
    m.set_global_limit(100_000);
    let t = Instant::now();
    let job = m
        .add(&format!("{}/data.bin", s.base), &e.dir, None)
        .unwrap();
    done(&m, job.id);
    assert!(
        t.elapsed() >= Duration::from_millis(1200),
        "took {:?}",
        t.elapsed()
    );
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn remove_with_and_without_data() {
    let e = env("remove");
    let s = serve(body(20_000));
    let m = open(&e);
    let url = format!("{}/data.bin", s.base);
    let a = m.add(&url, &e.dir, None).unwrap();
    done(&m, a.id);
    let b = m.add(&url, &e.dir, None).unwrap();
    done(&m, b.id);
    assert_eq!(files(&e.dir), ["data (1).bin", "data.bin"]);
    m.remove(a.id, false);
    m.remove(b.id, true);
    assert!(m.snapshot().is_empty());
    assert_eq!(
        files(&e.dir),
        ["data.bin"],
        "only the one removed with its data is gone"
    );

    // A running job removed with data takes its partial file along.
    m.set_global_limit(20_000);
    let c = m.add(&url, &e.dir, None).unwrap();
    wait(&m, c.id, "running", |j| {
        j.done > 0 || j.state == State::Running
    });
    thread::sleep(Duration::from_millis(100));
    m.remove(c.id, true);
    let end = Instant::now() + Duration::from_secs(10);
    while files(&e.dir).iter().any(|f| f.ends_with(".part")) {
        assert!(Instant::now() < end, "partial file still there");
        thread::sleep(Duration::from_millis(50));
    }
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn never_overwrites_and_takes_the_server_file_name() {
    let e = env("names");
    std::fs::write(e.dir.join("data.bin"), b"old").unwrap();
    let s = serve(body(1000));
    let m = open(&e);
    let a = m
        .add(&format!("{}/data.bin", s.base), &e.dir, None)
        .unwrap();
    assert_eq!(a.file_name, "data (1).bin");
    done(&m, a.id);
    assert_eq!(std::fs::read(e.dir.join("data.bin")).unwrap(), b"old");
    let b = m.add(&format!("{}/cd", s.base), &e.dir, None).unwrap();
    assert_eq!(done(&m, b.id).file_name, "named.bin");
    let _ = std::fs::remove_dir_all(e.root);
}

#[test]
fn only_http_and_existing_folders_and_a_missing_page_fails() {
    let e = env("reject");
    let s = serve(body(10));
    let m = open(&e);
    let add = |u: &str, d: &Path| m.add(u, d, None).map(|_| ());
    assert_eq!(add("ftp://x.test/a", &e.dir), Err(AddError::Scheme));
    assert_eq!(add("file:///etc/passwd", &e.dir), Err(AddError::Scheme));
    assert_eq!(add("not a url", &e.dir), Err(AddError::Url));
    assert_eq!(
        add("https://x.test/a", Path::new("relative")),
        Err(AddError::Dir)
    );
    assert_eq!(
        add("https://x.test/a", &e.root.join("missing")),
        Err(AddError::Dir)
    );
    assert_eq!(
        m.add("https://x.test/a", &e.dir, Some("xyz")).map(|_| ()),
        Err(AddError::Hash)
    );
    let missing = m.add(&format!("{}/nope", s.base), &e.dir, None).unwrap();
    let j = wait(&m, missing.id, "failure", |j| j.state == State::Failed);
    assert_eq!(j.error.as_deref(), Some("http"));
    assert!(files(&e.dir).is_empty());
    let _ = std::fs::remove_dir_all(e.root);
}
