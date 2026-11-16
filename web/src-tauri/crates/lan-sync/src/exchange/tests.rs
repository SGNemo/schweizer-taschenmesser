use super::control::{Exchange, MemoryInbox, MemoryOutbox, ITEMS_PER_WINDOW, RATE_WINDOW};
use super::session::{ExchangeConn, Step};
use super::wire::ItemError;
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
    Step::ReplyClose(wire::TAG_REFUSED, wire::encode_code(code))
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
    assert_eq!(
        try_open(&r),
        refused(Code::NotGranted),
        "pairing is not permission"
    );
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
            wire::encode_ack(a.id(), AckState::Stored).to_vec()
        )
    );
    assert_eq!(r.inbox.items(), vec![(*r.peer.as_bytes(), a)]);
    r.inbox.full.store(true, Ordering::SeqCst);
    let b = item(2, Kind::Text, "Milch");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&b), T0),
        Step::Reply(
            wire::TAG_ACK,
            wire::encode_ack(b.id(), AckState::Refused).to_vec()
        )
    );
    assert_eq!(r.inbox.items().len(), 1);
}

#[test]
fn foreign_broken_and_reserved_frames_close_the_session() {
    let r = granted();
    let good = wire::encode_item(&item(1, Kind::Text, "x"));
    let cases: Vec<(u8, Vec<u8>)> = vec![
        (crate::client::TAG_REQUEST, b"{}".to_vec()),
        (0x20, vec![0, 0, 0, 0]), // an input tag
        (wire::TAG_FILE_FIRST, vec![0; 20]),
        (wire::TAG_FILE_LAST, vec![]),
        (wire::TAG_ITEM, good[..10].to_vec()),
        (wire::TAG_OPEN, wire::encode_open(0).to_vec()), // a second open
        (wire::TAG_PING, vec![1]),
        (
            wire::TAG_ACK,
            wire::encode_ack(&[5; 16], AckState::Stored).to_vec(),
        ), // nothing in flight
        (0x3e, vec![]),
    ];
    for (tag, body) in cases {
        let mut c = opened(&r);
        assert_eq!(c.on_frame(tag, &body, T0), Step::Close, "tag {tag:#x}");
        assert_eq!(c.poll(T0), Step::Close, "stays closed");
    }
    let mut c = opened(&r);
    assert_eq!(c.on_frame(wire::TAG_PING, &[], T0), Step::Continue);
    // a readable id with a body this side does not take is answered, not a reason to close
    let mut bad_link = good.clone();
    bad_link[16] = 2; // "x" is no link
    assert!(matches!(
        c.on_frame(wire::TAG_ITEM, &bad_link, T0),
        Step::Reply(wire::TAG_ACK, _)
    ));
}

fn numbered(n: u32) -> Item {
    let mut id = [0u8; 16];
    id[..4].copy_from_slice(&n.to_be_bytes());
    Item::new(id, Kind::Text, "x".into()).unwrap()
}

#[test]
fn the_rate_limit_counts_stored_items_slides_and_names_the_minutes_left() {
    let r = granted();
    let mut c = opened(&r);
    // refused items (full inbox) do not use up the budget
    r.inbox.full.store(true, Ordering::SeqCst);
    for n in 0..400 {
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&numbered(n)), T0);
    }
    r.inbox.full.store(false, Ordering::SeqCst);
    let half = Duration::from_secs(30 * 60);
    for n in 0..ITEMS_PER_WINDOW as u32 {
        let at = if n < 150 { T0 } else { T0 + half };
        assert!(matches!(
            c.on_frame(wire::TAG_ITEM, &wire::encode_item(&numbered(1000 + n)), at),
            Step::Reply(wire::TAG_ACK, _)
        ));
    }
    let one_more = item(0xee, Kind::Text, "x");
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&one_more), T0 + half),
        refused(Code::Limit(30))
    );
    // an open while the window is full is refused with the minutes left, so the phone stops dialling
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    c.on_hello();
    assert_eq!(
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), T0 + half),
        refused(Code::Limit(30))
    );
    // sliding: once the first 150 leave the window, there is room again
    let mut c = opened_at(&r, T0 + RATE_WINDOW);
    assert!(matches!(
        c.on_frame(
            wire::TAG_ITEM,
            &wire::encode_item(&one_more),
            T0 + RATE_WINDOW
        ),
        Step::Reply(wire::TAG_ACK, _)
    ));
}

fn opened_at(r: &Rig, at: Duration) -> ExchangeConn {
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    c.on_hello();
    assert!(matches!(
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), at),
        Step::Reply(wire::TAG_OPENED, _)
    ));
    c
}

#[test]
fn an_item_sent_again_after_a_lost_ack_is_stored_once_and_acked_again() {
    let r = granted();
    let a = item(1, Kind::Text, "einmal");
    let mut c = opened(&r);
    c.on_frame(wire::TAG_ITEM, &wire::encode_item(&a), T0);
    let mut c = opened(&r);
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &wire::encode_item(&a), T0),
        Step::Reply(
            wire::TAG_ACK,
            wire::encode_ack(a.id(), AckState::Stored).to_vec()
        )
    );
    assert_eq!(r.inbox.items().len(), 1);
}

#[test]
fn an_unusable_item_is_rejected_by_id_and_the_session_goes_on() {
    let r = granted();
    let mut c = opened(&r);
    let mut unknown_kind = wire::encode_item(&item(5, Kind::Text, "x"));
    unknown_kind[16] = 9;
    assert_eq!(
        c.on_frame(wire::TAG_ITEM, &unknown_kind, T0),
        Step::Reply(
            wire::TAG_ACK,
            wire::encode_ack(&[5; 16], AckState::Rejected).to_vec()
        )
    );
    assert_eq!(
        wire::decode_item(&unknown_kind),
        Err(ItemError::Unusable([5; 16]))
    );
    assert!(r.inbox.items().is_empty());
    assert_eq!(c.on_frame(wire::TAG_PING, &[], T0), Step::Continue);
}

#[test]
fn live_sessions_are_counted_for_the_pcs_state() {
    let r = granted();
    assert!(!r.exchange.connected(&r.peer));
    let c = opened(&r);
    assert!(r.exchange.connected(&r.peer));
    drop(c);
    assert!(!r.exchange.connected(&r.peer));
    let mut c = opened(&r);
    c.on_frame(0x3e, &[], T0); // closes
    assert!(!r.exchange.connected(&r.peer));
    // a refused open never counts
    r.exchange.set_enabled(false).unwrap();
    let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
    c.on_hello();
    c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), T0);
    assert!(!r.exchange.connected(&r.peer));
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
            &wire::encode_ack(b.id(), AckState::Stored),
            T0
        ),
        Step::Close
    );
    assert_eq!(
        c.on_frame(
            wire::TAG_ACK,
            &wire::encode_ack(a.id(), AckState::Stored),
            T0
        ),
        Step::Continue
    );
    assert_eq!(r.outbox.len(&r.peer), 1);
    assert_eq!(
        c.poll(T0),
        Step::Reply(wire::TAG_ITEM, wire::encode_item(&b))
    );
    // the phone is full: the item stays, nothing more goes out until its next ping
    assert_eq!(
        c.on_frame(
            wire::TAG_ACK,
            &wire::encode_ack(b.id(), AckState::Refused),
            T0
        ),
        Step::Continue
    );
    assert_eq!(r.outbox.len(&r.peer), 1);
    assert_eq!(c.poll(T0), Step::Continue);
    assert_eq!(c.on_frame(wire::TAG_PING, &[], T0), Step::Continue);
    assert_eq!(
        c.poll(T0),
        Step::Reply(wire::TAG_ITEM, wire::encode_item(&b))
    );
    // the phone cannot read it: it leaves the queue and the shell hears why
    assert_eq!(
        c.on_frame(
            wire::TAG_ACK,
            &wire::encode_ack(b.id(), AckState::Rejected),
            T0
        ),
        Step::Continue
    );
    assert_eq!(r.outbox.len(&r.peer), 0);
    assert_eq!(
        r.outbox.answers(),
        vec![
            (*a.id(), AckState::Stored),
            (*b.id(), AckState::Refused),
            (*b.id(), AckState::Rejected)
        ]
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
    assert!(
        r.inbox.items().is_empty(),
        "nothing stored after the switch went off"
    );
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

// ---- files (package 2b) ----

mod files {
    use super::*;
    use crate::exchange::files::{Decision, MemoryFiles, SendOutcome, Stopped};
    use crate::exchange::transfer::{CHECK_EVERY, OFFERS_IN, PENDING};
    use crate::exchange::wire::{Offer, RefuseCode, ResultCode, WaitReason, FEATURE_FILES};

    struct FileRig {
        r: Rig,
        files: Arc<MemoryFiles>,
        exchange: Arc<Exchange>,
    }

    fn file_rig() -> FileRig {
        let r = granted();
        let files = Arc::new(MemoryFiles::new());
        let exchange = Arc::new(
            Exchange::new(
                r.switch.clone(),
                r.trust.clone(),
                r.inbox.clone(),
                r.outbox.clone(),
            )
            .with_files(files.clone()),
        );
        FileRig { r, files, exchange }
    }

    fn open_files(f: &FileRig) -> ExchangeConn {
        let mut c = ExchangeConn::new(f.exchange.clone(), f.r.peer);
        c.on_hello();
        assert_eq!(
            c.on_frame(wire::TAG_OPEN, &wire::encode_open(FEATURE_FILES), T0),
            Step::Reply(
                wire::TAG_OPENED,
                wire::encode_opened(FEATURE_FILES).to_vec()
            )
        );
        c
    }

    fn offer(n: u8, size: u64) -> Offer {
        Offer::new(
            [n; 16],
            size,
            [0; 32],
            format!("Datei {n}.bin"),
            String::new(),
        )
        .unwrap()
    }

    fn chunk(n: u8, offset: u64, bytes: &[u8]) -> Vec<u8> {
        wire::encode_chunk(&[n; 16], offset, bytes).unwrap()
    }

    fn reply(tag: u8, body: &[u8]) -> Step {
        Step::Reply(tag, body.to_vec())
    }

    /// Time moves on far enough for the next check of the shell.
    fn later(n: u32) -> Duration {
        T0 + CHECK_EVERY * n
    }

    fn offer_frame(c: &mut ExchangeConn, n: u8, size: u64) -> Step {
        c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&offer(n, size)), T0)
    }

    #[test]
    fn without_wired_files_the_feature_is_not_given_and_file_records_close() {
        let r = granted();
        let mut c = ExchangeConn::new(r.exchange.clone(), r.peer);
        c.on_hello();
        assert_eq!(
            c.on_frame(wire::TAG_OPEN, &wire::encode_open(FEATURE_FILES), T0),
            Step::Reply(wire::TAG_OPENED, wire::encode_opened(0).to_vec())
        );
        let o = wire::encode_offer(&offer(1, 10));
        assert_eq!(c.on_frame(wire::TAG_OFFER, &o, T0), Step::Close);
        // wired, but the device did not ask: closes too
        let f = file_rig();
        let mut c = ExchangeConn::new(f.exchange.clone(), f.r.peer);
        c.on_hello();
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(0), T0);
        assert_eq!(c.on_frame(wire::TAG_OFFER, &o, T0), Step::Close);
    }

    #[test]
    fn a_device_file_comes_in_chunk_by_chunk_and_is_finished_by_the_shell() {
        let f = file_rig();
        let mut c = open_files(&f);
        let data: Vec<u8> = (0..150_000u32).map(|i| (i % 251) as u8).collect();
        assert_eq!(
            offer_frame(&mut c, 1, data.len() as u64),
            reply(wire::TAG_ACCEPT, &wire::encode_accept(&[1; 16], 0))
        );
        let mut at = 0usize;
        for part in data.chunks(wire::MAX_CHUNK) {
            assert_eq!(
                c.on_frame(wire::TAG_CHUNK, &chunk(1, at as u64, part), T0),
                Step::Continue
            );
            at += part.len();
        }
        assert_eq!(
            c.on_frame(wire::TAG_END, &[1; 16], T0),
            reply(
                wire::TAG_RESULT,
                &wire::encode_result(&[1; 16], ResultCode::Ok)
            )
        );
        let got = f.files.received();
        assert_eq!((got.len(), &got[0].bytes), (1, &data));
        assert_eq!(got[0].result, Some(ResultCode::Ok));
    }

    #[test]
    fn a_gap_a_second_offer_or_bytes_past_the_size_close_and_keep_the_part() {
        let f = file_rig();
        for bad in [
            (wire::TAG_CHUNK, chunk(1, 5, &[0; 5])),  // gap
            (wire::TAG_CHUNK, chunk(1, 0, &[0; 11])), // past the size
            (wire::TAG_CHUNK, chunk(2, 0, &[0; 5])),  // an id that never came
            (wire::TAG_END, vec![2; 16]),             // end of an id that never came
        ] {
            let mut c = open_files(&f);
            offer_frame(&mut c, 1, 10);
            assert_eq!(c.on_frame(bad.0, &bad.1, T0), Step::Close, "{:#04x}", bad.0);
        }
        // every closed transfer was left to the shell as lost (the part stays)
        assert_eq!(f.files.stops(), vec![([1; 16], Stopped::Lost); 4]);
    }

    #[test]
    fn an_end_before_the_last_byte_is_a_mismatch_without_finish() {
        let f = file_rig();
        let mut c = open_files(&f);
        offer_frame(&mut c, 1, 10);
        c.on_frame(wire::TAG_CHUNK, &chunk(1, 0, &[0; 6]), T0);
        assert_eq!(
            c.on_frame(wire::TAG_END, &[1; 16], T0),
            reply(
                wire::TAG_RESULT,
                &wire::encode_result(&[1; 16], ResultCode::Mismatch)
            )
        );
        assert_eq!(f.files.received()[0].result, None, "finish never ran");
        assert_eq!(f.files.stops(), vec![([1; 16], Stopped::Lost)]);
    }

    #[test]
    fn frames_that_crossed_an_early_result_are_dropped_not_closing() {
        let f = file_rig();
        let mut c = open_files(&f);
        offer_frame(&mut c, 1, 30);
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(1, 0, &[1; 10]), T0),
            Step::Continue
        );
        // the PC's disk fills up: it answers early, the device had more on the way
        f.files.fail_writes.store(true, Ordering::SeqCst);
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(1, 10, &[1; 10]), T0),
            reply(
                wire::TAG_RESULT,
                &wire::encode_result(&[1; 16], ResultCode::Full)
            )
        );
        // the late chunk, end and cancel of the ended transfer are dropped
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(1, 20, &[1; 10]), T0),
            Step::Continue
        );
        assert_eq!(c.on_frame(wire::TAG_END, &[1; 16], T0), Step::Continue);
        assert_eq!(c.on_frame(wire::TAG_CANCEL, &[1; 16], T0), Step::Continue);
        // the session lives: a text item still goes through
        let note = item(3, Kind::Text, "noch da");
        assert!(matches!(
            c.on_frame(wire::TAG_ITEM, &wire::encode_item(&note), T0),
            Step::Reply(wire::TAG_ACK, _)
        ));
        // and the device may offer it again later (a resume)
        f.files.fail_writes.store(false, Ordering::SeqCst);
        assert!(matches!(
            offer_frame(&mut c, 1, 30),
            Step::Reply(wire::TAG_ACCEPT, _)
        ));
    }

    #[test]
    fn offers_are_refused_or_wait_for_the_user_without_holding_the_slot() {
        let f = file_rig();
        let mut c = open_files(&f);
        // over 4 GB: too large, with the id
        let mut big = wire::encode_offer(&offer(3, 1));
        big[16..24].copy_from_slice(&(wire::MAX_FILE + 1).to_be_bytes());
        assert_eq!(
            c.on_frame(wire::TAG_OFFER, &big, T0),
            reply(
                wire::TAG_REFUSE,
                &wire::encode_refuse(&[3; 16], RefuseCode::TooLarge)
            )
        );
        f.files.set_decision(Decision::Refuse(RefuseCode::Full));
        assert_eq!(
            offer_frame(&mut c, 4, 5),
            reply(
                wire::TAG_REFUSE,
                &wire::encode_refuse(&[4; 16], RefuseCode::Full)
            )
        );
        // a large file waits for the user; a small one may come meanwhile
        f.files.set_decision(Decision::Wait(WaitReason::Large));
        assert_eq!(
            offer_frame(&mut c, 5, 5),
            reply(
                wire::TAG_WAIT,
                &wire::encode_wait(&[5; 16], WaitReason::Large)
            )
        );
        f.files.set_decision(Decision::Accept { from: 0 });
        assert!(matches!(
            offer_frame(&mut c, 6, 2),
            Step::Reply(wire::TAG_ACCEPT, _)
        ));
        // the user's yes is not asked while something comes in
        f.files.decide_later([5; 16], Decision::Accept { from: 0 });
        assert_eq!(c.poll(later(1)), Step::Continue);
        c.on_frame(wire::TAG_CHUNK, &chunk(6, 0, b"ok"), T0);
        c.on_frame(wire::TAG_END, &[6; 16], T0);
        assert_eq!(
            c.poll(later(2)),
            reply(wire::TAG_ACCEPT, &wire::encode_accept(&[5; 16], 0))
        );
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(5, 0, b"Hallo"), T0),
            Step::Continue
        );
        assert!(matches!(
            c.on_frame(wire::TAG_END, &[5; 16], T0),
            Step::Reply(wire::TAG_RESULT, _)
        ));
        // a chunk of a waiting offer is a broken peer
        f.files.set_decision(Decision::Wait(WaitReason::Daily));
        offer_frame(&mut c, 7, 5);
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(7, 0, b"x"), T0),
            Step::Close
        );
    }

    #[test]
    fn waiting_offers_are_bounded_and_withdrawn_ones_reach_the_shell() {
        let f = file_rig();
        let mut c = open_files(&f);
        f.files.set_decision(Decision::Wait(WaitReason::Daily));
        for n in 1..=PENDING as u8 {
            assert!(matches!(
                offer_frame(&mut c, n, 5),
                Step::Reply(wire::TAG_WAIT, _)
            ));
        }
        // the device cancels one: the shell drops its prompt
        assert_eq!(c.on_frame(wire::TAG_CANCEL, &[1; 16], T0), Step::Continue);
        assert_eq!(f.files.stops(), vec![([1; 16], Stopped::Withdrawn)]);
        // room for one more, then the limit
        assert!(matches!(
            offer_frame(&mut c, 10, 5),
            Step::Reply(wire::TAG_WAIT, _)
        ));
        assert_eq!(offer_frame(&mut c, 11, 5), Step::Close);
        // the session ended: every waiting prompt is withdrawn
        let stops = f.files.stops();
        assert_eq!(stops.len(), 1 + PENDING);
        assert!(stops.iter().all(|(_, how)| *how == Stopped::Withdrawn));
    }

    #[test]
    fn a_device_cannot_offer_without_end() {
        let f = file_rig();
        let mut c = open_files(&f);
        f.files.set_decision(Decision::Refuse(RefuseCode::Declined));
        for n in 0..OFFERS_IN {
            assert!(matches!(
                offer_frame(&mut c, (n % 200) as u8, 5),
                Step::Reply(wire::TAG_REFUSE, _)
            ));
        }
        assert_eq!(offer_frame(&mut c, 250, 5), Step::Close);
    }

    #[test]
    fn a_queued_file_goes_out_after_accept_and_leaves_the_queue_on_its_result() {
        let f = file_rig();
        let data = vec![7u8; 2 * wire::MAX_CHUNK + 10];
        f.files
            .queue(&f.r.peer, offer(7, data.len() as u64), data.clone());
        let mut c = open_files(&f);
        assert_eq!(
            c.poll(T0),
            reply(
                wire::TAG_OFFER,
                &wire::encode_offer(&offer(7, data.len() as u64))
            )
        );
        assert_eq!(c.poll(later(1)), Step::Continue, "waits for the answer");
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[7; 16], 0), T0);
        let mut got = Vec::new();
        loop {
            match c.poll(later(1)) {
                Step::Reply(wire::TAG_CHUNK, body) => {
                    let (id, offset, bytes) = wire::decode_chunk(&body).unwrap();
                    assert_eq!((id, offset), ([7; 16], got.len() as u64));
                    got.extend_from_slice(bytes);
                }
                Step::Reply(wire::TAG_END, body) => {
                    assert_eq!(body, vec![7; 16]);
                    break;
                }
                other => panic!("{other:?}"),
            }
        }
        assert_eq!(got, data);
        let ok = wire::encode_result(&[7; 16], ResultCode::Ok);
        assert_eq!(c.on_frame(wire::TAG_RESULT, &ok, T0), Step::Continue);
        assert_eq!(
            f.files.outcomes(),
            vec![([7; 16], SendOutcome::Done(ResultCode::Ok))]
        );
        assert_eq!(f.files.next_offer_for(&f.r.peer), None);
        // a late answer for it crossed on the wire: dropped
        assert_eq!(c.on_frame(wire::TAG_RESULT, &ok, T0), Step::Continue);
    }

    #[test]
    fn a_waiting_device_frees_the_slot_and_its_accept_starts_after_the_active_file() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(1, 3), vec![1; 3]);
        f.files.queue(&f.r.peer, offer(2, 4), vec![2; 4]);
        let mut c = open_files(&f);
        assert!(matches!(c.poll(T0), Step::Reply(wire::TAG_OFFER, b) if b[..16] == [1u8; 16]));
        let wait = wire::encode_wait(&[1; 16], WaitReason::Large);
        assert_eq!(c.on_frame(wire::TAG_WAIT, &wait, T0), Step::Continue);
        // the next file is offered while the first waits for the phone's user
        assert!(
            matches!(c.poll(later(1)), Step::Reply(wire::TAG_OFFER, b) if b[..16] == [2u8; 16])
        );
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[2; 16], 0), T0);
        // the phone's user says yes to the first meanwhile: it starts after the second
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[1; 16], 0), T0);
        assert!(
            matches!(c.poll(later(1)), Step::Reply(wire::TAG_CHUNK, b) if b[..16] == [2u8; 16])
        );
        assert_eq!(c.poll(later(1)), reply(wire::TAG_END, &[2; 16]));
        let ok = |n: u8| wire::encode_result(&[n; 16], ResultCode::Ok);
        c.on_frame(wire::TAG_RESULT, &ok(2), T0);
        assert_eq!(
            c.poll(later(1)),
            Step::Continue,
            "the slot takes the accepted one"
        );
        assert!(
            matches!(c.poll(later(1)), Step::Reply(wire::TAG_CHUNK, b) if b[..16] == [1u8; 16])
        );
        assert_eq!(c.poll(later(1)), reply(wire::TAG_END, &[1; 16]));
        c.on_frame(wire::TAG_RESULT, &ok(1), T0);
        assert_eq!(f.files.next_offer_for(&f.r.peer), None);
    }

    #[test]
    fn a_file_the_pc_withdraws_is_cancelled_at_the_device() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(1, 3), vec![1; 3]);
        let mut c = open_files(&f);
        c.poll(T0);
        f.files.withdraw(&f.r.peer, &[1; 16]);
        assert_eq!(c.poll(later(1)), reply(wire::TAG_CANCEL, &[1; 16]));
        // the device's answer crossed the cancel: dropped
        let accept = wire::encode_accept(&[1; 16], 0);
        assert_eq!(c.on_frame(wire::TAG_ACCEPT, &accept, T0), Step::Continue);
    }

    #[test]
    fn a_resume_starts_at_the_device_part_and_a_text_item_goes_between_chunks() {
        let f = file_rig();
        let data: Vec<u8> = (0..(3 * wire::MAX_CHUNK) as u32).map(|i| i as u8).collect();
        f.files
            .queue(&f.r.peer, offer(8, data.len() as u64), data.clone());
        let mut c = open_files(&f);
        c.poll(T0);
        let from = wire::MAX_CHUNK as u64 + 7;
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[8; 16], from), T0);
        let Step::Reply(wire::TAG_CHUNK, body) = c.poll(later(1)) else {
            panic!("a chunk");
        };
        let (_, offset, bytes) = wire::decode_chunk(&body).unwrap();
        assert_eq!(offset, from);
        assert_eq!(bytes, &data[from as usize..from as usize + bytes.len()]);
        // while it streams, the outbox is asked on the next check: then the item goes first
        f.r.outbox
            .push(&f.r.peer, item(9, Kind::Text, "Zwischendurch"));
        assert!(matches!(c.poll(later(1)), Step::Reply(wire::TAG_CHUNK, _)));
        assert!(matches!(c.poll(later(2)), Step::Reply(wire::TAG_ITEM, _)));
    }

    #[test]
    fn an_unfinished_transfer_is_left_to_the_shell_and_a_device_cancel_drops_the_file() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(10, 100), vec![1; 100]);
        {
            let mut c = open_files(&f);
            c.poll(T0);
            c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[10; 16], 0), T0);
            offer_frame(&mut c, 11, 50);
            c.on_frame(wire::TAG_CHUNK, &chunk(11, 0, &[2; 20]), T0);
            // the session ends (dropped) with both transfers open
        }
        assert_eq!(
            f.files.outcomes(),
            vec![([10; 16], SendOutcome::Interrupted)]
        );
        assert_eq!(f.files.stops(), vec![([11; 16], Stopped::Lost)]);
        // still queued: offered again on the next session, then cancelled by the device
        let mut c = open_files(&f);
        assert!(matches!(c.poll(T0), Step::Reply(wire::TAG_OFFER, _)));
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[10; 16], 20), T0);
        assert_eq!(c.on_frame(wire::TAG_CANCEL, &[10; 16], T0), Step::Continue);
        assert_eq!(
            f.files.outcomes().last(),
            Some(&([10; 16], SendOutcome::Cancelled))
        );
        assert_eq!(f.files.next_offer_for(&f.r.peer), None);
        // the device cancels an incoming transfer of its own: the part may go
        offer_frame(&mut c, 12, 10);
        c.on_frame(wire::TAG_CANCEL, &[12; 16], T0);
        assert_eq!(
            f.files.stops().last(),
            Some(&([12; 16], Stopped::Cancelled))
        );
    }

    #[test]
    fn a_file_that_cannot_be_read_is_cancelled_and_the_next_one_is_offered() {
        let f = file_rig();
        // offered as 100 bytes, only 40 there
        f.files.queue(&f.r.peer, offer(12, 100), vec![3; 40]);
        f.files.queue(&f.r.peer, offer(13, 5), vec![4; 5]);
        let mut c = open_files(&f);
        c.poll(T0);
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[12; 16], 0), T0);
        assert!(matches!(c.poll(later(1)), Step::Reply(wire::TAG_CHUNK, _)));
        assert_eq!(c.poll(later(1)), reply(wire::TAG_CANCEL, &[12; 16]));
        assert_eq!(
            f.files.outcomes(),
            vec![([12; 16], SendOutcome::Interrupted)]
        );
        // the broken one stays queued for the shell but is not offered again here
        assert_eq!(
            c.poll(later(2)),
            reply(wire::TAG_OFFER, &wire::encode_offer(&offer(13, 5)))
        );
        let refuse = wire::encode_refuse(&[13; 16], RefuseCode::Declined);
        assert_eq!(c.on_frame(wire::TAG_REFUSE, &refuse, T0), Step::Continue);
        assert_eq!(
            c.poll(later(3)),
            Step::Continue,
            "nothing is offered twice in a session"
        );
    }

    #[test]
    fn a_device_offer_that_crossed_the_pc_accept_is_parked_and_answered_later() {
        let f = file_rig();
        let mut c = open_files(&f);
        f.files.set_decision(Decision::Wait(WaitReason::Large));
        offer_frame(&mut c, 1, 4);
        // the PC's user accepts it; the device offers the next one at the same moment
        f.files.decide_later([1; 16], Decision::Accept { from: 0 });
        assert!(matches!(c.poll(later(1)), Step::Reply(wire::TAG_ACCEPT, _)));
        f.files.set_decision(Decision::Accept { from: 0 });
        assert_eq!(
            offer_frame(&mut c, 2, 3),
            Step::Continue,
            "parked, not closed"
        );
        c.on_frame(wire::TAG_CHUNK, &chunk(1, 0, b"abcd"), T0);
        assert!(matches!(
            c.on_frame(wire::TAG_END, &[1; 16], T0),
            Step::Reply(wire::TAG_RESULT, _)
        ));
        // the slot is free: the parked offer gets its answer
        assert_eq!(
            c.poll(later(2)),
            reply(wire::TAG_ACCEPT, &wire::encode_accept(&[2; 16], 0))
        );
    }

    #[test]
    fn a_device_accept_that_crossed_the_next_pc_offer_starts_and_the_offer_waits() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(1, 3), vec![1; 3]);
        f.files.queue(&f.r.peer, offer(2, 4), vec![2; 4]);
        let mut c = open_files(&f);
        c.poll(T0);
        let wait = wire::encode_wait(&[1; 16], WaitReason::Large);
        c.on_frame(wire::TAG_WAIT, &wait, T0);
        // the PC offers the next; the device accepts the first before it saw that
        assert!(
            matches!(c.poll(later(1)), Step::Reply(wire::TAG_OFFER, b) if b[..16] == [2u8; 16])
        );
        assert_eq!(
            c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[1; 16], 0), T0),
            Step::Continue
        );
        assert!(
            matches!(c.poll(later(1)), Step::Reply(wire::TAG_CHUNK, b) if b[..16] == [1u8; 16])
        );
        // the device's answer to the second comes later, while the first streams: it waits
        let wait2 = wire::encode_wait(&[2; 16], WaitReason::Daily);
        assert_eq!(c.on_frame(wire::TAG_WAIT, &wait2, T0), Step::Continue);
        assert_eq!(c.poll(later(1)), reply(wire::TAG_END, &[1; 16]));
    }

    #[test]
    fn a_late_no_goes_out_at_once_and_a_late_yes_waits_for_the_slot() {
        let f = file_rig();
        let mut c = open_files(&f);
        f.files.set_decision(Decision::Wait(WaitReason::Large));
        offer_frame(&mut c, 1, 4);
        offer_frame(&mut c, 2, 4);
        f.files.set_decision(Decision::Accept { from: 0 });
        offer_frame(&mut c, 3, 4);
        // while 3 comes in, the PC's user says no to 1 and yes to 2
        f.files
            .decide_later([1; 16], Decision::Refuse(RefuseCode::Declined));
        f.files.decide_later([2; 16], Decision::Accept { from: 0 });
        assert_eq!(
            c.poll(later(1)),
            reply(
                wire::TAG_REFUSE,
                &wire::encode_refuse(&[1; 16], RefuseCode::Declined)
            )
        );
        assert_eq!(
            c.poll(later(2)),
            Step::Continue,
            "the yes waits for the slot"
        );
        c.on_frame(wire::TAG_CHUNK, &chunk(3, 0, b"drei"), T0);
        c.on_frame(wire::TAG_END, &[3; 16], T0);
        assert_eq!(
            c.poll(later(3)),
            reply(wire::TAG_ACCEPT, &wire::encode_accept(&[2; 16], 0))
        );
    }

    #[test]
    fn a_streaming_file_the_pc_withdraws_is_cancelled_without_counting_as_a_failure() {
        let f = file_rig();
        let data = vec![1u8; 3 * wire::MAX_CHUNK];
        f.files.queue(&f.r.peer, offer(1, data.len() as u64), data);
        let mut c = open_files(&f);
        c.poll(T0);
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[1; 16], 0), T0);
        assert!(matches!(c.poll(later(1)), Step::Reply(wire::TAG_CHUNK, _)));
        f.files.withdraw(&f.r.peer, &[1; 16]);
        assert_eq!(c.poll(later(2)), reply(wire::TAG_CANCEL, &[1; 16]));
        assert_eq!(
            f.files.outcomes(),
            vec![([1; 16], SendOutcome::Interrupted)]
        );
    }

    #[test]
    fn an_accepted_waiting_file_the_device_gives_up_on_early_is_done() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(1, 3), vec![1; 3]);
        f.files.queue(&f.r.peer, offer(2, 4), vec![2; 4]);
        let mut c = open_files(&f);
        c.poll(T0);
        c.on_frame(
            wire::TAG_WAIT,
            &wire::encode_wait(&[1; 16], WaitReason::Large),
            T0,
        );
        c.poll(later(1));
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[2; 16], 0), T0);
        // 1 accepted while 2 streams, then the device is full
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[1; 16], 0), T0);
        let full = wire::encode_result(&[1; 16], ResultCode::Full);
        assert_eq!(c.on_frame(wire::TAG_RESULT, &full, T0), Step::Continue);
        assert_eq!(
            f.files.outcomes().last(),
            Some(&([1; 16], SendOutcome::Done(ResultCode::Full)))
        );
    }

    #[test]
    fn answers_for_a_file_never_offered_close() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(14, 5), vec![5; 5]);
        for bad in [
            (wire::TAG_ACCEPT, wire::encode_accept(&[15; 16], 0).to_vec()),
            (wire::TAG_ACCEPT, wire::encode_accept(&[14; 16], 6).to_vec()),
            (
                wire::TAG_RESULT,
                wire::encode_result(&[14; 16], ResultCode::Ok).to_vec(),
            ),
            (
                wire::TAG_WAIT,
                wire::encode_wait(&[15; 16], WaitReason::Large).to_vec(),
            ),
        ] {
            let mut c = open_files(&f);
            c.poll(T0);
            assert_eq!(c.on_frame(bad.0, &bad.1, T0), Step::Close, "{:#04x}", bad.0);
        }
    }
}
