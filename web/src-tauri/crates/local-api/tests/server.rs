//! Socket round trips against a real server on an ephemeral loopback port.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use local_api::{bind_addr, sha256, Forwarded, Limits, Reply, Server, TokenEntry};

type Slot = Arc<Mutex<Option<Server>>>;
type Seen = Arc<Mutex<Vec<Forwarded>>>;

const TOKEN: &str = "tm_test-token-made-up";

fn tokens() -> Vec<TokenEntry> {
    vec![
        TokenEntry {
            id: "t1".into(),
            hash: sha256(TOKEN.as_bytes()),
            expires_at_ms: None,
        },
        TokenEntry {
            id: "old".into(),
            hash: sha256(b"tm_expired"),
            expires_at_ms: Some(1),
        },
    ]
}

/// Starts a server whose "app" echoes the forwarded request as JSON (via `respond`).
fn start(limits: Limits) -> (Slot, u16, Seen) {
    let slot: Slot = Arc::new(Mutex::new(None));
    let seen: Seen = Arc::new(Mutex::new(Vec::new()));
    let (slot2, seen2) = (Arc::clone(&slot), Arc::clone(&seen));
    let server = Server::start(0, tokens(), limits, move |req: Forwarded| {
        seen2.lock().unwrap().push(req.clone());
        let slot = Arc::clone(&slot2);
        // Answer from another thread, like the app does through a Tauri command.
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(5));
            let body = format!(
                "{{\"path\":\"{}\",\"token\":\"{}\",\"body\":{:?}}}",
                req.path, req.token_id, req.body
            );
            let guard = slot.lock().unwrap();
            guard
                .as_ref()
                .unwrap()
                .respond(req.id, Reply { status: 200, body });
        });
        true
    })
    .unwrap();
    let port = server.local_addr().port();
    *slot.lock().unwrap() = Some(server);
    (slot, port, seen)
}

fn send(port: u16, raw: &str) -> (u16, String) {
    let mut stream = TcpStream::connect(bind_addr(port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    stream.write_all(raw.as_bytes()).unwrap();
    let mut out = String::new();
    let _ = stream.read_to_string(&mut out);
    let status = out
        .split(' ')
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    (status, out)
}

fn get(port: u16, path: &str, extra: &str) -> (u16, String) {
    send(
        port,
        &format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{extra}\r\n"),
    )
}

fn auth() -> String {
    format!("Authorization: Bearer {TOKEN}\r\n")
}

#[test]
fn binds_loopback_only() {
    assert!(bind_addr(8080).ip().is_loopback());
    let (slot, _port, _) = start(Limits::default());
    let addr = slot.lock().unwrap().as_ref().unwrap().local_addr();
    assert!(addr.ip().is_loopback());
    assert!(!addr.ip().is_unspecified());
}

#[test]
fn forwards_authenticated_requests_without_the_token() {
    let (_slot, port, seen) = start(Limits::default());
    let (status, out) = get(port, "/v1/modules?x=1", &auth());
    assert_eq!(status, 200, "{out}");
    assert!(out.contains("\"token\":\"t1\""));
    assert!(out.contains("Cache-Control: no-store"));
    assert!(!out.to_ascii_lowercase().contains("access-control"));
    {
        let seen = seen.lock().unwrap();
        assert_eq!(seen[0].query, "x=1");
        assert!(!format!("{:?}", seen[0]).contains(TOKEN));
    }

    // localhost works too
    let (status, _) = send(
        port,
        &format!(
            "GET /v1/modules HTTP/1.1\r\nHost: localhost:{port}\r\n{}\r\n",
            auth()
        ),
    );
    assert_eq!(status, 200);
}

#[test]
fn post_needs_json_and_passes_the_body() {
    let (_slot, port, _) = start(Limits::default());
    let body = "{\"items\":[]}";
    let (status, out) = send(
        port,
        &format!(
            "POST /v1/todos/import HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}Content-Type: application/json\r\nIdempotency-Key: k-1\r\nContent-Length: {}\r\n\r\n{body}",
            auth(),
            body.len()
        ),
    );
    assert_eq!(status, 200, "{out}");
    assert!(out.contains("items"));
    let (status, _) = send(
        port,
        &format!(
            "POST /v1/todos/import HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}Content-Type: text/plain\r\nContent-Length: 2\r\n\r\n{{}}",
            auth()
        ),
    );
    assert_eq!(status, 415);
}

#[test]
fn rejects_missing_wrong_and_expired_tokens() {
    let (_slot, port, seen) = start(Limits::default());
    assert_eq!(get(port, "/v1/modules", "").0, 401);
    assert_eq!(
        get(port, "/v1/modules", "Authorization: Bearer tm_wrong\r\n").0,
        401
    );
    let (status, out) = get(port, "/v1/modules", "Authorization: Bearer tm_expired\r\n");
    assert_eq!(status, 401);
    assert!(out.contains("token-expired"));
    assert!(seen.lock().unwrap().is_empty());
}

#[test]
fn revoked_tokens_stop_working_immediately() {
    let (slot, port, _) = start(Limits::default());
    assert_eq!(get(port, "/v1/modules", &auth()).0, 200);
    slot.lock().unwrap().as_ref().unwrap().set_tokens(vec![]);
    assert_eq!(get(port, "/v1/modules", &auth()).0, 401);
}

#[test]
fn rejects_foreign_host_and_browser_origins() {
    let (_slot, port, seen) = start(Limits::default());
    let wrong_host = send(
        port,
        &format!(
            "GET /v1/modules HTTP/1.1\r\nHost: evil.example:{port}\r\n{}\r\n",
            auth()
        ),
    );
    assert_eq!(wrong_host.0, 421);
    let wrong_port = send(
        port,
        &format!(
            "GET /v1/modules HTTP/1.1\r\nHost: 127.0.0.1:1\r\n{}\r\n",
            auth()
        ),
    );
    assert_eq!(wrong_port.0, 421);
    let no_host = send(port, &format!("GET /v1/modules HTTP/1.1\r\n{}\r\n", auth()));
    assert_eq!(no_host.0, 421);
    let origin = get(
        port,
        "/v1/modules",
        &format!("{}Origin: https://evil.example\r\n", auth()),
    );
    assert_eq!(origin.0, 403);
    let fetch = get(
        port,
        "/v1/modules",
        &format!("{}Sec-Fetch-Site: cross-site\r\n", auth()),
    );
    assert_eq!(fetch.0, 403);
    let options = send(
        port,
        &format!("OPTIONS /v1/modules HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nOrigin: https://evil.example\r\n\r\n"),
    );
    assert_eq!(options.0, 403);
    assert!(!options.1.to_ascii_lowercase().contains("access-control"));
    assert!(seen.lock().unwrap().is_empty());
}

#[test]
fn rejects_oversized_bodies_and_chunked_encoding() {
    let limits = Limits {
        max_body_bytes: 16,
        ..Limits::default()
    };
    let (_slot, port, _) = start(limits);
    let (status, _) = send(
        port,
        &format!(
            "POST /v1/todos/import HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}Content-Type: application/json\r\nContent-Length: 17\r\n\r\n{}",
            auth(),
            "x".repeat(17)
        ),
    );
    assert_eq!(status, 413);
    let (status, _) = send(
        port,
        &format!(
            "POST /v1/todos/import HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}Transfer-Encoding: chunked\r\n\r\n0\r\n\r\n",
            auth()
        ),
    );
    assert_eq!(status, 411);
}

#[test]
fn limits_requests_per_token_and_failed_logins() {
    let limits = Limits {
        requests_per_minute: 2,
        auth_failures_per_minute: 2,
        ..Limits::default()
    };
    let (_slot, port, _) = start(limits);
    assert_eq!(get(port, "/v1/modules", &auth()).0, 200);
    assert_eq!(get(port, "/v1/modules", &auth()).0, 200);
    assert_eq!(get(port, "/v1/modules", &auth()).0, 429);

    assert_eq!(
        get(port, "/v1/modules", "Authorization: Bearer tm_x\r\n").0,
        401
    );
    assert_eq!(
        get(port, "/v1/modules", "Authorization: Bearer tm_y\r\n").0,
        401
    );
    // Guessing is over for this minute – even the right token is refused now.
    assert_eq!(
        get(port, "/v1/modules", "Authorization: Bearer tm_z\r\n").0,
        429
    );
}

#[test]
fn unknown_paths_and_methods() {
    let (_slot, port, _) = start(Limits::default());
    assert_eq!(get(port, "/", &auth()).0, 404);
    let put = send(
        port,
        &format!(
            "PUT /v1/modules HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}\r\n",
            auth()
        ),
    );
    assert_eq!(put.0, 405);
}

#[test]
fn app_not_answering_times_out_and_missing_app_is_unavailable() {
    let limits = Limits {
        response_timeout: Duration::from_millis(100),
        ..Limits::default()
    };
    let silent = Server::start(0, tokens(), limits.clone(), |_req| true).unwrap();
    let port = silent.local_addr().port();
    assert_eq!(get(port, "/v1/modules", &auth()).0, 504);
    let absent = Server::start(0, tokens(), limits, |_req| false).unwrap();
    let port = absent.local_addr().port();
    assert_eq!(get(port, "/v1/modules", &auth()).0, 503);
    silent.stop();
}

#[test]
fn stop_frees_the_port() {
    let server = Server::start(0, tokens(), Limits::default(), |_req| false).unwrap();
    let port = server.local_addr().port();
    server.stop();
    assert!(TcpStream::connect(bind_addr(port)).is_err());
}

#[test]
fn large_bodies_with_expect_continue_do_not_wait() {
    let (_slot, port, _) = start(Limits::default());
    let body = format!("{{\"items\":[\"{}\"]}}", "x".repeat(4000));
    let mut stream = TcpStream::connect(bind_addr(port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .unwrap();
    stream
        .write_all(
            format!(
                "POST /v1/todos/import HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}Content-Type: application/json\r\nExpect: 100-continue\r\nContent-Length: {}\r\n\r\n",
                auth(),
                body.len()
            )
            .as_bytes(),
        )
        .unwrap();
    let mut first = [0u8; 25];
    stream.read_exact(&mut first).unwrap();
    assert_eq!(&first, b"HTTP/1.1 100 Continue\r\n\r\n");
    stream.write_all(body.as_bytes()).unwrap();
    let mut out = String::new();
    let _ = stream.read_to_string(&mut out);
    assert!(out.starts_with("HTTP/1.1 200"), "{out}");
}

#[test]
fn a_slow_trickle_cannot_hold_a_connection() {
    let limits = Limits {
        request_deadline: Duration::from_millis(300),
        ..Limits::default()
    };
    let (_slot, port, _) = start(limits);
    let mut stream = TcpStream::connect(bind_addr(port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
    let started = std::time::Instant::now();
    let head = format!("GET /v1/modules HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n");
    for byte in head.bytes() {
        if stream.write_all(&[byte]).is_err() {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
        if started.elapsed() > Duration::from_secs(2) {
            break;
        }
    }
    let mut out = String::new();
    let _ = stream.read_to_string(&mut out);
    assert!(out.starts_with("HTTP/1.1 408"), "{out}");
    assert!(started.elapsed() < Duration::from_secs(2));
}
