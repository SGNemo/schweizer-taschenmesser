//! A deliberately small HTTP/1.1 request reader: one request per connection, header block limited,
//! body only with a single `Content-Length` (no chunked encoding), everything else rejected.

use std::io::{ErrorKind, Read};

const MAX_HEADERS: usize = 32;

#[derive(Debug, PartialEq, Eq)]
pub struct Request {
    pub method: String,
    /// Path without the query string.
    pub path: String,
    /// Raw query string (without `?`), empty when absent.
    pub query: String,
    /// Lower-cased names.
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Request {
    /// Value of a header; `Err` when it occurs more than once (ambiguous → reject).
    pub fn header(&self, name: &str) -> Result<Option<&str>, ()> {
        let mut found = None;
        for (k, v) in &self.headers {
            if k == name {
                if found.is_some() {
                    return Err(());
                }
                found = Some(v.as_str());
            }
        }
        Ok(found)
    }

    pub fn has_header(&self, name: &str) -> bool {
        self.headers.iter().any(|(k, _)| k == name)
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum ReadError {
    /// The peer closed or timed out before sending a complete head: answer nothing.
    Closed,
    Timeout,
    BadRequest,
    HeadersTooLarge,
    LengthRequired,
    BodyTooLarge,
}

impl ReadError {
    /// Status code and error code for the response (`None` = just close).
    pub fn response(&self) -> Option<(u16, &'static str)> {
        match self {
            ReadError::Closed => None,
            ReadError::Timeout => Some((408, "timeout")),
            ReadError::BadRequest => Some((400, "bad-request")),
            ReadError::HeadersTooLarge => Some((431, "headers-too-large")),
            ReadError::LengthRequired => Some((411, "length-required")),
            ReadError::BodyTooLarge => Some((413, "body-too-large")),
        }
    }
}

fn io_error(e: std::io::Error) -> ReadError {
    match e.kind() {
        ErrorKind::WouldBlock | ErrorKind::TimedOut => ReadError::Timeout,
        _ => ReadError::Closed,
    }
}

fn find_head_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n").map(|i| i + 4)
}

pub fn read_request(
    stream: &mut impl Read,
    max_header_bytes: usize,
    max_body_bytes: usize,
) -> Result<Request, ReadError> {
    let mut buf: Vec<u8> = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    let head_end = loop {
        if let Some(end) = find_head_end(&buf) {
            break end;
        }
        if buf.len() > max_header_bytes {
            return Err(ReadError::HeadersTooLarge);
        }
        let n = stream.read(&mut chunk).map_err(|e| {
            if buf.is_empty()
                && e.kind() != ErrorKind::WouldBlock
                && e.kind() != ErrorKind::TimedOut
            {
                ReadError::Closed
            } else {
                io_error(e)
            }
        })?;
        if n == 0 {
            return Err(if buf.is_empty() {
                ReadError::Closed
            } else {
                ReadError::BadRequest
            });
        }
        buf.extend_from_slice(&chunk[..n]);
    };
    if head_end > max_header_bytes {
        return Err(ReadError::HeadersTooLarge);
    }

    let mut raw_headers = [httparse::EMPTY_HEADER; MAX_HEADERS];
    let mut parsed = httparse::Request::new(&mut raw_headers);
    match parsed.parse(&buf[..head_end]) {
        Ok(httparse::Status::Complete(_)) => {}
        Err(httparse::Error::TooManyHeaders) => return Err(ReadError::HeadersTooLarge),
        _ => return Err(ReadError::BadRequest),
    }
    if parsed.version != Some(1) {
        return Err(ReadError::BadRequest);
    }
    let method = parsed.method.ok_or(ReadError::BadRequest)?.to_owned();
    let target = parsed.path.ok_or(ReadError::BadRequest)?;
    if !target.starts_with('/') {
        return Err(ReadError::BadRequest);
    }
    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p.to_owned(), q.to_owned()),
        None => (target.to_owned(), String::new()),
    };
    let mut headers = Vec::with_capacity(parsed.headers.len());
    for h in parsed.headers.iter() {
        let value = std::str::from_utf8(h.value).map_err(|_| ReadError::BadRequest)?;
        headers.push((h.name.to_ascii_lowercase(), value.trim().to_owned()));
    }
    let mut request = Request {
        method,
        path,
        query,
        headers,
        body: Vec::new(),
    };

    if request.has_header("transfer-encoding") {
        return Err(ReadError::LengthRequired);
    }
    let length = match request.header("content-length") {
        Err(()) => return Err(ReadError::BadRequest),
        Ok(None) => 0,
        Ok(Some(v)) => {
            if v.is_empty() || !v.bytes().all(|b| b.is_ascii_digit()) {
                return Err(ReadError::BadRequest);
            }
            v.parse::<usize>().map_err(|_| ReadError::BodyTooLarge)?
        }
    };
    if length > max_body_bytes {
        return Err(ReadError::BodyTooLarge);
    }
    let mut body = buf[head_end..].to_vec();
    body.truncate(length);
    while body.len() < length {
        let want = (length - body.len()).min(chunk.len());
        let n = stream.read(&mut chunk[..want]).map_err(io_error)?;
        if n == 0 {
            return Err(ReadError::BadRequest);
        }
        body.extend_from_slice(&chunk[..n]);
    }
    request.body = body;
    Ok(request)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(raw: &str) -> Result<Request, ReadError> {
        read_request(&mut raw.as_bytes(), 16 * 1024, 64)
    }

    #[test]
    fn parses_method_path_query_headers_and_body() {
        let r = read(
            "POST /v1/todos/import?dryRun=true HTTP/1.1\r\nHost: 127.0.0.1:1\r\nContent-Length: 2\r\n\r\n{}",
        )
        .unwrap();
        assert_eq!(r.method, "POST");
        assert_eq!(r.path, "/v1/todos/import");
        assert_eq!(r.query, "dryRun=true");
        assert_eq!(r.header("host"), Ok(Some("127.0.0.1:1")));
        assert_eq!(r.body, b"{}");
    }

    #[test]
    fn rejects_chunked_duplicate_and_oversized_bodies() {
        assert_eq!(
            read("POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n"),
            Err(ReadError::LengthRequired)
        );
        assert_eq!(
            read("POST / HTTP/1.1\r\nContent-Length: 1\r\nContent-Length: 1\r\n\r\nx"),
            Err(ReadError::BadRequest)
        );
        assert_eq!(
            read("POST / HTTP/1.1\r\nContent-Length: 65\r\n\r\n"),
            Err(ReadError::BodyTooLarge)
        );
        assert_eq!(
            read("POST / HTTP/1.1\r\nContent-Length: 99999999999999999999999\r\n\r\n"),
            Err(ReadError::BodyTooLarge)
        );
        assert_eq!(
            read("POST / HTTP/1.1\r\nContent-Length: -1\r\n\r\n"),
            Err(ReadError::BadRequest)
        );
        assert_eq!(
            read("POST / HTTP/1.1\r\nContent-Length: 5\r\n\r\nab"),
            Err(ReadError::BadRequest)
        );
    }

    #[test]
    fn rejects_garbage_and_huge_heads() {
        assert_eq!(read("hello\r\n\r\n"), Err(ReadError::BadRequest));
        assert_eq!(read("GET / HTTP/1.0\r\n\r\n"), Err(ReadError::BadRequest));
        assert_eq!(
            read("GET http://x/ HTTP/1.1\r\n\r\n"),
            Err(ReadError::BadRequest)
        );
        assert_eq!(read(""), Err(ReadError::Closed));
        let big = format!("GET / HTTP/1.1\r\nX: {}\r\n\r\n", "a".repeat(20_000));
        assert_eq!(read(&big), Err(ReadError::HeadersTooLarge));
        let many: String = (0..40).map(|i| format!("X-{i}: 1\r\n")).collect();
        assert_eq!(
            read(&format!("GET / HTTP/1.1\r\n{many}\r\n")),
            Err(ReadError::HeadersTooLarge)
        );
    }
}
