use serde::{ser::Serializer, Serialize};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// This platform has no such facility (e.g. biometrics on Linux, FLAG_SECURE on desktop).
    #[error("unsupported on this platform")]
    Unsupported,
    #[error("invalid argument: {0}")]
    Invalid(String),
    #[error("keystore error: {0}")]
    Keystore(String),
    #[error("biometric verification failed: {0}")]
    Biometric(String),
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
