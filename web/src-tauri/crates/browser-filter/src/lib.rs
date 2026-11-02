//! Decisions of the built-in browser that need no window: URL policy and request blocking.
//! The shell (`src/browser.rs`) asks these functions; nothing here touches a webview or the network.

mod blocker;
mod policy;

pub use blocker::{Blocker, Rule, BUILTIN_DOMAINS};
pub use policy::{classify, Verdict};
