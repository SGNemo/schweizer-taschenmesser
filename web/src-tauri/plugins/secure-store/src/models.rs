use serde::{Deserialize, Serialize};

/// Service name under which desktop credentials are filed (never changes – existing entries depend on it).
pub const SERVICE: &str = "io.github.sgnemo.taschenmesser";

const MAX_NAME: usize = 200;
const MAX_VALUE: usize = 2048;

/// Names are chosen by the app (`ai-key:<provider>`, vault ids); anything odd is refused instead of
/// being handed to an OS API.
pub fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.len() > MAX_NAME {
        return Err(format!("name must be 1..{MAX_NAME} characters"));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'))
    {
        return Err("name may only contain letters, digits and - _ . :".into());
    }
    Ok(())
}

/// Windows Credential Manager blobs are limited to 2560 bytes; secrets here are small (keys, a 32-byte DEK).
pub fn validate_value(value: &str) -> Result<(), String> {
    if value.len() > MAX_VALUE {
        return Err(format!("value larger than {MAX_VALUE} bytes"));
    }
    Ok(())
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableResponse {
    /// An OS keystore is usable (Windows Credential Manager, macOS Keychain, Linux keyring, Android Keystore).
    pub keystore: bool,
    /// A biometric / OS user verification can gate the vault key (Windows Hello, Android BiometricPrompt).
    pub biometric: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRequest {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameRequest {
    pub name: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValueResponse {
    pub value: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SealRequest {
    pub name: String,
    /// base64 of the secret to protect.
    pub secret: String,
    pub title: String,
    pub subtitle: String,
    /// Label of the prompt's cancel button (UI texts come from the app, not from the plugin).
    pub cancel: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsealRequest {
    pub name: String,
    pub title: String,
    pub subtitle: String,
    pub cancel: String,
}

/// `status`: `ok` | `cancelled` | `missing` (nothing sealed under that name) | `invalidated`
/// (biometrics changed on the device; the sealed secret is gone).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsealResponse {
    pub status: String,
    /// base64, only with `status == "ok"`.
    pub secret: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HasResponse {
    pub present: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureWindowRequest {
    pub enabled: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_names_the_app_uses() {
        for n in [
            "ai-key:groq",
            "ai-key:custom-2",
            "vault.3f2a-91",
            "bio:0b1c_d2",
        ] {
            assert!(validate_name(n).is_ok(), "{n}");
        }
    }

    #[test]
    fn rejects_odd_names() {
        assert!(validate_name("").is_err());
        assert!(validate_name(&"a".repeat(201)).is_err());
        for n in ["a b", "a/b", "a\\b", "ünï", "a\nb", "../x", "a\0b"] {
            assert!(validate_name(n).is_err(), "{n:?}");
        }
    }

    #[test]
    fn limits_the_value_size() {
        assert!(validate_value(&"x".repeat(2048)).is_ok());
        assert!(validate_value(&"x".repeat(2049)).is_err());
    }
}
