use std::time::Duration;

/// When seeding stops by itself. `None` = no limit of that kind; both `None` = seed until stopped.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct SeedLimits {
    /// Stop when `uploaded / total` reaches this.
    pub ratio: Option<f64>,
    /// Stop this long after the download finished.
    pub time: Option<Duration>,
}

impl SeedLimits {
    /// Has a finished torrent seeded enough? (`seeding` = time since it finished.)
    pub fn reached(&self, uploaded: u64, total: u64, seeding: Duration) -> bool {
        let by_ratio = match self.ratio {
            Some(r) if total > 0 => uploaded as f64 / total as f64 >= r,
            _ => false,
        };
        let by_time = self.time.is_some_and(|t| seeding >= t);
        by_ratio || by_time
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ratio_time_and_none() {
        let none = SeedLimits::default();
        assert!(!none.reached(10_000, 100, Duration::from_secs(10_000_000)));
        let r = SeedLimits {
            ratio: Some(1.5),
            time: None,
        };
        assert!(!r.reached(149, 100, Duration::ZERO));
        assert!(r.reached(150, 100, Duration::ZERO));
        assert!(
            !r.reached(1, 0, Duration::ZERO),
            "unknown total never counts"
        );
        let t = SeedLimits {
            ratio: None,
            time: Some(Duration::from_secs(60)),
        };
        assert!(!t.reached(0, 100, Duration::from_secs(59)));
        assert!(t.reached(0, 100, Duration::from_secs(60)));
        let both = SeedLimits {
            ratio: Some(2.0),
            time: Some(Duration::from_secs(60)),
        };
        assert!(both.reached(0, 100, Duration::from_secs(61)));
        assert!(both.reached(200, 100, Duration::ZERO));
    }
}
