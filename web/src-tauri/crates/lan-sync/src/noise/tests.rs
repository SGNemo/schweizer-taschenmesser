use super::frame::*;
use super::*;
use std::mem::ManuallyDrop;

// The crate is a path dependency of the shell, not a workspace member, so `static_assertions`
// (a dev-dependency) cannot be used with `cargo test -p`; this is the same ambiguity trick.
macro_rules! assert_not_impl {
    ($t:ty: $($tr:path),+) => {$(
        const _: fn() = || {
            trait AmbiguousIfImpl<A> {
                fn probe() {}
            }
            impl<T: ?Sized> AmbiguousIfImpl<()> for T {}
            impl<T: ?Sized + $tr> AmbiguousIfImpl<u8> for T {}
            let _ = <$t as AmbiguousIfImpl<_>>::probe;
        };
    )+};
}
assert_not_impl!(StaticKey: Clone, Copy, fmt::Display, serde::Serialize);
assert_not_impl!(Psk: Clone, Copy, fmt::Display, serde::Serialize);
assert_not_impl!(Sas: Clone, fmt::Display, serde::Serialize);
assert_not_impl!(Transport: Clone, fmt::Display, serde::Serialize);
assert_not_impl!(PublicKey: fmt::Display, serde::Serialize);

fn psk(b: u8) -> Psk {
    Psk::from_secret(&[b; 16])
}

fn pair(hub: &StaticKey, dev: &StaticKey, p: u8) -> (Transport, Transport, Sas, Sas, Vec<u8>) {
    let (init, wire) = start_initiator(Mode::Pair, dev, &hub.public(), Some(&psk(p))).unwrap();
    let r1 = read_first(hub, &wire, Some(&psk(p))).unwrap();
    assert_eq!(r1.peer(), dev.public());
    let (m2, ht, hsas) = r1.accept().unwrap();
    match init.finish(&m2).unwrap() {
        Finished::Established(dt, dsas) => (dt, ht, dsas, hsas, wire),
        other => panic!("expected Established, got {other:?}"),
    }
}

#[test]
fn snow_smoke_message_one_is_96_bytes_for_both_patterns() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, w) = start_initiator(Mode::Pair, &dev, &hub.public(), Some(&psk(1))).unwrap();
    assert_eq!(w.len(), 97);
    assert_eq!(w[0], MODE_PAIR);
    let (_, w) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    assert_eq!(w.len(), 97);
    assert_eq!(w[0], MODE_SESSION);
}

#[test]
fn pairing_round_trip_and_sas_equal() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (mut dt, mut ht, dsas, hsas, _) = pair(&hub, &dev, 7);
    assert_eq!(dsas.digits(), hsas.digits());
    assert_eq!(dsas.digits().len(), 6);
    let w = dt.seal(TAG_HELLO, b"Pixel 7").unwrap();
    let (tag, body) = ht.open(&w).unwrap();
    assert_eq!((tag, &body[..]), (TAG_HELLO, &b"Pixel 7"[..]));
    let w = ht.seal(TAG_DATA_KEY, &[9u8; 36]).unwrap();
    assert_eq!(dt.open(&w).unwrap().0, TAG_DATA_KEY);
    assert_eq!(ht.peer(), dev.public());
    assert_eq!(dt.peer(), hub.public());
}

#[test]
fn different_handshakes_give_different_sas() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let a = pair(&hub, &dev, 7).2.digits();
    let b = pair(&hub, &dev, 7).2.digits();
    // one in a million to collide; a fixed collision would show a constant SAS
    assert!(a != b || pair(&hub, &dev, 7).2.digits() != a);
}

#[test]
fn session_round_trip_and_cap_rules() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (init, wire) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    let r1 = read_first(&hub, &wire, None).unwrap();
    assert_eq!(r1.mode(), Mode::Session);
    let (m2, mut ht, _) = r1.accept().unwrap();
    let Finished::Established(mut dt, _) = init.finish(&m2).unwrap() else {
        panic!("not established")
    };
    assert_eq!(ht.cap(), PRE_CONFIRM_CAP);
    // S1: oversize frame refused before the first authenticated frame
    assert_eq!(dt.seal(TAG_APP_MIN, &[0u8; 300]), Err(FrameError::TooLarge));
    assert_eq!(ht.open(&[0u8; 300]).map(|_| ()), Err(FrameError::TooLarge));
    let w = dt.seal(TAG_HELLO, b"x").unwrap();
    ht.open(&w).unwrap();
    assert!(ht.raise_cap());
    assert!(dt.raise_cap());
    let big = dt.seal(TAG_APP_MIN, &[1u8; 5000]).unwrap();
    assert_eq!(ht.open(&big).unwrap().1.len(), 5000);
}

#[test]
fn pairing_connection_keeps_the_small_cap() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (mut dt, mut ht, ..) = pair(&hub, &dev, 3);
    assert!(!ht.raise_cap());
    assert!(!dt.raise_cap());
    assert_eq!(ht.cap(), PRE_CONFIRM_CAP);
    assert_eq!(dt.seal(TAG_APP_MIN, &[0u8; 300]), Err(FrameError::TooLarge));
    assert_eq!(ht.open(&[0u8; 257]).map(|_| ()), Err(FrameError::TooLarge));
}

#[test]
fn wrong_psk_is_dropped_as_decrypt() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, wire) = start_initiator(Mode::Pair, &dev, &hub.public(), Some(&psk(1))).unwrap();
    assert_eq!(
        read_first(&hub, &wire, Some(&psk(2))).err(),
        Some(HandshakeDrop::Decrypt)
    );
}

#[test]
fn old_secret_cannot_pass_the_current_one() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, old) = start_initiator(Mode::Pair, &dev, &hub.public(), Some(&psk(1))).unwrap();
    assert_eq!(
        read_first(&hub, &old, Some(&psk(5))).err(),
        Some(HandshakeDrop::Decrypt)
    );
}

#[test]
fn stranger_without_the_hub_key_is_dropped() {
    let hub = StaticKey::generate().unwrap();
    let other = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, wire) = start_initiator(Mode::Pair, &dev, &other.public(), Some(&psk(1))).unwrap();
    assert_eq!(
        read_first(&hub, &wire, Some(&psk(1))).err(),
        Some(HandshakeDrop::Decrypt)
    );
}

#[test]
fn impostor_hub_is_not_authentic() {
    let hub = StaticKey::generate().unwrap();
    let impostor = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (init, wire) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    // the impostor cannot read message 1 at all
    assert_eq!(
        read_first(&impostor, &wire, None).err(),
        Some(HandshakeDrop::Decrypt)
    );
    // and a forged message 2 does not verify
    let (_, w2) = start_initiator(Mode::Session, &dev, &impostor.public(), None).unwrap();
    let r = read_first(&impostor, &w2, None).unwrap();
    let (m2, _, _) = r.accept().unwrap();
    assert_eq!(init.finish(&m2).err(), Some(InitError::HubNotAuthentic));
}

#[test]
fn first_message_shape_checks() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, wire) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    assert_eq!(
        read_first(&hub, &[0u8; 257], None).err(),
        Some(HandshakeDrop::TooLarge)
    );
    assert_eq!(
        read_first(&hub, &wire[..96], None).err(),
        Some(HandshakeDrop::BadLength)
    );
    let mut longer = wire.clone();
    longer.push(0);
    assert_eq!(
        read_first(&hub, &longer, None).err(),
        Some(HandshakeDrop::BadLength)
    );
    let mut bad = wire.clone();
    bad[0] = 9;
    assert_eq!(
        read_first(&hub, &bad, None).err(),
        Some(HandshakeDrop::BadMode)
    );
    bad[0] = 0;
    assert_eq!(
        read_first(&hub, &bad, None).err(),
        Some(HandshakeDrop::BadMode)
    );
}

#[test]
fn mode_byte_cannot_be_swapped() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, mut wire) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    wire[0] = MODE_PAIR;
    assert_eq!(
        read_first(&hub, &wire, Some(&psk(1))).err(),
        Some(HandshakeDrop::Decrypt)
    );
    let (_, mut wire) = start_initiator(Mode::Pair, &dev, &hub.public(), Some(&psk(1))).unwrap();
    wire[0] = MODE_SESSION;
    assert_eq!(
        read_first(&hub, &wire, None).err(),
        Some(HandshakeDrop::Decrypt)
    );
    // pairing without a psk / session with a psk are refused on both sides
    let (_, wire) = start_initiator(Mode::Pair, &dev, &hub.public(), Some(&psk(1))).unwrap();
    assert_eq!(
        read_first(&hub, &wire, None).err(),
        Some(HandshakeDrop::Decrypt)
    );
    assert_eq!(
        start_initiator(Mode::Pair, &dev, &hub.public(), None).err(),
        Some(InitError::BadPsk)
    );
    assert_eq!(
        start_initiator(Mode::Session, &dev, &hub.public(), Some(&psk(1))).err(),
        Some(InitError::BadPsk)
    );
}

#[test]
fn refusal_is_authenticated_and_identical_for_any_unknown_key() {
    let hub = StaticKey::generate().unwrap();
    for _ in 0..2 {
        let dev = StaticKey::generate().unwrap();
        let (init, wire) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
        let m2 = read_first(&hub, &wire, None)
            .unwrap()
            .refuse_unknown()
            .unwrap();
        assert_eq!(m2.len(), 49);
        assert!(matches!(
            init.finish(&m2).unwrap(),
            Finished::Refused(Refusal::UnknownDevice)
        ));
    }
    // a refusal forged by someone without the hub key does not verify
    let dev = StaticKey::generate().unwrap();
    let (init, _) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    assert_eq!(
        init.finish(&[4u8; 49]).err(),
        Some(InitError::HubNotAuthentic)
    );
}

#[test]
fn replayed_first_message_still_reads_but_gets_a_fresh_transport() {
    // Message 1 alone is replayable (Noise §7.7): nothing but the cap and no touch protect then.
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (_, wire) = start_initiator(Mode::Session, &dev, &hub.public(), None).unwrap();
    let (m2a, mut ta, _) = read_first(&hub, &wire, None).unwrap().accept().unwrap();
    let (m2b, ..) = read_first(&hub, &wire, None).unwrap().accept().unwrap();
    assert_ne!(m2a, m2b);
    assert_eq!(ta.cap(), PRE_CONFIRM_CAP);
    assert_eq!(ta.open(&[0u8; 20]).map(|_| ()), Err(FrameError::Decrypt));
}

#[test]
fn debug_output_never_shows_key_material() {
    let hub = StaticKey::generate().unwrap();
    let dev = StaticKey::generate().unwrap();
    let (mut dt, ht, dsas, ..) = pair(&hub, &dev, 0x41);
    let secret = hub.to_secret_bytes();
    let shown = [
        format!("{hub:?}"),
        format!("{:?}", hub.public()),
        format!("{:?}", psk(0x41)),
        format!("{dsas:?}"),
        format!("{dt:?}"),
        format!("{ht:?}"),
        format!("{:?}", Finished::Refused(Refusal::UnknownDevice)),
    ];
    let hex: String = secret.iter().map(|b| format!("{b:02x}")).collect();
    let pubhex: String = hub
        .public()
        .as_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    for s in &shown {
        assert!(!s.contains(&hex) && !s.contains(&pubhex), "{s}");
        assert!(!s.contains("4141"), "{s}");
        assert!(s.len() < 40, "{s}");
    }
    let _ = dt.seal(TAG_HELLO, b"x");
}

#[test]
fn static_key_round_trips_and_is_zeroized_on_drop() {
    let k = StaticKey::generate().unwrap();
    let again = StaticKey::from_secret_bytes(k.to_secret_bytes()).unwrap();
    assert_eq!(k.public(), again.public());
    let mut probe = ManuallyDrop::new(k);
    let ptr = probe.secret_ptr();
    assert!(unsafe { std::slice::from_raw_parts(ptr, 32) }
        .iter()
        .any(|b| *b != 0));
    unsafe { ManuallyDrop::drop(&mut probe) };
    assert!(unsafe { std::slice::from_raw_parts(ptr, 32) }
        .iter()
        .all(|b| *b == 0));
}

#[test]
fn psk_is_zeroized_on_drop() {
    let mut p = ManuallyDrop::new(psk(0xAB));
    let ptr = p.secret_ptr();
    assert_eq!(unsafe { *ptr }, 0xAB);
    unsafe { ManuallyDrop::drop(&mut p) };
    assert!(unsafe { std::slice::from_raw_parts(ptr, 32) }
        .iter()
        .all(|b| *b == 0));
}
