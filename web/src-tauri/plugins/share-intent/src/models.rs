use serde::{Deserialize, Serialize};

/// What another app shared. Apps differ in what they fill: a browser sends a title and the link
/// as text, a messenger only text. A launcher shortcut or the quick-settings tile sets only `open`
/// (`capture`, `search` or `today`; the Kotlin side passes nothing else).
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SharedContent {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub open: Option<String>,
}

impl SharedContent {
    pub fn is_empty(&self) -> bool {
        self.title.trim().is_empty() && self.text.trim().is_empty() && self.open.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_and_blank_shares_count_as_nothing() {
        assert!(SharedContent::default().is_empty());
        assert!(SharedContent {
            title: " ".into(),
            text: "\n".into(),
            open: None,
        }
        .is_empty());
        assert!(!SharedContent {
            title: String::new(),
            text: "Hallo".into(),
            open: None,
        }
        .is_empty());
    }

    #[test]
    fn a_shortcut_without_text_is_not_empty() {
        let shortcut = SharedContent {
            open: Some("capture".into()),
            ..Default::default()
        };
        assert!(!shortcut.is_empty());
    }
}
