//! Transport of the local AI import API (see `docs/architecture/local-api.md`).
//!
//! The server binds to `127.0.0.1` only, speaks a deliberately small subset of HTTP/1.1 (one request
//! per connection, `Content-Length` bodies only) and checks everything that must hold before a
//! request may reach the app: `Host` (DNS rebinding), no browser context (`Origin`,
//! `Sec-Fetch-Site`), the bearer token (SHA-256, constant-time), rate limits and sizes. What the
//! request *means* – modules, permissions, validation, batches – is decided by the web app, which
//! receives authenticated requests through the `forward` callback and answers with
//! [`Server::respond`]. Nothing here logs; tokens and bodies are never written anywhere.

mod auth;
mod http;
mod limiter;
mod server;

pub use auth::{parse_hash_hex, sha256, TokenEntry};
pub use server::{bind_addr, Forwarded, Limits, Reply, Server};
