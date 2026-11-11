use serde::{Deserialize, Serialize};

/// On or off; every command takes the same shape.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnabledRequest {
    #[serde(default)]
    pub enabled: bool,
}
