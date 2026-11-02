use serde::{ser::Serializer, Serialize};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Only Android has Custom Tabs; the desktop builds embed their own browser tabs.
    #[error("unsupported on this platform")]
    Unsupported,
    /// The address failed the check in `validate.rs` (not http(s), no host).
    #[error("invalid address: {0}")]
    InvalidRequest(&'static str),
    #[cfg(target_os = "android")]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
