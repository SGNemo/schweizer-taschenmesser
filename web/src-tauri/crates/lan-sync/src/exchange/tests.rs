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
    use crate::exchange::files::{Decision, MemoryFiles, SendOutcome};
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
        let o = offer(1, data.len() as u64);
        assert_eq!(
            c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&o), T0),
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
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].bytes, data);
        assert_eq!(got[0].result, Some(ResultCode::Ok));
        // the transfer is over: a late chunk is a broken peer
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(1, 0, &[1]), T0),
            Step::Close
        );
    }

    #[test]
    fn a_gap_a_second_offer_or_bytes_past_the_size_close_and_keep_the_part() {
        let f = file_rig();
        for bad in [
            (wire::TAG_CHUNK, chunk(1, 5, &[0; 5])),             // gap
            (wire::TAG_CHUNK, chunk(1, 0, &[0; 11])),            // past the size
            (wire::TAG_CHUNK, chunk(2, 0, &[0; 5])),             // another id
            (wire::TAG_OFFER, wire::encode_offer(&offer(2, 1))), // second offer
            (wire::TAG_END, vec![2; 16]),                        // end of another id
        ] {
            let mut c = open_files(&f);
            c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&offer(1, 10)), T0);
            assert_eq!(c.on_frame(bad.0, &bad.1, T0), Step::Close, "{:#04x}", bad.0);
        }
        // every closed transfer was left to the shell for a resume
        assert_eq!(f.files.interruptions().len(), 5);
    }

    #[test]
    fn offers_are_refused_or_wait_for_the_user() {
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
        // the shell refuses
        f.files.set_decision(Decision::Refuse(RefuseCode::Full));
        assert_eq!(
            c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&offer(4, 5)), T0),
            reply(
                wire::TAG_REFUSE,
                &wire::encode_refuse(&[4; 16], RefuseCode::Full)
            )
        );
        // the shell waits for its user: no chunk before the answer
        f.files.set_decision(Decision::Wait(WaitReason::Large));
        assert_eq!(
            c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&offer(5, 5)), T0),
            reply(
                wire::TAG_WAIT,
                &wire::encode_wait(&[5; 16], WaitReason::Large)
            )
        );
        assert_eq!(c.poll(T0), Step::Continue);
        f.files.decide_later([5; 16], Decision::Accept { from: 0 });
        assert_eq!(
            c.poll(T0),
            reply(wire::TAG_ACCEPT, &wire::encode_accept(&[5; 16], 0))
        );
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(5, 0, b"Hallo"), T0),
            Step::Continue
        );
        assert_eq!(
            c.on_frame(wire::TAG_END, &[5; 16], T0),
            reply(
                wire::TAG_RESULT,
                &wire::encode_result(&[5; 16], ResultCode::Ok)
            )
        );
        // a chunk of a waiting offer is a broken peer
        f.files.set_decision(Decision::Wait(WaitReason::Daily));
        c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&offer(6, 5)), T0);
        assert_eq!(
            c.on_frame(wire::TAG_CHUNK, &chunk(6, 0, b"x"), T0),
            Step::Close
        );
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
        // nothing more until the device answers
        assert_eq!(c.poll(T0), Step::Continue);
        assert_eq!(
            c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[7; 16], 0), T0),
            Step::Continue
        );
        let mut got = Vec::new();
        loop {
            match c.poll(T0) {
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
        assert_eq!(c.poll(T0), Step::Continue, "waits for the result");
        assert_eq!(
            c.on_frame(
                wire::TAG_RESULT,
                &wire::encode_result(&[7; 16], ResultCode::Ok),
                T0
            ),
            Step::Continue
        );
        assert_eq!(
            f.files.outcomes(),
            vec![([7; 16], SendOutcome::Done(ResultCode::Ok))]
        );
        assert_eq!(f.files.next_offer_for(&f.r.peer), None);
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
        let Step::Reply(wire::TAG_CHUNK, body) = c.poll(T0) else {
            panic!("a chunk");
        };
        let (_, offset, bytes) = wire::decode_chunk(&body).unwrap();
        assert_eq!(offset, from);
        assert_eq!(bytes, &data[from as usize..from as usize + bytes.len()]);
        // a text item for the device goes before the next chunk
        f.r.outbox
            .push(&f.r.peer, item(9, Kind::Text, "Zwischendurch"));
        assert!(matches!(c.poll(T0), Step::Reply(wire::TAG_ITEM, _)));
        assert!(matches!(c.poll(T0), Step::Reply(wire::TAG_CHUNK, _)));
    }

    #[test]
    fn an_unfinished_transfer_is_left_to_the_shell_and_a_device_cancel_drops_the_file() {
        let f = file_rig();
        f.files.queue(&f.r.peer, offer(10, 100), vec![1; 100]);
        {
            let mut c = open_files(&f);
            c.poll(T0);
            c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[10; 16], 0), T0);
            c.on_frame(wire::TAG_OFFER, &wire::encode_offer(&offer(11, 50)), T0);
            c.on_frame(wire::TAG_CHUNK, &chunk(11, 0, &[2; 20]), T0);
            // the session ends (dropped) with both transfers open
        }
        assert_eq!(
            f.files.outcomes(),
            vec![([10; 16], SendOutcome::Interrupted)]
        );
        assert_eq!(f.files.interruptions(), vec![[11; 16]]);
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
        // a cancel that crossed an ended transfer is no error
        assert_eq!(c.on_frame(wire::TAG_CANCEL, &[10; 16], T0), Step::Continue);
    }

    #[test]
    fn a_file_that_cannot_be_read_is_cancelled_and_a_refused_one_not_offered_again() {
        let f = file_rig();
        // offered as 100 bytes, only 40 there
        f.files.queue(&f.r.peer, offer(12, 100), vec![3; 40]);
        f.files.queue(&f.r.peer, offer(13, 5), vec![4; 5]);
        let mut c = open_files(&f);
        c.poll(T0);
        c.on_frame(wire::TAG_ACCEPT, &wire::encode_accept(&[12; 16], 0), T0);
        assert!(matches!(c.poll(T0), Step::Reply(wire::TAG_CHUNK, _)));
        assert_eq!(c.poll(T0), reply(wire::TAG_CANCEL, &[12; 16]));
        assert_eq!(
            f.files.outcomes(),
            vec![([12; 16], SendOutcome::Interrupted)]
        );
        // the next file is offered; the broken one stays queued for the shell, not again here
        assert_eq!(
            c.poll(T0),
            reply(wire::TAG_OFFER, &wire::encode_offer(&offer(13, 5)))
        );
        let refuse = wire::encode_refuse(&[13; 16], RefuseCode::Declined);
        assert_eq!(c.on_frame(wire::TAG_REFUSE, &refuse, T0), Step::Continue);
        assert_eq!(
            c.poll(T0),
            Step::Continue,
            "nothing is offered twice in a session"
        );
    }

    #[test]
    fn answers_for_another_file_close() {
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
