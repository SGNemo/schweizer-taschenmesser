//! The native messaging host: reads requests from the browser (stdin), stamps them with the
//! origin the browser reported, relays them to the app and writes the reply back (stdout).
//!
//! It holds no state, parses nothing but the `id`, and never logs a message. When the app cannot
//! be reached it answers every request itself with `app-not-running`.

use crate::frame::{read_frame, write_frame, MAX_MESSAGE};
use crate::ipc::Stream;
use serde_json::{json, Value};
use std::io::{self, Read, Write};

pub const PROTOCOL_VERSION: u64 = 1;

/// `{"v":1,"id":…,"ok":false,"error":<code>}` – codes only, never data.
pub fn error_reply(id: &str, code: &str) -> Vec<u8> {
    serde_json::to_vec(&json!({ "v": PROTOCOL_VERSION, "id": id, "ok": false, "error": code }))
        .expect("error reply serialises")
}

/// Sets `origin` to the browser-reported value (overwriting anything the sender put there) and
/// returns the request id. `None` when the message is not a JSON object.
pub fn stamp_origin(request: &[u8], origin: &str) -> Option<(Vec<u8>, String)> {
    let mut value: Value = serde_json::from_slice(request).ok()?;
    let object = value.as_object_mut()?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    object.insert("origin".to_owned(), Value::String(origin.to_owned()));
    Some((serde_json::to_vec(&value).ok()?, id))
}

/// Relays until the browser closes stdin. `connect` is called lazily and again after a failure.
pub fn relay<I, O>(
    origin: &str,
    origin_allowed: bool,
    input: &mut I,
    output: &mut O,
    connect: &dyn Fn() -> io::Result<Stream>,
) -> io::Result<()>
where
    I: Read,
    O: Write,
{
    let mut app: Option<Stream> = None;
    while let Some(request) = read_frame(input, MAX_MESSAGE)? {
        let Some((stamped, id)) = stamp_origin(&request, origin) else {
            write_frame(output, &error_reply("", "bad-request"), MAX_MESSAGE)?;
            continue;
        };
        if !origin_allowed {
            write_frame(output, &error_reply(&id, "not-paired"), MAX_MESSAGE)?;
            continue;
        }
        let reply = exchange(&mut app, &stamped, connect);
        write_frame(
            output,
            &reply.unwrap_or_else(|| error_reply(&id, "app-not-running")),
            MAX_MESSAGE,
        )?;
    }
    Ok(())
}

/// One request/response on the (re)connected pipe; `None` when the app cannot be reached.
fn exchange(
    app: &mut Option<Stream>,
    request: &[u8],
    connect: &dyn Fn() -> io::Result<Stream>,
) -> Option<Vec<u8>> {
    for _ in 0..2 {
        if app.is_none() {
            *app = connect().ok();
        }
        let stream = app.as_mut()?;
        let result = write_frame(stream, request, MAX_MESSAGE)
            .and_then(|()| read_frame(stream, MAX_MESSAGE))
            .map(|reply| reply.ok_or_else(|| io::Error::from(io::ErrorKind::UnexpectedEof)));
        match result {
            Ok(Ok(reply)) => return Some(reply),
            _ => *app = None, // stale connection (app restarted): reconnect once
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_from_the_browser_replaces_a_claimed_one() {
        let (bytes, id) = stamp_origin(
            br#"{"v":1,"id":"abc","op":"hello","origin":"chrome-extension://evil/","body":{}}"#,
            "chrome-extension://good/",
        )
        .unwrap();
        let value: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(value["origin"], "chrome-extension://good/");
        assert_eq!(id, "abc");
    }

    #[test]
    fn non_objects_are_not_relayed() {
        assert!(stamp_origin(b"[1,2]", "x").is_none());
        assert!(stamp_origin(b"not json", "x").is_none());
        assert!(stamp_origin(b"\"text\"", "x").is_none());
    }

    #[test]
    fn error_replies_carry_a_code_only() {
        let v: Value = serde_json::from_slice(&error_reply("r1", "app-not-running")).unwrap();
        assert_eq!(v["ok"], false);
        assert_eq!(v["error"], "app-not-running");
        assert_eq!(v["id"], "r1");
        assert_eq!(v.as_object().unwrap().len(), 4);
    }

    fn frames(messages: &[&str]) -> Vec<u8> {
        let mut out = Vec::new();
        for m in messages {
            write_frame(&mut out, m.as_bytes(), MAX_MESSAGE).unwrap();
        }
        out
    }

    fn replies(output: Vec<u8>) -> Vec<Value> {
        let mut cursor = io::Cursor::new(output);
        let mut all = Vec::new();
        while let Some(f) = read_frame(&mut cursor, MAX_MESSAGE).unwrap() {
            all.push(serde_json::from_slice(&f).unwrap());
        }
        all
    }

    #[test]
    fn answers_app_not_running_per_request_when_nothing_listens() {
        let mut input = io::Cursor::new(frames(&[r#"{"id":"1"}"#, r#"{"id":"2"}"#]));
        let mut output = Vec::new();
        let connect = || Err(io::Error::from(io::ErrorKind::NotFound));
        relay(
            "chrome-extension://x/",
            true,
            &mut input,
            &mut output,
            &connect,
        )
        .unwrap();
        let out = replies(output);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0]["error"], "app-not-running");
        assert_eq!(out[1]["id"], "2");
    }

    #[test]
    fn a_disallowed_origin_never_reaches_the_app() {
        let mut input = io::Cursor::new(frames(&[r#"{"id":"1","op":"hello"}"#]));
        let mut output = Vec::new();
        let connect = || -> io::Result<Stream> { panic!("must not connect") };
        relay(
            "chrome-extension://other/",
            false,
            &mut input,
            &mut output,
            &connect,
        )
        .unwrap();
        assert_eq!(replies(output)[0]["error"], "not-paired");
    }

    #[test]
    fn garbage_gets_bad_request() {
        let mut input = io::Cursor::new(frames(&["[]"]));
        let mut output = Vec::new();
        let connect = || Err(io::Error::from(io::ErrorKind::NotFound));
        relay("o", true, &mut input, &mut output, &connect).unwrap();
        assert_eq!(replies(output)[0]["error"], "bad-request");
    }
}
