//! Bridge between the Nemo browser extension and the desktop vault.
//!
//! ```text
//! browser ──native messaging (stdio)──▶ host (this exe with the origin argument)
//!        host ──per-user pipe / socket──▶ app (Rust server) ──Tauri channel──▶ TypeScript handler
//! ```
//!
//! This crate only moves bytes: it never parses vault content, never logs message bodies, never
//! stores anything. What a request means (pairing, sessions, origin matching, entries) lives in the
//! TypeScript handler (`web/src/modules/accounts/bridge`). The pipe accepts the current user only.

pub mod frame;
pub mod host;
pub mod ipc;
pub mod manifest;
pub mod server;

#[cfg(windows)]
pub mod registry;
