use serde::{Deserialize, Serialize};

/// What another app shared. Apps differ in what they fill: a browser sends a title and the link
/// as text, a messenger only text.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SharedContent {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub text: String,
}

impl SharedContent {
    pub fn is_empty(&self) -> bool {
        self.title.trim().is_empty() && self.text.trim().is_empty()
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
            text: "\n".into()
        }
        .is_empty());
        assert!(!SharedContent {
            title: String::new(),
            text: "Hallo".into()
        }
        .is_empty());
    }
}
