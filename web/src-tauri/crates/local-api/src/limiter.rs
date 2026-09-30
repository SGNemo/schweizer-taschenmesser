//! Fixed-window rate limiter (per key, e.g. token id or "auth failures").

use std::collections::HashMap;
use std::time::{Duration, Instant};

pub struct RateLimiter {
    window: Duration,
    max: u32,
    buckets: HashMap<String, (Instant, u32)>,
}

impl RateLimiter {
    pub fn new(max: u32, window: Duration) -> Self {
        Self {
            window,
            max,
            buckets: HashMap::new(),
        }
    }

    /// Counts one event; false when the key already used up its window.
    pub fn hit(&mut self, key: &str, now: Instant) -> bool {
        let window = self.window;
        self.buckets
            .retain(|_, (start, _)| now.duration_since(*start) < window);
        let bucket = self.buckets.entry(key.to_owned()).or_insert((now, 0));
        if bucket.1 >= self.max {
            return false;
        }
        bucket.1 += 1;
        true
    }

    /// True while the key has no budget left (does not count).
    pub fn exhausted(&mut self, key: &str, now: Instant) -> bool {
        let window = self.window;
        self.buckets
            .retain(|_, (start, _)| now.duration_since(*start) < window);
        self.buckets.get(key).is_some_and(|(_, n)| *n >= self.max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_per_key_and_window() {
        let mut limiter = RateLimiter::new(2, Duration::from_secs(60));
        let t0 = Instant::now();
        assert!(limiter.hit("a", t0));
        assert!(limiter.hit("a", t0));
        assert!(!limiter.hit("a", t0));
        assert!(limiter.exhausted("a", t0));
        assert!(limiter.hit("b", t0));
        let later = t0 + Duration::from_secs(61);
        assert!(!limiter.exhausted("a", later));
        assert!(limiter.hit("a", later));
    }
}
