//! One-shot loopback listener for the OAuth "installed app" flow (RFC 8252): the system browser
//! is sent to the provider, which redirects to `http://127.0.0.1:<port>/callback?code=…&state=…`.
//! Only the small, testable part lives here; PKCE and the token exchange are TypeScript.
//!
//! Two commands because the redirect URI (with the port) must be known before the browser opens:
//! `oauth_listen_start` binds and returns the port, `oauth_listen_wait` waits for the callback.

use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

#[derive(Default)]
pub struct OAuthListener(Mutex<Option<TcpListener>>);

#[derive(Serialize)]
pub struct OAuthCode {
    pub code: String,
}

/// What one HTTP request on the loopback port means.
#[derive(Debug, PartialEq, Eq)]
enum Callback {
    /// Successful redirect with the expected `state`.
    Code(String),
    /// The provider reported an error (`access_denied` …) for the expected `state`.
    Denied(String),
    /// Right path, but the `state` does not match: someone else's request, ignore it.
    WrongState,
    /// Anything else (favicon, scanners …).
    Other,
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => out.push(b' '),
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                match u8::from_str_radix(hex, 16) {
                    Ok(b) => {
                        out.push(b);
                        i += 2;
                    }
                    Err(_) => out.push(b'%'),
                }
            }
            b => out.push(b),
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn classify(request: &str, expected_state: &str) -> Callback {
    let line = request.lines().next().unwrap_or("");
    let mut parts = line.split_whitespace();
    if parts.next() != Some("GET") {
        return Callback::Other;
    }
    let target = parts.next().unwrap_or("");
    let Some((path, query)) = target.split_once('?') else {
        return Callback::Other;
    };
    if path != "/callback" {
        return Callback::Other;
    }
    let (mut code, mut state, mut error) = (None, None, None);
    for pair in query.split('&') {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        match k {
            "code" => code = Some(percent_decode(v)),
            "state" => state = Some(percent_decode(v)),
            "error" => error = Some(percent_decode(v)),
            _ => {}
        }
    }
    // Constant-time-ish is not needed (the state is a one-time random value), but it must match.
    if state.as_deref() != Some(expected_state) {
        return Callback::WrongState;
    }
    if let Some(e) = error {
        return Callback::Denied(e);
    }
    match code {
        Some(c) if !c.is_empty() => Callback::Code(c),
        _ => Callback::Other,
    }
}

const PAGE_OK: &str = "Die Anmeldung ist abgeschlossen. Du kannst dieses Fenster schließen und zu Taschenmesser zurückkehren.";
const PAGE_FAIL: &str =
    "Die Anmeldung wurde nicht abgeschlossen. Du kannst dieses Fenster schließen und es in Taschenmesser erneut versuchen.";

fn respond(stream: &mut TcpStream, status: &str, message: &str) {
    let body = format!(
        "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Taschenmesser</title></head><body style=\"font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem\"><h1>Taschenmesser</h1><p>{message}</p></body></html>"
    );
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.flush();
}

fn read_request(stream: &mut TcpStream) -> String {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = [0u8; 8192];
    let mut len = 0;
    while len < buf.len() {
        match stream.read(&mut buf[len..]) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                len += n;
                if buf[..len].windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
        }
    }
    String::from_utf8_lossy(&buf[..len]).into_owned()
}

/// Binds an ephemeral port on the loopback interface only.
#[tauri::command]
pub fn oauth_listen_start(state: tauri::State<'_, OAuthListener>) -> Result<u16, String> {
    let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
        .map_err(|e| format!("listen-failed: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    *state.0.lock().map_err(|_| "listen-failed")? = Some(listener);
    Ok(port)
}

fn wait_for_callback(
    listener: TcpListener,
    expected_state: &str,
    timeout: Duration,
) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("listen-failed: {e}"))?;
    let deadline = Instant::now() + timeout;
    loop {
        if Instant::now() >= deadline {
            return Err("timeout".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let request = read_request(&mut stream);
                match classify(&request, expected_state) {
                    Callback::Code(code) => {
                        respond(&mut stream, "200 OK", PAGE_OK);
                        return Ok(code);
                    }
                    Callback::Denied(error) => {
                        respond(&mut stream, "200 OK", PAGE_FAIL);
                        return Err(format!("denied: {error}"));
                    }
                    Callback::WrongState | Callback::Other => {
                        respond(&mut stream, "404 Not Found", PAGE_FAIL);
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("listen-failed: {e}")),
        }
    }
}

/// Waits (at most `timeout_secs`) for the browser redirect carrying `expected_state`.
#[tauri::command]
pub async fn oauth_listen_wait(
    state: tauri::State<'_, OAuthListener>,
    expected_state: String,
    timeout_secs: u64,
) -> Result<OAuthCode, String> {
    let listener = state
        .0
        .lock()
        .map_err(|_| "listen-failed")?
        .take()
        .ok_or_else(|| "listen-failed: not started".to_string())?;
    let timeout = Duration::from_secs(timeout_secs.clamp(10, 900));
    let code = tauri::async_runtime::spawn_blocking(move || {
        wait_for_callback(listener, &expected_state, timeout)
    })
    .await
    .map_err(|e| format!("listen-failed: {e}"))??;
    Ok(OAuthCode { code })
}

#[cfg(test)]
mod tests {
    use super::*;

    const REQ: &str =
        "GET /callback?code=4%2FabC-d_e&state=st123&scope=x HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";

    #[test]
    fn accepts_the_code_for_the_expected_state() {
        assert_eq!(classify(REQ, "st123"), Callback::Code("4/abC-d_e".into()));
    }

    #[test]
    fn rejects_a_foreign_state() {
        assert_eq!(classify(REQ, "other"), Callback::WrongState);
    }

    #[test]
    fn reports_a_denied_login() {
        let req = "GET /callback?error=access_denied&state=st123 HTTP/1.1\r\n\r\n";
        assert_eq!(
            classify(req, "st123"),
            Callback::Denied("access_denied".into())
        );
    }

    #[test]
    fn ignores_other_paths_methods_and_missing_code() {
        assert_eq!(
            classify("GET /favicon.ico HTTP/1.1\r\n\r\n", "s"),
            Callback::Other
        );
        assert_eq!(
            classify("POST /callback?code=x&state=s HTTP/1.1\r\n\r\n", "s"),
            Callback::Other
        );
        assert_eq!(
            classify("GET /callback?state=s HTTP/1.1\r\n\r\n", "s"),
            Callback::Other
        );
        assert_eq!(classify("", "s"), Callback::Other);
    }

    #[test]
    fn decodes_percent_escapes_and_plus() {
        assert_eq!(percent_decode("a%20b+c%2"), "a b c%2");
        assert_eq!(percent_decode("%zz"), "%zz");
    }

    #[test]
    fn the_listener_returns_the_code_and_serves_a_german_page() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle =
            std::thread::spawn(move || wait_for_callback(listener, "st9", Duration::from_secs(10)));
        // A stray request first (ignored), then the real redirect.
        let mut stray = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        stray
            .write_all(b"GET /favicon.ico HTTP/1.1\r\n\r\n")
            .unwrap();
        let mut sink = String::new();
        let _ = stray.read_to_string(&mut sink);
        let mut real = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        real.write_all(b"GET /callback?code=abc&state=st9 HTTP/1.1\r\n\r\n")
            .unwrap();
        let mut page = String::new();
        let _ = real.read_to_string(&mut page);
        assert!(page.contains("200 OK") && page.contains("Anmeldung ist abgeschlossen"));
        assert_eq!(handle.join().unwrap(), Ok("abc".to_string()));
    }

    #[test]
    fn the_listener_times_out() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        assert_eq!(
            wait_for_callback(listener, "s", Duration::from_millis(200)),
            Err("timeout".to_string())
        );
    }
}
