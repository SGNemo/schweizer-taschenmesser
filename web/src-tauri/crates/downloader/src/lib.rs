//! Download manager core (HTTP/HTTPS only). The shell (`src/downloads.rs`) wraps it in commands.
//!
//! Rules: a file is only ever written into the folder chosen for the job, never overwrites an existing
//! file, never gets executed or opened by this crate, and a pause or a crash keeps the `.part` file so
//! the job resumes with a `Range` request (also after a restart; nothing resumes by itself).

mod job;
mod manager;
mod name;
pub mod net;
mod worker;

pub use job::{HashCheck, Job, State};
pub use manager::{AddError, Manager};
pub use name::{file_name_from_disposition, file_name_from_url, sanitize_file_name};

// The download tests run against a server on 127.0.0.1, which only a test build may reach.
#[cfg(test)]
extern crate self as downloader;
#[cfg(test)]
mod download_tests;
