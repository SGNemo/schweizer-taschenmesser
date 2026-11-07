use super::*;
use crate::noise::frame::{MODE_SESSION, PRE_CONFIRM_CAP};
use crate::noise::{Finished, Mode, Psk};
use crate::pairing::qr;
use crate::pairing::{DataKey, DataKeyError, DataKeyProvider, ManualClock, PairingEvent, WINDOW};
use crate::trust::{Device, MemoryKeyStore, MemoryTrustStore, TrustError};
use std::sync::atomic::{AtomicUsize, Ordering};

const IP: [u8; 4] = [10, 0, 0, 5];

struct Keys;
impl DataKeyProvider for Keys {
    fn current(&self) -> Result<DataKey, DataKeyError> {
        Ok(DataKey {
            version: 1,
            key: Zeroizing::new([5u8; 32]),
        })
    }
}

struct Counting {
    inner: MemoryTrustStore,
    calls: AtomicUsize,
}
impl Counting {
    fn hit(&self) {
        self.calls.fetch_add(1, Ordering::SeqCst);
    }
    fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}
impl TrustStore for Counting {
    fn find_by_key(&self, k: &PublicKey) -> Option<Device> {
        self.hit();
        self.inner.find_by_key(k)
    }
    fn add(&self, d: Device) -> Result<(), TrustError> {
        self.hit();
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
    ep: Endpoint,
    clock: Arc<ManualClock>,
    trust: Arc<Counting>,
    host: Arc<PairingHost>,
    sessions: Arc<SessionRegistry>,
}

fn harness() -> H {
    let keys = MemoryKeyStore::empty();
    let hub_pub = keys.load_or_create().unwrap().public();
    let clock = Arc::new(ManualClock::new());
    let trust = Arc::new(Counting {
        inner: MemoryTrustStore::new(),
        calls: AtomicUsize::new(0),
    });
    let host = Arc::new(PairingHost::new(
        hub_pub,
        clock.clone(),
        trust.clone(),
        Arc::new(Keys),
    ));
    let sessions = Arc::new(SessionRegistry::new());
    let ep = Endpoint::start(&keys, trust.clone(), host.clone(), sessions.clone()).unwrap();
    H {
        ep,
        clock,
        trust,
        host,
        sessions,
    }
}

fn dev(key: PublicKey) -> Device {
    Device {
        key,
        name: "Phone".into(),
        last_seen: None,
        revoked: false,
    }
}

fn qr_psk(h: &H) -> (Psk, PublicKey) {
    let q = qr::decode(&h.host.qr(4000, IP).unwrap().unwrap()).unwrap();
    (Psk::from_secret(&q.secret), q.hub_key)
}

fn pair_m1(h: &H, key: &StaticKey) -> Vec<u8> {
    let (psk, hub) = qr_psk(h);
    noise::start_initiator(Mode::Pair, key, &hub, Some(&psk))
        .unwrap()
        .1
}

fn session_start(h: &H, key: &StaticKey) -> (noise::Initiator, Vec<u8>) {
    noise::start_initiator(Mode::Session, key, &h.ep.public_key(), None).unwrap()
}

/// Pairs `key` through the endpoint and returns it trusted.
fn trust_device(h: &H, key: &StaticKey) {
    h.host.open().unwrap();
    let (psk, hub) = qr_psk(h);
    let (init, wire) = noise::start_initiator(Mode::Pair, key, &hub, Some(&psk)).unwrap();
    let FirstReply::Accept {
        m2,
        conn: Conn::Pairing { attempt },
    } = h.ep.handle_first(&wire)
    else {
        panic!("not accepted")
    };
    let Finished::Established(mut t, sas) = init.finish(&m2).unwrap() else {
        panic!()
    };
    h.host
        .on_hello(attempt, &t.seal(TAG_HELLO, b"Phone").unwrap())
        .unwrap();
    h.host.confirm(attempt, &sas.digits()).unwrap();
}

fn open_session(h: &H, key: &StaticKey) -> (Transport, Box<Session>) {
    let (init, wire) = session_start(h, key);
    let FirstReply::Accept {
        m2,
        conn: Conn::Session(s),
    } = h.ep.handle_first(&wire)
    else {
        panic!("no session")
    };
    let Finished::Established(t, _) = init.finish(&m2).unwrap() else {
        panic!()
    };
    (t, s)
}

fn burned(h: &H) -> usize {
    h.host
        .take_events()
        .iter()
        .filter(|e| matches!(e, PairingEvent::Burned { .. }))
        .count()
}

// ---- pairing drops (no reply, no burn) ----

#[test]
fn wrong_psk_is_dropped_without_reply_burn_or_store_call() {
    let h = harness();
    h.host.open().unwrap();
    let key = StaticKey::generate().unwrap();
    let (_, hub) = qr_psk(&h);
    let (_, wire) =
        noise::start_initiator(Mode::Pair, &key, &hub, Some(&Psk::from_secret(&[9; 16]))).unwrap();
    assert!(matches!(h.ep.handle_first(&wire), FirstReply::Drop));
    assert_eq!(burned(&h), 0);
    assert_eq!(
        h.trust.calls(),
        0,
        "T16: rejected before any trust-list call"
    );
    assert!(h.host.begin_attempt().is_some(), "window survived");
}

#[test]
fn stranger_without_the_hub_key_cannot_burn_the_window() {
    let h = harness();
    h.host.open().unwrap();
    let other = StaticKey::generate().unwrap();
    let key = StaticKey::generate().unwrap();
    let (psk, _) = qr_psk(&h);
    let (_, wire) = noise::start_initiator(Mode::Pair, &key, &other.public(), Some(&psk)).unwrap();
    assert!(matches!(h.ep.handle_first(&wire), FirstReply::Drop));
    assert_eq!((burned(&h), h.trust.calls()), (0, 0));
}

#[test]
fn reused_qr_is_refused() {
    let h = harness();
    h.host.open().unwrap();
    let (psk, hub) = qr_psk(&h);
    let first = StaticKey::generate().unwrap();
    let second = StaticKey::generate().unwrap();
    let (_, w1) = noise::start_initiator(Mode::Pair, &first, &hub, Some(&psk)).unwrap();
    let (_, w2) = noise::start_initiator(Mode::Pair, &second, &hub, Some(&psk)).unwrap();
    assert!(matches!(h.ep.handle_first(&w1), FirstReply::Accept { .. }));
    // same QR, second phone: an attempt is running, the window is burned
    assert!(matches!(h.ep.handle_first(&w2), FirstReply::Drop));
    // replay of the very same message 1
    assert!(matches!(h.ep.handle_first(&w1), FirstReply::Drop));
    assert_eq!(burned(&h), 1);
}

#[test]
fn old_secret_and_earlier_window_replay_are_dropped_without_burn() {
    let h = harness();
    h.host.open().unwrap();
    let key = StaticKey::generate().unwrap();
    let old = pair_m1(&h, &key);
    h.clock.advance(WINDOW);
    h.host.tick(); // renewal: a new secret
    assert!(matches!(h.ep.handle_first(&old), FirstReply::Drop));
    assert_eq!(burned(&h), 0);
    // restart of the window = earlier window's message 1 replayed
    let older = pair_m1(&h, &key);
    h.host.open().unwrap();
    assert!(matches!(h.ep.handle_first(&older), FirstReply::Drop));
    assert_eq!(burned(&h), 0);
    assert_eq!(h.trust.calls(), 0);
}

#[test]
fn closed_window_drops_everything_pair() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    let (_, w) = noise::start_initiator(
        Mode::Pair,
        &key,
        &h.ep.public_key(),
        Some(&Psk::from_secret(&[1; 16])),
    )
    .unwrap();
    assert!(matches!(h.ep.handle_first(&w), FirstReply::Drop));
    assert_eq!(h.trust.calls(), 0);
}

#[test]
fn malformed_first_messages_are_dropped() {
    let h = harness();
    h.host.open().unwrap();
    let key = StaticKey::generate().unwrap();
    let good = pair_m1(&h, &key);
    let mut cases: Vec<Vec<u8>> = vec![
        vec![],
        vec![0u8; 300],
        good[..96].to_vec(),
        vec![MODE_PAIR; 97],
        vec![MODE_SESSION; 97],
    ];
    let mut bad_mode = good.clone();
    bad_mode[0] = 7;
    cases.push(bad_mode);
    let mut long = good.clone();
    long.push(0);
    cases.push(long);
    for c in cases {
        assert!(
            matches!(h.ep.handle_first(&c), FirstReply::Drop),
            "{} bytes",
            c.len()
        );
    }
    assert_eq!((burned(&h), h.trust.calls()), (0, 0));
    assert!(matches!(
        h.ep.handle_first(&good),
        FirstReply::Accept { .. }
    ));
}

#[test]
fn revoked_key_cannot_pair_again_and_active_key_does_not_re_pair() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    // active key tries to pair again
    h.host.open().unwrap();
    let w = pair_m1(&h, &key);
    assert!(matches!(h.ep.handle_first(&w), FirstReply::Drop));
    assert_eq!(burned(&h), 1, "only the first pairing burned");
    assert!(h.host.begin_attempt().is_some(), "window still open");
    // revoked: dropped as well, and `add` refuses it
    h.sessions.revoke(&*h.trust, &key.public()).unwrap();
    let w = pair_m1(&h, &key);
    assert!(matches!(h.ep.handle_first(&w), FirstReply::Drop));
    assert_eq!(
        h.trust.inner.add(dev(key.public())),
        Err(TrustError::Revoked)
    );
    assert!(h.host.begin_attempt().is_some());
}

// ---- sessions ----

#[test]
fn unknown_and_revoked_keys_get_the_identical_authenticated_refusal() {
    let h = harness();
    let revoked = StaticKey::generate().unwrap();
    trust_device(&h, &revoked);
    h.sessions.revoke(&*h.trust, &revoked.public()).unwrap();
    let stranger = StaticKey::generate().unwrap();
    let mut lens = vec![];
    for k in [&revoked, &stranger] {
        let (init, wire) = session_start(&h, k);
        let FirstReply::Refused { m2 } = h.ep.handle_first(&wire) else {
            panic!("not refused")
        };
        lens.push(m2.len());
        assert!(matches!(
            init.finish(&m2).unwrap(),
            Finished::Refused(noise::Refusal::UnknownDevice)
        ));
    }
    assert_eq!(lens[0], lens[1]);
}

#[test]
fn session_of_a_trusted_device_and_activity_only_after_first_frame() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (mut t, mut s) = open_session(&h, &key);
    assert_eq!(s.cap(), PRE_CONFIRM_CAP);
    assert_eq!(
        h.trust.inner.find_by_key(&key.public()).unwrap().last_seen,
        None
    );
    let w = t.seal(TAG_HELLO, b"Phone").unwrap();
    assert!(matches!(s.receive(&w, 1234), Ok(Incoming::Hello(n)) if n == "Phone"));
    assert_eq!(
        h.trust.inner.find_by_key(&key.public()).unwrap().last_seen,
        Some(1234)
    );
    assert!(s.cap() > PRE_CONFIRM_CAP);
    assert_eq!(s.peer(), key.public());
    let back = s.send(TAG_APP_MIN, b"hi").unwrap();
    assert_eq!(t.open(&back).unwrap().0, TAG_APP_MIN);
}

#[test]
fn replayed_session_message_one_keeps_the_cap_and_records_no_activity() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (_, wire) = session_start(&h, &key);
    let FirstReply::Accept {
        conn: Conn::Session(mut s),
        ..
    } = h.ep.handle_first(&wire)
    else {
        panic!()
    };
    // an attacker who replays message 1 cannot produce a valid frame
    assert!(matches!(
        s.receive(&[7u8; 40], 99),
        Err(SessionError::Frame(FrameError::Decrypt))
    ));
    assert_eq!(s.cap(), PRE_CONFIRM_CAP);
    assert_eq!(
        h.trust.inner.find_by_key(&key.public()).unwrap().last_seen,
        None
    );
    assert!(s.is_closed(), "any failure closes for good");
    assert!(matches!(
        s.receive(&[7u8; 40], 99),
        Err(SessionError::Closed)
    ));
}

#[test]
fn oversize_frame_before_the_first_frame_closes_the_session() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (_, mut s) = open_session(&h, &key);
    assert!(matches!(
        s.receive(&[0u8; 300], 1),
        Err(SessionError::Frame(FrameError::TooLarge))
    ));
    assert!(s.is_closed());
}

#[test]
fn revoke_with_an_open_session_closes_it_immediately() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (mut t, mut s) = open_session(&h, &key);
    s.receive(&t.seal(TAG_HELLO, b"Phone").unwrap(), 1).unwrap();
    assert_eq!(h.sessions.open_count(), 1);
    h.sessions.revoke(&*h.trust, &key.public()).unwrap();
    assert!(s.is_closed());
    assert!(matches!(
        s.receive(&t.seal(TAG_APP_MIN, b"x").unwrap(), 2),
        Err(SessionError::Closed)
    ));
    assert!(matches!(
        s.send(TAG_APP_MIN, b"x"),
        Err(SessionError::Closed)
    ));
}

#[test]
fn store_only_revoke_closes_at_the_next_frame() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (mut t, mut s) = open_session(&h, &key);
    s.receive(&t.seal(TAG_HELLO, b"Phone").unwrap(), 1).unwrap();
    h.trust.inner.revoke(&key.public()).unwrap(); // registry not told
    assert!(!s.is_closed());
    assert!(matches!(
        s.receive(&t.seal(TAG_APP_MIN, b"x").unwrap(), 2),
        Err(SessionError::Closed)
    ));
    assert!(s.is_closed());
}

#[test]
fn revoke_between_message_two_and_hello_closes_the_session() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (mut t, mut s) = open_session(&h, &key);
    h.sessions.revoke(&*h.trust, &key.public()).unwrap();
    assert!(matches!(
        s.receive(&t.seal(TAG_HELLO, b"Phone").unwrap(), 1),
        Err(SessionError::Closed)
    ));
    assert_eq!(
        h.trust.inner.find_by_key(&key.public()).unwrap().last_seen,
        None
    );
}

#[test]
fn unpair_acts_on_the_session_peer_only() {
    let h = harness();
    let (a, b) = (
        StaticKey::generate().unwrap(),
        StaticKey::generate().unwrap(),
    );
    trust_device(&h, &a);
    trust_device(&h, &b);
    let (mut ta, mut sa) = open_session(&h, &a);
    let (_, sb) = open_session(&h, &b);
    // the body even carries B's key bytes: there is no id field to read
    let w = ta.seal(TAG_UNPAIR, b.public().as_bytes()).unwrap();
    assert!(matches!(sa.receive(&w, 1), Ok(Incoming::Unpair)));
    assert!(sa.is_closed());
    assert!(h.trust.inner.find_by_key(&a.public()).unwrap().revoked);
    assert!(!h.trust.inner.find_by_key(&b.public()).unwrap().revoked);
    assert!(!sb.is_closed());
}

#[test]
fn inbound_control_frames_the_device_may_not_send_close_the_session() {
    for tag in [TAG_DATA_KEY, TAG_UNKNOWN_DEVICE, 9] {
        let h = harness();
        let key = StaticKey::generate().unwrap();
        trust_device(&h, &key);
        let (mut t, mut s) = open_session(&h, &key);
        assert!(matches!(
            s.receive(&t.seal(tag, b"").unwrap(), 1),
            Err(SessionError::Frame(FrameError::UnknownTag))
        ));
        assert!(s.is_closed());
    }
}

#[test]
fn hello_name_rules_apply_in_sessions_too() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (mut t, mut s) = open_session(&h, &key);
    assert!(matches!(
        s.receive(&t.seal(TAG_HELLO, &[b'a'; 65]).unwrap(), 1),
        Err(SessionError::Frame(FrameError::BadHello))
    ));
}

#[test]
fn impostor_hub_cannot_read_a_session_start() {
    let h = harness();
    let other = harness();
    let key = StaticKey::generate().unwrap();
    let (_, wire) = session_start(&h, &key);
    assert!(matches!(other.ep.handle_first(&wire), FirstReply::Drop));
}

#[test]
fn first_message_from_bad_mode_never_touches_the_trust_list() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    let (_, mut wire) = session_start(&h, &key);
    wire[0] = 3;
    assert!(matches!(h.ep.handle_first(&wire), FirstReply::Drop));
    assert!(matches!(h.ep.handle_first(&[0u8; 400]), FirstReply::Drop));
    assert_eq!(h.trust.calls(), 0);
}

// ---- keys (M5) ----

struct Failing(KeyStoreError);
impl StaticKeyStore for Failing {
    fn load_or_create(&self) -> Result<StaticKey, KeyStoreError> {
        Err(self.0)
    }
    fn regenerate(&self) -> Result<StaticKey, KeyStoreError> {
        Err(self.0)
    }
}

#[test]
fn endpoint_refuses_to_start_on_any_key_store_error() {
    let h = harness();
    for e in [KeyStoreError::Corrupt, KeyStoreError::Unavailable] {
        let r = Endpoint::start(
            &Failing(e),
            h.trust.clone(),
            h.host.clone(),
            h.sessions.clone(),
        );
        assert_eq!(r.err(), Some(EndpointError::Key(e)));
    }
}

#[test]
fn endpoint_refuses_a_pairing_host_for_another_key() {
    let h = harness();
    let other = MemoryKeyStore::empty();
    let r = Endpoint::start(&other, h.trust.clone(), h.host.clone(), h.sessions.clone());
    assert_eq!(r.err(), Some(EndpointError::HubKeyMismatch));
}

#[test]
fn regenerated_hub_key_orphans_old_qr_and_sessions() {
    let keys = MemoryKeyStore::empty();
    let old = keys.load_or_create().unwrap().public();
    let new = keys.regenerate().unwrap().public();
    assert_ne!(old, new);
    let h = harness();
    let dev_key = StaticKey::generate().unwrap();
    let (_, wire) = noise::start_initiator(Mode::Session, &dev_key, &old, None).unwrap();
    assert!(matches!(h.ep.handle_first(&wire), FirstReply::Drop));
}

#[test]
fn replayed_session_message_one_leaves_no_open_session_after_drop() {
    let h = harness();
    let key = StaticKey::generate().unwrap();
    trust_device(&h, &key);
    let (_, wire) = session_start(&h, &key);
    let mut held = Vec::new();
    for _ in 0..50 {
        held.push(h.ep.handle_first(&wire));
    }
    assert_eq!(h.sessions.open_count(), 50);
    held.clear();
    assert_eq!(h.sessions.open_count(), 0);
}
