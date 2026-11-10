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

    /// Credits the whole milliseconds since the last refill (the rest stays for the next call). A
    /// `now` that runs backwards refills nothing.
    fn refill(&mut self, now: Duration) {
        let ms = u64::try_from(now.saturating_sub(self.last).as_millis()).unwrap_or(u64::MAX);
        if ms > 0 {
            self.micro = self
                .micro
                .saturating_add(ms.saturating_mul(self.micro_per_ms))
                .min(self.cap);
            self.last = self.last.saturating_add(Duration::from_millis(ms));
        }
    }

    /// Whether `n` tokens are there, without taking them.
    pub fn has(&mut self, n: u64, now: Duration) -> bool {
        self.refill(now);
        n.checked_mul(MICRO).is_some_and(|need| need <= self.micro)
    }

    /// Takes `n` tokens if they are there.
    pub fn take(&mut self, n: u64, now: Duration) -> bool {
        if !self.has(n, now) {
            return false;
        }
        self.micro -= n * MICRO;
        true
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
        // the buckets on this record's path; a token is taken only if every one of them has one,
        // so a refused volume step does not use up the media or the overall budget
        let (a, b): (Option<&mut Bucket>, Option<&mut Bucket>) = match r {
            // a release passes everything: a button must never stay down
            Record::Button { down: false, .. } => return Verdict::Pass,
            Record::Move { .. } | Record::Scroll { .. } => (None, None),
            Record::Button { .. } => (Some(&mut self.clicks), None),
            Record::Key(_) => (Some(&mut self.keys), None),
            Record::Media(Media::VolumeUp) => (Some(&mut self.media), Some(&mut self.volume_up)),
            Record::Media(Media::Lock) => (Some(&mut self.media), Some(&mut self.lock)),
            Record::Media(_) => (Some(&mut self.media), None),
        };
        let mut path = [Some(&mut self.all), a, b];
        let ok = path.iter_mut().flatten().all(|bucket| bucket.has(1, now));
        if ok {
            for bucket in path.iter_mut().flatten() {
                bucket.take(1, now);
            }
        }
        self.verdict(ok, now)
    }

    pub fn text(&mut self, bytes: usize, now: Duration) -> Verdict {
        let n = u64::try_from(bytes).unwrap_or(u64::MAX);
        let ok = self.all.has(1, now) && self.text.has(n, now);
        if ok {
            self.all.take(1, now);
            self.text.take(n, now);
        }
        self.verdict(ok, now)
    }

    /// Something that was not applied for another reason (the PC is locked) counts as a drop too,
    /// so a session cannot send without end into a locked PC.
    pub fn dropped(&mut self, now: Duration) -> Verdict {
        self.verdict(false, now)
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
