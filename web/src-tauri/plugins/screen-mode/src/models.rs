use serde::{Deserialize, Serialize};

/// On or off; both commands take the same shape.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnabledRequest {
    #[serde(default)]
    pub enabled: bool,
}
