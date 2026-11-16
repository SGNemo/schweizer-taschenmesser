use super::control::{Exchange, MemoryInbox, MemoryOutbox, ITEMS_PER_WINDOW, RATE_WINDOW};
use super::session::{ExchangeConn, Step};
use super::wire::{self, AckState, Code, Item, Kind};
use crate::input::{MasterSwitch, MemorySwitch};
use crate::noise::PublicKey;
use crate::trust::{Device, ExchangeGrant, MemoryTrustStore, TrustStore};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

struct Rig {
    exchange: Arc<Exchange>,
    switch: Arc<MemorySwitch>,
    trust: Arc<MemoryTrustStore>,
    inbox: Arc<MemoryInbox>,
    outbox: Arc<MemoryOutbox>,
    peer: PublicKey,
}

const ON: ExchangeGrant = ExchangeGrant {
    on: true,
    paused: false,
};

fn rig() -> Rig {
    let trust = Arc::new(MemoryTrustStore::new());
    let peer = PublicKey::from_bytes([9; 32]);
    trust
        .add(Device {
            key: peer,
            name: "Phone".into(),
            last_seen: None,
            revoked: false,
        })
        .unwrap();
    let switch = Arc::new(MemorySwitch::new());
    let inbox = Arc::new(MemoryInbox::new());
    let outbox = Arc::new(MemoryOutbox::new());
    let exchange = Arc::new(Exchange::new(
        switch.clone(),
        trust.clone(),
        inbox.clone(),
        outbox.clone(),
    ));
    Rig {
        exchange,
        switch,
        trust,
        inbox,
        outbox,
        peer,
    }
}

/// Switch on and the device granted.
fn granted() -> Rig {
    let r = rig();
    r.switch.set(true).unwrap();
    r.exchange.set_device(&r.peer, ON).unwrap();
    r
}

const T0: Duration = Duration::from_secs(1);

fn opened(r: &Rig) -> ExchangeConn {
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    assert_eq!(c.on_hello(), Step::Continue);
    assert_eq!(
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), T0),
        Step::Reply(wire::TAG_OPENED, wire::encode_opened(0).to_vec())
    );
    c
}

fn item(n: u8, kind: Kind, body: &str) -> Item {
    Item::new([n; 16], kind, body.into()).unwrap()
}

fn refused(code: Code) -> Step {
    Step::ReplyClose(wire::TAG_REFUSED, vec![code.byte()])
}

#[test]
fn open_is_refused_with_the_reason_until_switch_and_grant_allow_it() {
    let r = rig();
    let try_open = |r: &Rig| {
        let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
        c.on_hello();
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), T0)
    };
    assert_eq!(try_open(&r), refused(Code::ExchangeOff), "off by default");
    r.switch.set(true).unwrap();
    assert_eq!(try_open(&r), refused(Code::NotGranted), "pairing is not permission");
    r.exchange
        .set_device(
            &r.peer,
            ExchangeGrant {
                on: true,
                paused: true,
            },
        )
        .unwrap();
    assert_eq!(try_open(&r), refused(Code::Paused));
    r.exchange.set_device(&r.peer, ON).unwrap();
    assert!(matches!(try_open(&r), Step::Reply(wire::TAG_OPENED, _)));
    // a revoked device has no grant any more
    r.trust.revoke(&r.peer).unwrap();
    assert_eq!(try_open(&r), refused(Code::NotGranted));
}

#[test]
fn the_order_of_frames_is_hello_then_open() {
    let r = granted();
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    assert_eq!(
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), T0),
        Step::Close,
        "open before hello"
    );
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    c.on_hello();
    assert_eq!(c.on_hello(), Step::Close, "a second hello");
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    c.on_hello();
    let i = item(1, Kind::Text, "x");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&i), T0),
        Step::Close,
        "an item before open"
    );
    assert!(r.inbox.items().is_empty());
}

#[test]
fn an_item_is_stored_before_it_is_acked_and_a_full_inbox_says_refused() {
    let r = granted();
    let mut c = opened(&r);
    let a = item(1, Kind::Link, "https://example.org/rezept");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&a), T0),
        Step::Reply(
            wire::TAG_ACK,
            wire::encode_ack(&a.id, AckState::Stored).to_vec()
        )
    );
    assert_eq!(r.inbox.items(), vec![(*r.peer.as_bytes(), a)]);
    r.inbox.full.store(true, Ordering::SeqCst);
    let b = item(2, Kind::Text, "Milch");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&b), T0),
        Step::Reply(
            wire::TAG_ACK,
            wire::encode_ack(&b.id, AckState::Refused).to_vec()
        )
    );
    assert_eq!(r.inbox.items().len(), 1);
}

#[test]
fn foreign_broken_and_reserved_frames_close_the_session() {
    let r = granted();
    let good = wire::encode_item(&item(1, Kind::Text, "x"));
    let mut bad_link = good.clone();
    bad_link[16] = 2; // "x" is no link
    let cases: Vec<(u8, Vec<u8>)> = vec![
        (crate::client::TAG_REQUEST, b"{}".to_vec()),
        (0x20, vec![0, 0, 0, 0]), // an input tag
        (wire::TAG_FILE_FIRST, vec![0; 20]),
        (wire::TAG_FILE_LAST, vec![]),
        (wire::TAG_ITEM, bad_link),
        (wire::TAG_ITEM, good[..10].to_vec()),
        (wire::TAG_OPEN, wire::encode_open(0).to_vec()), // a second open
        (wire::TAG_PING, vec![1]),
        (wire::TAG_ACK, wire::encode_ack(&[5; 16], AckState::Stored).to_vec()), // nothing in flight
        (0x3e, vec![]),
    ];
    for (tag, body) in cases {
        let mut c = opened(&r);
        assert_eq!(c.on_frame(tag, &body, T0), Step::Close, "tag {tag:#x}");
        assert_eq!(c.poll(T0), Step::Close, "stays closed");
    }
    let mut c = opened(&r);
    assert_eq!(c.on_frame(wire::TAG_PING, &[], T0), Step::Continue);
}

#[test]
fn the_rate_limit_ends_a_flood_and_a_new_window_starts_fresh() {
    let r = granted();
    let mut c = opened(&r);
    for n in 0..ITEMS_PER_WINDOW {
        let mut id = [0u8; 16];
        id[..4].copy_from_slice(&n.to_be_bytes());
        let i = Item::new(id, Kind::Text, "x".into()).unwrap();
        assert!(matches!(
            c.on_frame(wire::TAG_ITEM, &wire::encode_item(&i), T0),
            Step::Reply(wire::TAG_ACK, _)
        ));
    }
    let one_more = item(0xee, Kind::Text, "x");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&one_more), T0),
        refused(Code::Limit)
    );
    // the count belongs to the device, not to the session
    let mut c = opened(&r);
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&one_more), T0),
        refused(Code::Limit)
    );
    let mut c = opened(&r);
    assert!(matches!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&one_more), T0 + RATE_WINDOW),
        Step::Reply(wire::TAG_ACK, _)
    ));
}

#[test]
fn the_outbox_goes_out_one_item_at_a_time_and_leaves_only_on_a_stored_ack() {
    let r = granted();
    let a = item(1, Kind::Text, "vom PC");
    let b = item(2, Kind::Link, "https://example.org");
    r.outbox.push(&r.peer, a.clone());
    r.outbox.push(&r.peer, b.clone());
    let mut c = opened(&r);
    assert_eq!(
        c.poll(T0),
        Step::Reply(wire::TAG_ITEM, wire::encode_item(&a))
    );
    assert_eq!(c.poll(T0), Step::Continue, "waits for the ack");
    assert_eq!(r.outbox.len(&r.peer), 2);
    // an ack of another id is a broken peer
    let mut other = opened(&r);
    other.poll(T0);
    assert_eq!(
        other.on_frame(
            wire::TAG_ACK,
            &wire::encode_ack(&b.id, AckState::Stored),
            T0
        ),
        Step::Close
    );
    assert_eq!(
        c.on_frame(wire::TAG_ACK, &wire::encode_ack(&a.id, AckState::Stored), T0),
        Step::Continue
    );
    assert_eq!(r.outbox.len(&r.peer), 1);
    assert_eq!(
        c.poll(T0),
        Step::Reply(wire::TAG_ITEM, wire::encode_item(&b))
    );
    // the phone is full: the item stays, nothing more goes out in this session
    assert_eq!(
        c.on_frame(
            wire::TAG_ACK,
            &wire::encode_ack(&b.id, AckState::Refused),
            T0
        ),
        Step::Continue
    );
    assert_eq!(r.outbox.len(&r.peer), 1);
    assert_eq!(c.poll(T0), Step::Continue);
    // a fresh session tries again
    let mut c = opened(&r);
    assert_eq!(
        c.poll(T0),
        Step::Reply(wire::TAG_ITEM, wire::encode_item(&b))
    );
}

#[test]
fn switching_off_or_pausing_at_the_pc_ends_a_live_session_with_the_reason() {
    let r = granted();
    let mut c = opened(&r);
    r.exchange
        .set_device(
            &r.peer,
            ExchangeGrant {
                on: true,
                paused: true,
            },
        )
        .unwrap();
    assert_eq!(c.poll(T0), refused(Code::Paused));
    r.exchange.set_device(&r.peer, ON).unwrap();
    let mut c = opened(&r);
    r.exchange.set_enabled(false).unwrap();
    let i = item(1, Kind::Text, "x");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&i), T0),
        refused(Code::ExchangeOff)
    );
    assert!(r.inbox.items().is_empty(), "nothing stored after the switch went off");
    // another device's outbox is never sent here
    r.exchange.set_enabled(true).unwrap();
    r.outbox
        .push(&PublicKey::from_bytes([1; 32]), item(3, Kind::Text, "x"));
    let mut c = opened(&r);
    assert_eq!(c.poll(T0), Step::Continue);
}

#[test]
fn grants_widen_only_from_off_or_paused_to_on() {
    let off = ExchangeGrant::default();
    let paused = ExchangeGrant {
        on: true,
        paused: true,
    };
    assert!(ON.widens(&off) && ON.widens(&paused));
    assert!(!off.widens(&ON) && !paused.widens(&ON) && !ON.widens(&ON));
    assert!(!off.effective() && !paused.effective() && ON.effective());
}
