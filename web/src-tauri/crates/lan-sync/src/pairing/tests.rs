use super::*;
use crate::noise::frame::{TAG_DATA_KEY, TAG_HELLO};
use crate::noise::{self, Finished, Mode, StaticKey};
use crate::trust::MemoryTrustStore;
use std::collections::HashSet;
use std::mem::ManuallyDrop;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Barrier;

const IP: [u8; 4] = [192, 168, 1, 20];
const KEY_BYTE: u8 = 0xC3;

struct Keys {
    calls: AtomicUsize,
    fail: bool,
}
impl DataKeyProvider for Keys {
    fn current(&self) -> Result<DataKey, DataKeyError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if self.fail {
            return Err(DataKeyError);
        }
        Ok(DataKey {
            version: 7,
            key: Zeroizing::new([KEY_BYTE; 32]),
        })
    }
}

/// Trust store that counts calls and can refuse `add`.
struct Counting {
    inner: MemoryTrustStore,
    calls: AtomicUsize,
    fail_add: bool,
}
impl Counting {
    fn new(fail_add: bool) -> Self {
        Counting {
            inner: MemoryTrustStore::new(),
            calls: AtomicUsize::new(0),
            fail_add,
        }
    }
    fn hit(&self) {
        self.calls.fetch_add(1, Ordering::SeqCst);
    }
}
impl TrustStore for Counting {
    fn find_by_key(&self, k: &PublicKey) -> Option<Device> {
        self.hit();
        self.inner.find_by_key(k)
    }
    fn add(&self, d: Device) -> Result<(), TrustError> {
        self.hit();
        if self.fail_add {
            return Err(TrustError::Storage);
        }
        self.inner.add(d)
    }
    fn remove(&self, k: &PublicKey) -> Result<(), TrustError> {
        self.hit();
        self.inner.remove(k)
    }
    fn revoke(&self, k: &PublicKey) -> Result<bool, TrustError> {
        self.hit();
        self.inner.revoke(k)
    }
    fn touch(&self, k: &PublicKey, at: u64) {
        self.hit();
        self.inner.touch(k, at)
    }
    fn list(&self) -> Vec<Device> {
        self.inner.list()
    }
}

struct H {
    hub: Arc<StaticKey>,
    clock: Arc<ManualClock>,
    trust: Arc<Counting>,
    keys: Arc<Keys>,
    host: Arc<PairingHost>,
}

fn harness_with(fail_add: bool, fail_key: bool) -> H {
    let hub = Arc::new(StaticKey::generate().unwrap());
    let clock = Arc::new(ManualClock::new());
    let trust = Arc::new(Counting::new(fail_add));
    let keys = Arc::new(Keys {
        calls: AtomicUsize::new(0),
        fail: fail_key,
    });
    let host = Arc::new(PairingHost::new(
        hub.public(),
        clock.clone(),
        trust.clone(),
        keys.clone(),
    ));
    H {
        hub,
        clock,
        trust,
        keys,
        host,
    }
}
fn harness() -> H {
    harness_with(false, false)
}
fn secs(n: u64) -> Duration {
    Duration::from_secs(n)
}

/// A phone that scanned the current QR.
struct Phone {
    key: StaticKey,
    init: noise::Initiator,
    wire: Vec<u8>,
}
fn phone_from_qr(h: &H) -> Phone {
    let text = h.host.qr(4000, IP).unwrap().expect("window open");
    let q = qr::decode(&text).unwrap();
    assert_eq!(q.hub_key, h.hub.public());
    let key = StaticKey::generate().unwrap();
    let (init, wire) = noise::start_initiator(
        Mode::Pair,
        &key,
        &q.hub_key,
        Some(&Psk::from_secret(&q.secret)),
    )
    .unwrap();
    Phone { key, init, wire }
}

/// Endpoint-like burn for a phone's first message.
fn try_burn(h: &H, wire: &[u8]) -> Option<Consumed> {
    let a = h.host.begin_attempt()?;
    let r1 = noise::read_first(&h.hub, wire, Some(&a.psk)).ok()?;
    h.host.consume(&a.ticket, r1).ok()
}

struct Linked {
    phone_t: Transport,
    phone_sas: Sas,
    attempt: u64,
    key: StaticKey,
    m1: Vec<u8>,
    m2: Vec<u8>,
}
fn burn(h: &H) -> Linked {
    let p = phone_from_qr(h);
    let c = try_burn(h, &p.wire).expect("burn");
    let Finished::Established(t, sas) = p.init.finish(&c.m2).unwrap() else {
        panic!("refused")
    };
    Linked {
        phone_t: t,
        phone_sas: sas,
        attempt: c.attempt,
        key: p.key,
        m1: p.wire,
        m2: c.m2,
    }
}
fn hello(l: &mut Linked, name: &[u8]) -> Vec<u8> {
    l.phone_t.seal(TAG_HELLO, name).unwrap()
}

#[test]
fn full_pairing_happy_path() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host
        .on_hello(l.attempt, &hello(&mut l, b"Pixel 7"))
        .unwrap();
    let ev = h.host.take_events();
    let code = ev.iter().find_map(|e| match e {
        PairingEvent::HelloReceived { code, name, .. } => {
            assert_eq!(name, "Pixel 7");
            Some(code.clone())
        }
        _ => None,
    });
    assert_eq!(code.as_deref(), Some(l.phone_sas.digits().as_str()));
    let spaced = format!(
        "{} {}",
        &l.phone_sas.digits()[..3],
        &l.phone_sas.digits()[3..]
    );
    let sealed = h.host.confirm(l.attempt, &spaced).unwrap();
    let (tag, body) = l.phone_t.open(&sealed).unwrap();
    assert_eq!(tag, TAG_DATA_KEY);
    assert_eq!(&body[..4], &7u32.to_be_bytes());
    assert_eq!(&body[4..], &[KEY_BYTE; 32]);
    let dev = h.trust.inner.find_by_key(&l.key.public()).unwrap();
    assert_eq!(dev.name, "Pixel 7");
    assert!(!h.host.is_open(), "window closes after pairing");
    assert!(matches!(
        h.host.take_events().last(),
        Some(PairingEvent::Closed)
    ));
}

// ---- M1 ----

#[test]
fn burn_requires_open_and_matching_gen() {
    // Closed
    let h = harness();
    let (_, w) = noise::start_initiator(
        Mode::Pair,
        &StaticKey::generate().unwrap(),
        &h.hub.public(),
        Some(&Psk::from_secret(&[1; 16])),
    )
    .unwrap();
    assert!(h.host.begin_attempt().is_none());
    // a ticket from an Open window cannot be used once Closed
    h.host.open().unwrap();
    let a = h.host.begin_attempt().unwrap();
    let p = phone_from_qr(&h);
    let r1 = noise::read_first(&h.hub, &p.wire, Some(&a.psk)).unwrap();
    h.host.cancel();
    assert_eq!(
        h.host.consume(&a.ticket, r1).err(),
        Some(ConsumeError::Stale)
    );
    let _ = w;

    // Open + old gen (renewed in between) -> dropped, state unchanged
    h.host.open().unwrap();
    let a = h.host.begin_attempt().unwrap();
    let p = phone_from_qr(&h);
    let r1 = noise::read_first(&h.hub, &p.wire, Some(&a.psk)).unwrap();
    h.host.open().unwrap(); // restart -> new gen
    assert_eq!(
        h.host.consume(&a.ticket, r1).err(),
        Some(ConsumeError::Stale)
    );
    assert!(h.host.begin_attempt().is_some(), "still open");

    // Open + match burns
    let l = burn(&h);
    // AwaitHello: nothing else may burn
    let a_old = h.host.begin_attempt();
    assert!(a_old.is_none());
    let p2 = phone_from_qr_unchecked(&h);
    assert!(p2.is_none(), "no QR while an attempt runs");
    drop(l);
}

fn phone_from_qr_unchecked(h: &H) -> Option<String> {
    h.host.qr(4000, IP).unwrap()
}

#[test]
fn same_gen_second_attempt_after_burn_fails() {
    let h = harness();
    h.host.open().unwrap();
    let a = h.host.begin_attempt().unwrap();
    let p1 = phone_from_qr(&h);
    let p2 = phone_from_qr(&h);
    let r1 = noise::read_first(&h.hub, &p1.wire, Some(&a.psk)).unwrap();
    let r2 = noise::read_first(&h.hub, &p2.wire, Some(&a.psk)).unwrap();
    h.host.consume(&a.ticket, r1).unwrap();
    assert_eq!(
        h.host.consume(&a.ticket, r2).err(),
        Some(ConsumeError::Stale)
    );
}

#[test]
fn two_simultaneous_valid_first_messages_exactly_one_wins() {
    for _ in 0..250 {
        let h = harness();
        h.host.open().unwrap();
        let (p1, p2) = (phone_from_qr(&h), phone_from_qr(&h));
        let before = h.host.take_events().len();
        let barrier = Arc::new(Barrier::new(2));
        let results: Vec<_> = [p1.wire, p2.wire]
            .into_iter()
            .map(|wire| {
                let (h2, hub, b) = (h.host.clone(), h.hub.clone(), barrier.clone());
                std::thread::spawn(move || {
                    let a = h2.begin_attempt().unwrap();
                    let r1 = noise::read_first(&hub, &wire, Some(&a.psk)).unwrap();
                    b.wait();
                    h2.consume(&a.ticket, r1).map(|c| c.attempt)
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(|t| t.join().unwrap())
            .collect();
        let wins = results.iter().filter(|r| r.is_ok()).count();
        assert_eq!(wins, 1, "{results:?}");
        assert!(results.iter().any(|r| *r == Err(ConsumeError::Stale)));
        let burned = h
            .host
            .take_events()
            .iter()
            .filter(|e| matches!(e, PairingEvent::Burned { .. }))
            .count();
        let _ = before;
        assert_eq!(burned, 1, "the loser changed nothing");
    }
}

#[test]
fn gen_strictly_monotonic() {
    let h = harness();
    let mut seen = HashSet::new();
    let mut last = 0;
    let mut note = |h: &H| {
        let g = h.host.begin_attempt().expect("open").ticket.gen;
        assert!(g > last, "{g} <= {last}");
        assert!(seen.insert(g));
        last = g;
    };
    h.host.open().unwrap();
    note(&h);
    h.clock.advance(WINDOW);
    h.host.tick(); // renew
    note(&h);
    h.host.cancel();
    h.host.open().unwrap();
    note(&h);
    // AwaitHello -> Open (hello timeout)
    let _l = burn(&h);
    h.clock.advance(HELLO_WAIT);
    h.host.tick();
    note(&h);
    // AwaitConfirm -> Open
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    assert_eq!(
        h.host.confirm(l.attempt, "000000x").err(),
        Some(PairError::WrongCode)
    );
    note(&h);
    assert!(h.host.begin_attempt().unwrap().ticket.gen >= 5);
}

// ---- M2 ----

#[test]
fn deadline_without_tick_open_window() {
    let h = harness();
    h.host.open().unwrap();
    let p = phone_from_qr(&h);
    let a = h.host.begin_attempt().unwrap();
    let r1 = noise::read_first(&h.hub, &p.wire, Some(&a.psk)).unwrap();
    h.clock.advance(WINDOW); // exactly at the deadline, tick never called
    assert!(h.host.begin_attempt().is_none(), "expired at the boundary");
    assert_eq!(
        h.host.consume(&a.ticket, r1).err(),
        Some(ConsumeError::Stale)
    );
}

#[test]
fn window_boundary_is_exact() {
    let h = harness();
    h.host.open().unwrap();
    h.clock.advance(WINDOW - Duration::from_nanos(1));
    assert!(h.host.begin_attempt().is_some());
    h.clock.advance(Duration::from_nanos(1));
    assert!(h.host.begin_attempt().is_none());
}

#[test]
fn expired_window_renews_only_through_the_dialog() {
    let h = harness();
    h.host.open().unwrap();
    let first = h.host.qr(4000, IP).unwrap().unwrap();
    h.clock.advance(WINDOW);
    assert!(h.host.begin_attempt().is_none());
    let second = h.host.qr(4000, IP).unwrap().unwrap();
    assert_ne!(first, second, "fresh secret");
    assert!(h.host.begin_attempt().is_some());
    // the old QR no longer burns
    let old = qr::decode(&first).unwrap();
    let k = StaticKey::generate().unwrap();
    let (_, wire) = noise::start_initiator(
        Mode::Pair,
        &k,
        &h.hub.public(),
        Some(&Psk::from_secret(&old.secret)),
    )
    .unwrap();
    assert!(try_burn(&h, &wire).is_none());
}

#[test]
fn backwards_clock_is_clamped_and_never_reopens() {
    let h = harness();
    h.host.open().unwrap();
    h.clock.advance(WINDOW);
    assert!(h.host.begin_attempt().is_none());
    h.clock.set(secs(10));
    assert!(
        h.host.begin_attempt().is_none(),
        "no reopening by turning the clock back"
    );
    let mut l = {
        let h2 = harness();
        h2.host.open().unwrap();
        burn(&h2)
    };
    let _ = hello(&mut l, b"x");
}

#[test]
fn hello_deadline_without_tick() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.clock.advance(HELLO_WAIT - Duration::from_millis(1));
    let w = hello(&mut l, b"Pixel");
    h.host.on_hello(l.attempt, &w).unwrap();

    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.clock.advance(HELLO_WAIT);
    let w = hello(&mut l, b"Pixel");
    assert_eq!(
        h.host.on_hello(l.attempt, &w).err(),
        Some(PairError::Expired)
    );
    assert!(
        h.host.begin_attempt().is_some(),
        "fresh window with a new secret"
    );
    assert!(h
        .host
        .take_events()
        .contains(&PairingEvent::Cancelled(CancelReason::HelloTimeout)));
}

#[test]
fn confirm_deadline_is_burn_plus_120s() {
    // burn at 119 s into the window: confirm still ok at burn + 119 s, refused at burn + 120 s
    let ok = harness();
    ok.host.open().unwrap();
    ok.clock.advance(WINDOW - secs(1));
    let mut l = burn(&ok);
    ok.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    ok.clock.advance(secs(119));
    // hard cap: opened_at + 240 = open + 240; burn at open+119, +119 = open+238 < 240: still fine
    ok.host.confirm(l.attempt, &l.phone_sas.digits()).unwrap();

    let late = harness();
    late.host.open().unwrap();
    late.clock.advance(WINDOW - secs(1));
    let mut l = burn(&late);
    late.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    late.clock.advance(secs(120));
    assert_eq!(
        late.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::Expired)
    );
    assert_eq!(late.trust.inner.list().len(), 0);
    assert_eq!(late.keys.calls.load(Ordering::SeqCst), 0);
}

#[test]
fn confirm_hard_cap_240s_from_open() {
    // The window is restarted by the user at t0; a QR renewed silently at +120 s is burned at +200 s,
    // so burn + 120 s = t0 + 320 s would pass the cap: confirm is refused at t0 + 240 s.
    let h = harness();
    h.host.open().unwrap();
    let t0 = h.clock.now();
    h.clock.advance(WINDOW);
    h.host.tick(); // renewal, opened_at stays t0
    h.clock.advance(secs(80));
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    h.clock.set(t0 + secs(240) - Duration::from_millis(1));
    let sas = l.phone_sas.digits();
    // still inside the cap: would be ok; check on a twin below, here test the refusal at the cap
    h.clock.set(t0 + secs(240));
    assert_eq!(
        h.host.confirm(l.attempt, &sas).err(),
        Some(PairError::Expired)
    );
    assert!(h.trust.inner.list().is_empty());
}

#[test]
fn confirm_one_tick_before_the_cap_still_works() {
    let h = harness();
    h.host.open().unwrap();
    let t0 = h.clock.now();
    h.clock.advance(WINDOW);
    h.host.tick();
    h.clock.advance(secs(80));
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    h.clock.set(t0 + secs(240) - Duration::from_millis(1));
    h.host.confirm(l.attempt, &l.phone_sas.digits()).unwrap();
}

#[test]
fn every_entry_point_checks_the_deadline_itself() {
    // on_hello, confirm, cancel/open/qr all expire lazily; open() after a lapse gives a fresh window
    let h = harness();
    h.host.open().unwrap();
    h.clock.advance(WINDOW);
    assert_eq!(h.host.qr(4000, IP).unwrap().is_some(), true, "qr renews");
    h.clock.advance(WINDOW);
    h.host.open().unwrap();
    assert!(h.host.begin_attempt().is_some());
    h.clock.advance(WINDOW);
    h.host.cancel();
    assert!(!h.host.is_open());
}

// ---- M3 ----

#[test]
fn wrong_code_ends_the_attempt_for_good() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host
        .on_hello(l.attempt, &hello(&mut l, b"Pixel"))
        .unwrap();
    let right = l.phone_sas.digits();
    let wrong = if right == "000000" {
        "000001"
    } else {
        "000000"
    };
    assert_eq!(
        h.host.confirm(l.attempt, wrong).err(),
        Some(PairError::WrongCode)
    );
    assert_eq!(
        h.host.confirm(l.attempt, &right).err(),
        Some(PairError::NotAwaiting),
        "no retry"
    );
    assert!(h.trust.inner.list().is_empty());
    assert_eq!(
        h.keys.calls.load(Ordering::SeqCst),
        0,
        "no key frame, no key read"
    );
    assert!(h
        .host
        .take_events()
        .contains(&PairingEvent::Cancelled(CancelReason::WrongCode)));
    // a fresh window with a new secret is open
    assert!(h.host.begin_attempt().is_some());
}

#[test]
fn wrong_attempt_id_ends_the_attempt() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host
        .on_hello(l.attempt, &hello(&mut l, b"Pixel"))
        .unwrap();
    assert_eq!(
        h.host.confirm(l.attempt + 1, &l.phone_sas.digits()).err(),
        Some(PairError::WrongAttempt)
    );
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::NotAwaiting)
    );
    assert!(h.trust.inner.list().is_empty());
}

#[test]
fn confirm_without_attempt_or_after_cancel_is_refused() {
    let h = harness();
    assert_eq!(
        h.host.confirm(1, "123456").err(),
        Some(PairError::NotAwaiting)
    );
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    h.host.cancel();
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::NotAwaiting)
    );
}

#[test]
fn malformed_codes_are_wrong_codes() {
    for bad in ["", "12345", "1234567", "abcdef", "12 34"] {
        let h = harness();
        h.host.open().unwrap();
        let mut l = burn(&h);
        h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
        assert_eq!(
            h.host.confirm(l.attempt, bad).err(),
            Some(PairError::WrongCode),
            "{bad:?}"
        );
    }
}

// ---- hello ----

#[test]
fn bad_hello_ends_the_attempt() {
    for name in [&[b'a'; 65][..], &[0xffu8, 0xfe][..], b"".as_slice()] {
        let h = harness();
        h.host.open().unwrap();
        let mut l = burn(&h);
        let w = hello(&mut l, name);
        assert_eq!(
            h.host.on_hello(l.attempt, &w).err(),
            Some(PairError::BadHello)
        );
        assert!(h
            .host
            .take_events()
            .contains(&PairingEvent::Cancelled(CancelReason::BadHello)));
        assert!(h.host.begin_attempt().is_some());
    }
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host
        .on_hello(l.attempt, &hello(&mut l, &[b'a'; 64]))
        .unwrap();
}

#[test]
fn hello_with_wrong_tag_or_garbage_ends_the_attempt() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    let w = l
        .phone_t
        .seal(crate::noise::frame::TAG_UNPAIR, &[])
        .unwrap();
    assert_eq!(
        h.host.on_hello(l.attempt, &w).err(),
        Some(PairError::BadHello)
    );
    let h = harness();
    h.host.open().unwrap();
    let l = burn(&h);
    assert_eq!(
        h.host.on_hello(l.attempt, &[1u8; 40]).err(),
        Some(PairError::Frame(FrameError::Decrypt))
    );
    assert!(h.host.begin_attempt().is_some());
}

#[test]
fn oversize_frame_before_confirm_is_refused() {
    let h = harness();
    h.host.open().unwrap();
    let l = burn(&h);
    assert_eq!(
        h.host.on_hello(l.attempt, &[0u8; 300]).err(),
        Some(PairError::Frame(FrameError::TooLarge))
    );
}

// ---- M4 ----

#[test]
fn no_renewal_and_no_attempt_while_an_attempt_runs() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    for _ in 0..2 {
        assert!(h.host.begin_attempt().is_none());
        assert_eq!(h.host.qr(4000, IP).unwrap(), None);
        assert_eq!(h.host.open().err(), Some(PairError::Busy));
        h.host.tick();
        if matches!(h.host.take_events().last(), Some(PairingEvent::Renewed)) {
            panic!("renewed during an attempt");
        }
        h.host.on_hello(l.attempt, &hello(&mut l, b"x")).ok();
    }
}

#[test]
fn data_key_never_in_plaintext_and_only_after_confirm() {
    let h = harness();
    h.host.open().unwrap();
    let qr_text = h.host.qr(4000, IP).unwrap().unwrap();
    let mut l = burn(&h);
    let hello_wire = hello(&mut l, b"Pixel 7");
    h.host.on_hello(l.attempt, &hello_wire).unwrap();
    assert_eq!(
        h.keys.calls.load(Ordering::SeqCst),
        0,
        "provider untouched before confirm"
    );
    let sealed = h.host.confirm(l.attempt, &l.phone_sas.digits()).unwrap();
    assert_eq!(h.keys.calls.load(Ordering::SeqCst), 1);
    let key = [KEY_BYTE; 32];
    let contains = |hay: &[u8]| hay.windows(32).any(|w| w == key);
    for slice in [
        l.m1.as_slice(),
        l.m2.as_slice(),
        hello_wire.as_slice(),
        sealed.as_slice(),
        qr_text.as_bytes(),
    ] {
        assert!(!contains(slice), "key bytes visible on the wire");
    }
    assert!(
        l.phone_t
            .open(&sealed)
            .unwrap()
            .1
            .windows(32)
            .any(|w| w == key),
        "only inside the sealed frame"
    );
}

#[test]
fn provider_failure_rolls_back_and_the_ticket_is_spent() {
    let h = harness_with(false, true);
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::DataKey)
    );
    assert!(
        h.trust.inner.find_by_key(&l.key.public()).is_none(),
        "entry removed again"
    );
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::NotAwaiting)
    );
    assert!(h
        .host
        .take_events()
        .contains(&PairingEvent::Cancelled(CancelReason::Rejected)));
}

#[test]
fn trust_add_failure_leaves_no_entry_and_no_key_read() {
    let h = harness_with(true, false);
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::Trust(TrustError::Storage))
    );
    assert!(h.trust.inner.list().is_empty());
    assert_eq!(h.keys.calls.load(Ordering::SeqCst), 0);
}

#[test]
fn key_revoked_or_trusted_between_burn_and_confirm_is_refused() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    let dev = Device {
        key: l.key.public(),
        name: "other".into(),
        last_seen: None,
        revoked: false,
    };
    h.trust.inner.add(dev).unwrap();
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::KeyAlreadyTrusted)
    );
    assert_eq!(h.keys.calls.load(Ordering::SeqCst), 0);

    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host.on_hello(l.attempt, &hello(&mut l, b"x")).unwrap();
    let dev = Device {
        key: l.key.public(),
        name: "other".into(),
        last_seen: None,
        revoked: false,
    };
    h.trust.inner.add(dev).unwrap();
    h.trust.inner.revoke(&l.key.public()).unwrap();
    assert_eq!(
        h.host.confirm(l.attempt, &l.phone_sas.digits()).err(),
        Some(PairError::KeyRevoked)
    );
}

#[test]
fn data_key_buffer_is_zeroized_on_drop() {
    let mut dk = ManuallyDrop::new(DataKey {
        version: 1,
        key: Zeroizing::new([9u8; 32]),
    });
    let ptr = dk.key.as_ptr();
    unsafe { ManuallyDrop::drop(&mut dk) };
    assert!(unsafe { std::slice::from_raw_parts(ptr, 32) }
        .iter()
        .all(|b| *b == 0));
}

#[test]
fn open_secret_is_dropped_when_the_window_lapses() {
    let h = harness();
    h.host.open().unwrap();
    h.clock.advance(WINDOW);
    h.host.tick();
    let ev = h.host.take_events();
    assert!(ev.contains(&PairingEvent::Expired));
    assert!(ev.contains(&PairingEvent::Renewed));
}

#[test]
fn events_and_attempt_debug_hide_codes_and_names() {
    let h = harness();
    h.host.open().unwrap();
    let mut l = burn(&h);
    h.host
        .on_hello(l.attempt, &hello(&mut l, b"Svens Handy"))
        .unwrap();
    let shown = format!("{:?}", h.host.take_events());
    assert!(
        !shown.contains("Svens") && !shown.contains(&l.phone_sas.digits()),
        "{shown}"
    );
    assert_eq!(format!("{:?}", h.host.begin_attempt()), "None");
}
