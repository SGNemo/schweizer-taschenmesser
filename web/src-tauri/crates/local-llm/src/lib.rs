//! The built-in local model of Nemo (stage 1 of the AI entry pipeline, 0 tokens).
//!
//! This crate is deliberately free of Tauri so it is built and tested on any machine:
//! * [`Engine`] – load a GGUF file, generate text under a GBNF grammar, reuse the KV cache of the
//!   shared prompt prefix, stop on request.
//! * [`download_verified`] – fetch a model file with progress, resume and a SHA-256 check; a file that
//!   does not match is deleted.
//!
//! Nothing here talks to the network except `download_verified`, and nothing is logged.

mod download;
mod engine;
mod memory;

pub use download::{download_verified, DownloadError, Progress};
pub use engine::{
    backend_devices, cpu_supported, Backend, BackendDevice, Engine, EngineError, GenerateRequest, GenerateResult,
    LoadParams, ModelInfo, StopReason, Worker,
};
pub use memory::peak_memory_bytes;
