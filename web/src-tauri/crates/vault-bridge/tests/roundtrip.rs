//! Host ⇄ server over the real per-user channel (a Unix socket on Linux/macOS), with the app side
//! played by a thread that answers each forwarded request.
#![cfg(unix)]

use serde_json::{json, Value};
use std::io::Cursor;
use std::sync::mpsc;
use std::time::Duration;
use vault_bridge::frame::{read_frame, write_frame, MAX_MESSAGE};
use vault_bridge::host::relay;
use vault_bridge::ipc::{connect, Endpoint};
use vault_bridge::server::{Forwarded, Server};

/// Minimal temp dir (no extra dependency): unique per test, removed on drop.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new() -> TempDir {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static N: AtomicUsize = AtomicUsize::new(0);
        let path = std::env::temp_dir().join(format!(
            "vb-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&path).unwrap();
        TempDir(path)
    }
    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn frames(messages: &[Value]) -> Vec<u8> {
    let mut out = Vec::new();
    for m in messages {
        write_frame(&mut out, m.to_string().as_bytes(), MAX_MESSAGE).unwrap();
    }
    out
}

fn replies(output: Vec<u8>) -> Vec<Value> {
    let mut cursor = Cursor::new(output);
    let mut all = Vec::new();
    while let Some(f) = read_frame(&mut cursor, MAX_MESSAGE).unwrap() {
        all.push(serde_json::from_slice(&f).unwrap());
    }
    all
}

/// Starts a server whose "app" echoes the stamped origin back and records the bodies it saw.
fn start(dir: &TempDir) -> (Server, Endpoint, mpsc::Receiver<String>) {
    let endpoint = Endpoint(
        dir.path()
            .join("bridge.sock")
            .to_string_lossy()
            .into_owned(),
    );
    let (seen_tx, seen_rx) = mpsc::channel::<String>();
    let (job_tx, job_rx) = mpsc::channel::<Forwarded>();
    let server = Server::start(endpoint.clone(), move |req| job_tx.send(req).is_ok()).unwrap();
    let responder = server.responder();
    std::thread::spawn(move || {
        while let Ok(req) = job_rx.recv() {
            let body: Value = serde_json::from_str(&req.body).unwrap();
            let _ = seen_tx.send(req.body.clone());
            let reply = json!({
                "v": 1, "id": body["id"], "ok": true,
                "data": { "origin": body["origin"] }
            });
            responder.respond(req.id, reply.to_string());
        }
    });
    (server, endpoint, seen_rx)
}

#[test]
fn relays_requests_and_stamps_the_browser_origin() {
    let dir = TempDir::new();
    let (_server, endpoint, seen) = start(&dir);
    let mut input = Cursor::new(frames(&[
        json!({"v":1,"id":"a","op":"hello","origin":"chrome-extension://claimed/","body":{}}),
        json!({"v":1,"id":"b","op":"status","body":{}}),
    ]));
    let mut output = Vec::new();
    let connector = || connect(&endpoint);
    relay(
        "chrome-extension://real/",
        true,
        &mut input,
        &mut output,
        &connector,
    )
    .unwrap();

    let out = replies(output);
    assert_eq!(out.len(), 2);
    assert_eq!(out[0]["id"], "a");
    assert_eq!(out[0]["data"]["origin"], "chrome-extension://real/");
    assert_eq!(out[1]["data"]["origin"], "chrome-extension://real/");
    let first: Value =
        serde_json::from_str(&seen.recv_timeout(Duration::from_secs(2)).unwrap()).unwrap();
    assert_eq!(first["origin"], "chrome-extension://real/");
}

#[test]
fn the_socket_is_private_to_the_user() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new();
    let (_server, endpoint, _seen) = start(&dir);
    let mode = std::fs::metadata(&endpoint.0).unwrap().permissions().mode();
    assert_eq!(mode & 0o777, 0o600);
}

#[test]
fn a_second_server_cannot_take_over_a_live_channel() {
    let dir = TempDir::new();
    let (_server, endpoint, _seen) = start(&dir);
    assert!(Server::start(endpoint, |_| true).is_err());
}

#[test]
fn unanswered_requests_end_with_an_internal_error_when_the_app_refuses() {
    let dir = TempDir::new();
    let endpoint = Endpoint(dir.path().join("b.sock").to_string_lossy().into_owned());
    let _server = Server::start(endpoint.clone(), |_| false).unwrap(); // app not ready
    let mut input = Cursor::new(frames(&[json!({"v":1,"id":"x","op":"status","body":{}})]));
    let mut output = Vec::new();
    relay("o", true, &mut input, &mut output, &|| connect(&endpoint)).unwrap();
    let out = replies(output);
    assert_eq!(out[0]["error"], "internal");
    assert_eq!(out[0]["id"], "x");
}

#[test]
fn oversize_requests_are_refused_without_a_reply_body() {
    let dir = TempDir::new();
    let (_server, endpoint, seen) = start(&dir);
    let mut stream = connect(&endpoint).unwrap();
    use std::io::Write;
    // Announces more than the cap: the server must drop the connection, not allocate.
    stream
        .write_all(&(MAX_MESSAGE as u32 + 1).to_ne_bytes())
        .unwrap();
    assert!(
        read_frame(&mut stream, MAX_MESSAGE).is_err()
            || read_frame(&mut stream, MAX_MESSAGE).unwrap().is_none()
    );
    assert!(seen.recv_timeout(Duration::from_millis(200)).is_err());
}

#[test]
fn stopping_frees_the_channel() {
    let dir = TempDir::new();
    let (mut server, endpoint, _seen) = start(&dir);
    server.stop();
    assert!(connect(&endpoint).is_err());
    assert!(Server::start(endpoint, |_| true).is_ok());
}
