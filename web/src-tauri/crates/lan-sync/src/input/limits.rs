//! Rate limits of one input session (threat model: a flood must not make the PC unusable, and a
//! volume ramp must not jump). Token buckets over a monotonic time that the caller passes in.
//!
//! What is over a limit is dropped, not queued. Drops themselves are counted: a session that keeps
//! flooding is closed.

use super::wire::{Media, Record};
use std::time::Duration;

const MICRO: u64 = 1_000_000;

/// `burst` tokens at most, `per_10s` tokens refilled in ten seconds.
#[derive(Debug)]
pub struct Bucket {
    micro: u64,
    cap: u64,
    micro_per_ms: u64,
    last: Duration,
}

impl Bucket {
    pub fn new(burst: u64, per_10s: u64, now: Duration) -> Bucket {
        Bucket {
            micro: burst * MICRO,
            cap: burst * MICRO,
            micro_per_ms: per_10s * MICRO / 10_000,
            last: now,
        }
    }

    /// Takes `n` tokens if they are there. A `now` that runs backwards refills nothing.
    pub fn take(&mut self, n: u64, now: Duration) -> bool {
        let ms = u64::try_from(now.saturating_sub(self.last).as_millis()).unwrap_or(u64::MAX);
        if ms > 0 {
            self.micro = self
                .micro
                .saturating_add(ms.saturating_mul(self.micro_per_ms))
                .min(self.cap);
            self.last = now;
        }
        match n.checked_mul(MICRO) {
            Some(need) if need <= self.micro => {
                self.micro -= need;
                true
            }
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    Pass,
    /// Over a limit: not applied.
    Drop,
    /// Dropped so much that the session is closed.
    Flood,
}

/// Events per second (burst): all 500 (250) · clicks 20 · keys 30 · text 512 bytes · media 10 ·
/// volume up 5 · lock 1 per 10 s. Drops: 2000 at once, then 200 per second, before the session
/// closes.
#[derive(Debug)]
pub struct Limits {
    all: Bucket,
    clicks: Bucket,
    keys: Bucket,
    text: Bucket,
    media: Bucket,
    volume_up: Bucket,
    lock: Bucket,
    drops: Bucket,
}

impl Limits {
    pub fn new(now: Duration) -> Limits {
        Limits {
            all: Bucket::new(250, 5000, now),
            clicks: Bucket::new(20, 200, now),
            keys: Bucket::new(30, 300, now),
            text: Bucket::new(512, 5120, now),
            media: Bucket::new(10, 100, now),
            volume_up: Bucket::new(5, 50, now),
            lock: Bucket::new(1, 1, now),
            drops: Bucket::new(2000, 2000, now),
        }
    }

    pub fn record(&mut self, r: &Record, now: Duration) -> Verdict {
        let ok = self.all.take(1, now)
            && match r {
                Record::Move { .. } | Record::Scroll { .. } => true,
                // a release always passes its own limit: a button must never stay down
                Record::Button { down, .. } => !*down || self.clicks.take(1, now),
                Record::Key(_) => self.keys.take(1, now),
                Record::Media(m) => {
                    self.media.take(1, now)
                        && match m {
                            Media::VolumeUp => self.volume_up.take(1, now),
                            Media::Lock => self.lock.take(1, now),
                            _ => true,
                        }
                }
            };
        self.verdict(ok, now)
    }

    pub fn text(&mut self, bytes: usize, now: Duration) -> Verdict {
        let n = u64::try_from(bytes).unwrap_or(u64::MAX);
        let ok = self.all.take(1, now) && self.text.take(n, now);
        self.verdict(ok, now)
    }

    fn verdict(&mut self, ok: bool, now: Duration) -> Verdict {
        if ok {
            Verdict::Pass
        } else if self.drops.take(1, now) {
            Verdict::Drop
        } else {
            Verdict::Flood
        }
    }
}
