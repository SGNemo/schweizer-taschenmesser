use super::netpolicy::*;
use super::router::*;
use super::validate::*;
use super::*;
use crate::endpoint::Endpoint;
use crate::noise::frame::{MODE_PAIR, PROLOGUE_BASE, TAG_DATA_KEY, TAG_HELLO, TAG_UNPAIR};
use crate::noise::{self, Finished, Mode, Psk, StaticKey, Transport};
use crate::pairing::{
    qr, CancelReason, DataKey, DataKeyError, DataKeyProvider, ManualClock, PairingEvent,
    PairingHost, WINDOW,
};
use crate::trust::{MemoryKeyStore, MemoryTrustStore, SessionRegistry, StaticKeyStore, TrustStore};
use crate::{FieldOp, Store};
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::Arc;
use std::time::Duration;
use zeroize::Zeroizing;

const NOW_MS: u64 = 1_700_000_000_000;

fn hlc(i: u32) -> String {
    format!("{:013}-{:04}-aaaa0001", NOW_MS - 1000, i)
}

fn op(id: &str, i: u32) -> FieldOp {
    FieldOp {
        collection: "todos_task".into(),
        id: id.into(),
        field: "title".into(),
        hlc: hlc(i),
        value: json!(format!("enc:v1:iv{i}:data")),
    }
}

fn hub_with_sessions(version: u32) -> (Hub, Arc<SessionRegistry>) {
    let sessions = Arc::new(SessionRegistry::new());
    (
        Hub::new(Store::open(":memory:").unwrap(), version, sessions.clone()),
        sessions,
    )
}

fn hub() -> Hub {
    hub_with_sessions(1).0
}

fn push(h: &Hub, v: u32, ops: Vec<FieldOp>) -> Result<Response, HubError> {
    h.handle(v, Request::Push { ops }, NOW_MS)
}

fn pull_all(h: &Hub) -> Response {
    h.handle(
        h.key_version().unwrap(),
        Request::Pull {
            since: 0,
            limit: 5000,
        },
        NOW_MS,
    )
    .unwrap()
}

/// Everything a refused request must leave alone: stored ops, epoch, key version.
fn snapshot(h: &Hub) -> (Response, u32) {
    (pull_all(h), h.key_version().unwrap())
}

/// A valid push after refusals gets exactly the next `seq`: the refused ops took none.
fn assert_next_seq_is(h: &Hub, expected: i64) {
    match push(h, h.key_version().unwrap(), vec![op("probe", 999)]).unwrap() {
        Response::Push {
            accepted, cursor, ..
        } => assert_eq!((accepted, cursor), (1, expected)),
        other => panic!("{other:?}"),
    }
}

// ---------- validation ----------

#[test]
fn hlc_shape_table() {
    let ok = [
        "0000000001000-0000-aaaa0001",
        "1700000000000-9999-a",
        "1700000000000-0001-abcdefghijklmnopqrstuvwxyz012345",
    ];
    for h in ok {
        assert!(parse_hlc_wall(h).is_some(), "{h}");
    }
    let bad = [
        "",
        "0000000001000-0000-",
        "0000000001000-0000-AAAA",  // upper case
        "000000001000-0000-aaaa",   // 12 digits
        "00000000010000-0000-aaaa", // 14 digits
        "0000000001000_0000_aaaa",  // separators
        "0000000001000-0000-abcdefghijklmnopqrstuvwxyz0123456", // 33 chars
        "0000000001000-0000-аaaa0001", // Cyrillic a
        "٠٠٠٠٠٠٠٠٠١٠٠٠-0000-aaaa",  // Arabic-Indic digits
        "0000000001000-0000-aaaa\n",
        "0000000001000-0000-aa-aa",
        "0000000001000-00a0-aaaa",
    ];
    for h in bad {
        assert!(parse_hlc_wall(h).is_none(), "{h:?}");
    }
}

/// Why ASCII-only matters: Rust compares bytes, the client UTF-16 code units. On everything the
/// validator accepts both orders are identical (checked on a deterministic pseudo-random sample).
#[test]
fn accepted_hlcs_sort_like_utf16() {
    let alphabet: Vec<char> = "0123456789-abcxyzAZ\u{0430}\u{e9}\u{1F600}"
        .chars()
        .collect();
    let mut x: u64 = 0x2545F4914F6CDD1D;
    let mut next = || {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        x
    };
    let mut accepted: Vec<String> = Vec::new();
    for _ in 0..40_000 {
        // mostly well-formed shape with a few mutated characters
        let mut s: Vec<char> = format!(
            "{:013}-{:04}-{}",
            next() % 10_000_000_000_000,
            next() % 10_000,
            "abz09"
        )
        .chars()
        .collect();
        for _ in 0..(next() % 3) {
            let at = (next() as usize) % s.len();
            s[at] = alphabet[(next() as usize) % alphabet.len()];
        }
        let s: String = s.into_iter().collect();
        if parse_hlc_wall(&s).is_some() {
            accepted.push(s);
        }
    }
    assert!(accepted.len() > 1000);
    for w in accepted.windows(2) {
        let utf16 = w[0]
            .encode_utf16()
            .collect::<Vec<_>>()
            .cmp(&w[1].encode_utf16().collect::<Vec<_>>());
        assert_eq!(w[0].as_bytes().cmp(w[1].as_bytes()), utf16, "{w:?}");
    }
}

fn bad_ops() -> Vec<(HubError, FieldOp)> {
    let mut out = vec![];
    let base = op("r1", 1);
    for h in [
        "0000000001000-0000-аaaa0001".to_string(), // Cyrillic
        format!("{}é", hlc(1)),
        format!("{}-{}", hlc(1), "x".repeat(40)),
        "".to_string(),
        "0000000001000-0000-AAAA0001".to_string(),
    ] {
        out.push((
            HubError::BadHlc,
            FieldOp {
                hlc: h,
                ..base.clone()
            },
        ));
    }
    out.push((
        HubError::HlcDrift,
        FieldOp {
            hlc: format!("{:013}-0000-aaaa0001", NOW_MS + MAX_HLC_DRIFT_MS + 1),
            ..base.clone()
        },
    ));
    for v in [
        json!(null),
        json!(1),
        json!({}),
        json!([]),
        json!("plain"),
        json!("ENC:v1:x"),
        json!(" enc:v1:x"),
        json!("enc:v2:x"),
        json!(true),
    ] {
        out.push((
            HubError::MissingEnc,
            FieldOp {
                value: v,
                ..base.clone()
            },
        ));
    }
    out.push((
        HubError::ValueTooLarge,
        FieldOp {
            value: json!(format!("enc:v1:{}", "a".repeat(MAX_VALUE_BYTES))),
            ..base.clone()
        },
    ));
    for (c, i, f) in [
        ("", "r1", "title"),
        ("1bad", "r1", "title"),
        ("has space", "r1", "title"),
        ("todos_task", "", "title"),
        ("todos_task", "r1", ""),
    ] {
        out.push((
            HubError::BadOp,
            FieldOp {
                collection: c.into(),
                id: i.into(),
                field: f.into(),
                ..base.clone()
            },
        ));
    }
    out.push((
        HubError::BadOp,
        FieldOp {
            id: "i".repeat(129),
            ..base.clone()
        },
    ));
    out.push((
        HubError::BadOp,
        FieldOp {
            field: "f".repeat(65),
            ..base.clone()
        },
    ));
    out
}

/// Each rule × bad op first / in the middle / last: refused as a whole, store, `seq`, epoch and
/// key version unchanged.
#[test]
fn refused_batches_leave_the_hub_untouched() {
    let h = hub();
    push(&h, 1, vec![op("seed1", 1), op("seed2", 2)]).unwrap();
    let before = snapshot(&h);
    for (want, bad) in bad_ops() {
        for at in 0..3 {
            let mut batch = vec![op("g1", 10), op("g2", 11)];
            batch.insert(at, bad.clone());
            assert_eq!(push(&h, 1, batch), Err(want), "{want:?} at {at}");
            assert_eq!(snapshot(&h), before, "{want:?} at {at}");
        }
    }
    assert_next_seq_is(&h, 3);
}

#[test]
fn too_many_ops_and_boundaries() {
    let h = hub();
    let many = |n: usize| -> Vec<FieldOp> { (0..n).map(|i| op(&format!("g{i}"), 1)).collect() };
    let before = snapshot(&h);
    assert_eq!(
        push(&h, 1, many(MAX_OPS_PER_PUSH + 1)),
        Err(HubError::TooManyOps)
    );
    assert_eq!(snapshot(&h), before);
    assert!(matches!(
        push(&h, 1, many(MAX_OPS_PER_PUSH)),
        Ok(Response::Push {
            accepted: 5000,
            cursor: 5000,
            ..
        })
    ));
    // empty batch is fine (like the server)
    assert!(matches!(
        push(&h, 1, vec![]),
        Ok(Response::Push { accepted: 0, .. })
    ));
    // value exactly at the limit passes, one more does not
    let pad = "enc:v1:".len();
    let at_limit = FieldOp {
        value: json!(format!("enc:v1:{}", "a".repeat(MAX_VALUE_BYTES - 2 - pad))),
        ..op("big", 5)
    };
    assert!(matches!(
        push(&h, 1, vec![at_limit]),
        Ok(Response::Push { accepted: 1, .. })
    ));
    // drift: exactly now + 1 h passes
    let edge = FieldOp {
        hlc: format!("{:013}-0000-aaaa0001", NOW_MS + MAX_HLC_DRIFT_MS),
        ..op("edge", 0)
    };
    assert!(matches!(
        push(&h, 1, vec![edge]),
        Ok(Response::Push { accepted: 1, .. })
    ));
}

#[test]
fn tombstones_are_encrypted_like_every_other_value() {
    let h = hub();
    let del = |v: Value| FieldOp {
        field: "deletedAt".into(),
        value: v,
        ..op("r1", 1)
    };
    assert_eq!(
        push(&h, 1, vec![del(json!(null))]),
        Err(HubError::MissingEnc)
    );
    assert_eq!(
        push(&h, 1, vec![del(json!(1700000000000u64))]),
        Err(HubError::MissingEnc)
    );
    assert!(push(&h, 1, vec![del(json!("enc:v1:iv:data"))]).is_ok());
}

// ---------- handler, JSON, contract ----------

fn call(h: &Hub, body: &str) -> Value {
    serde_json::from_slice(&h.handle_json(body.as_bytes(), NOW_MS)).unwrap()
}

#[test]
fn json_round_trip_and_shapes() {
    let h = hub();
    let put = call(
        &h,
        &json!({"keyVersion":1,"type":"push","ops":[op("r1",1)]}).to_string(),
    );
    assert_eq!(put["accepted"], 1);
    assert_eq!(put["cursor"], 1);
    let epoch = put["epoch"].as_str().unwrap().to_owned();
    let got = call(&h, r#"{"keyVersion":1,"type":"pull"}"#);
    assert_eq!(got["ops"].as_array().unwrap().len(), 1);
    assert_eq!(
        (got["cursor"].clone(), got["more"].clone()),
        (json!(1), json!(false))
    );
    assert_eq!(got["epoch"], epoch);
    assert_eq!(
        call(&h, r#"{"keyVersion":1,"type":"info"}"#),
        json!({"epoch": epoch, "keyVersion": 1})
    );
}

#[test]
fn bad_requests_get_a_code_and_change_nothing() {
    let h = hub();
    push(&h, 1, vec![op("r1", 1)]).unwrap();
    let before = snapshot(&h);
    let cases: [(&str, &str); 14] = [
        ("", "bad-request"),
        ("{", "bad-request"),
        ("[]", "bad-request"),
        (r#"{"type":"info"}"#, "bad-request"),
        (r#"{"keyVersion":"1","type":"info"}"#, "bad-request"),
        (r#"{"keyVersion":-1,"type":"info"}"#, "bad-request"),
        (r#"{"keyVersion":1,"type":"reset"}"#, "bad-request"),
        (r#"{"keyVersion":1,"type":"push"}"#, "bad-request"),
        (
            r#"{"keyVersion":1,"type":"push","ops":[{"id":"x"}]}"#,
            "bad-request",
        ),
        (
            r#"{"keyVersion":1,"type":"pull","since":-1}"#,
            "bad-request",
        ),
        (r#"{"keyVersion":1,"type":"pull","limit":0}"#, "bad-request"),
        (
            r#"{"keyVersion":1,"type":"pull","limit":5001}"#,
            "limit-too-large",
        ),
        (r#"{"keyVersion":2,"type":"info"}"#, "stale-key-version"),
        (r#"{"keyVersion":0,"type":"pull"}"#, "stale-key-version"),
    ];
    for (body, code) in cases {
        assert_eq!(call(&h, body), json!({ "error": code }), "{body}");
    }
    let huge = vec![b' '; MAX_REQUEST_BYTES + 1];
    assert_eq!(
        serde_json::from_slice::<Value>(&h.handle_json(&huge, NOW_MS)).unwrap(),
        json!({"error": "bad-request"})
    );
    assert_eq!(snapshot(&h), before);
}

#[test]
fn key_version_is_checked_before_validation() {
    let h = hub();
    // a stale client with a broken batch learns only that it is stale
    let bad = FieldOp {
        value: json!("plain"),
        ..op("r1", 1)
    };
    assert_eq!(push(&h, 7, vec![bad]), Err(HubError::StaleKeyVersion));
}

fn wrap(v: &Value) -> Value {
    json!(format!("enc:v1:{v}"))
}

fn contract_ops(v: &Value) -> Vec<FieldOp> {
    let mut ops: Vec<FieldOp> = serde_json::from_value(v.clone()).unwrap();
    for o in &mut ops {
        o.value = wrap(&o.value);
    }
    ops
}

/// The `handler` level of `contract/sync-paging-cases.json`, as the hub answers it (values are
/// wrapped as `enc:v1:` first: the hub refuses anything else).
#[test]
fn paging_contract_handler_cases() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../contract/sync-paging-cases.json"
    );
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let mut run = 0;
    for c in doc["cases"].as_array().unwrap() {
        if c["level"] != "handler" {
            continue;
        }
        run += 1;
        let name = c["name"].as_str().unwrap();
        let h = hub();
        for step in c["steps"].as_array().unwrap() {
            let want = &step["expect"];
            let got = if let Some(batch) = step.get("push") {
                push(&h, 1, contract_ops(batch))
            } else if let Some(n) = step.get("pushGenerated") {
                let ops: Vec<FieldOp> = (0..n.as_u64().unwrap())
                    .map(|i| FieldOp {
                        collection: "todos_task".into(),
                        id: format!("g{i}"),
                        field: "title".into(),
                        hlc: format!("0000000001000-{i}-aaaa0001"),
                        value: wrap(&json!(i)),
                    })
                    .collect();
                // the contract's hlc counter is not zero-padded; pad it for the real format
                let ops = ops
                    .into_iter()
                    .enumerate()
                    .map(|(i, mut o)| {
                        o.hlc = format!("0000000001000-{:04}-aaaa0001", i % 10_000);
                        o
                    })
                    .collect();
                push(&h, 1, ops)
            } else if let Some(p) = step.get("pull") {
                h.handle(
                    1,
                    Request::Pull {
                        since: p["since"].as_i64().unwrap(),
                        limit: p["limit"].as_i64().unwrap(),
                    },
                    NOW_MS,
                )
            } else {
                panic!("{name}: unknown step {step}");
            };
            if let Some(err) = want.get("error") {
                assert_eq!(got.unwrap_err().code(), err.as_str().unwrap(), "{name}");
                continue;
            }
            match got.unwrap() {
                Response::Push {
                    accepted, cursor, ..
                } => {
                    assert_eq!(accepted as u64, want["accepted"], "{name}: accepted");
                    assert_eq!(cursor as u64, want["cursor"], "{name}: cursor");
                }
                Response::Pull {
                    ops, cursor, more, ..
                } => {
                    if let Some(w) = want.get("ops") {
                        assert_eq!(&serde_json::to_value(&ops).unwrap(), w, "{name}: ops");
                    }
                    if let Some(n) = want.get("count") {
                        assert_eq!(ops.len() as u64, *n, "{name}: count");
                    }
                    assert_eq!(cursor as u64, want["cursor"], "{name}: cursor");
                    assert_eq!(more, want["more"], "{name}: more");
                }
                other => panic!("{name}: {other:?}"),
            }
        }
    }
    assert!(run >= 3, "handler-level cases are missing");
}

// ---------- rotation ----------

#[test]
fn rotation_wipes_the_store_and_refuses_the_old_version() {
    let (h, sessions) = hub_with_sessions(1);
    push(&h, 1, vec![op("r1", 1)]).unwrap();
    let epoch_before = match h.handle(1, Request::Info, NOW_MS).unwrap() {
        Response::Info { epoch, .. } => epoch,
        o => panic!("{o:?}"),
    };
    let key = StaticKey::generate().unwrap().public();
    let handle = sessions.register(key);
    let r = h.rotate_to(2).unwrap();
    assert_eq!(r.version, 2);
    assert_ne!(r.epoch, epoch_before);
    assert!(handle.is_closed(), "open sessions end");
    assert_eq!(sessions.open_count(), 0);
    // a push encrypted under 1 that arrives after the wipe is refused and stores nothing
    assert_eq!(
        push(&h, 1, vec![op("late", 2)]),
        Err(HubError::StaleKeyVersion)
    );
    match pull_all(&h) {
        Response::Pull { ops, epoch, .. } => {
            assert!(ops.is_empty());
            assert_eq!(epoch, r.epoch);
        }
        o => panic!("{o:?}"),
    }
    assert!(push(&h, 2, vec![op("new", 3)]).is_ok());
    assert_next_seq_is(&h, 2);
}

#[test]
fn rotation_only_to_the_next_version_and_never_wraps() {
    let h = hub();
    push(&h, 1, vec![op("r1", 1)]).unwrap();
    let before = snapshot(&h);
    for bad in [0, 1, 3, u32::MAX] {
        assert_eq!(h.rotate_to(bad), Err(HubError::BadRequest));
    }
    assert_eq!(snapshot(&h), before);
    let (maxed, _) = hub_with_sessions(u32::MAX);
    assert_eq!(maxed.rotate_to(0), Err(HubError::BadRequest));
}

#[test]
fn old_version_pushes_racing_a_rotation_never_survive_it() {
    for _ in 0..20 {
        let h = Arc::new(hub());
        let pushers: Vec<_> = (0..4)
            .map(|t| {
                let h = h.clone();
                std::thread::spawn(move || {
                    for i in 0..200 {
                        let _ = push(&h, 1, vec![op(&format!("t{t}-{i}"), 1)]);
                    }
                })
            })
            .collect();
        std::thread::yield_now();
        h.rotate_to(2).unwrap();
        for p in pushers {
            p.join().unwrap();
        }
        match pull_all(&h) {
            Response::Pull { ops, .. } => assert!(ops.is_empty(), "a version-1 value survived"),
            o => panic!("{o:?}"),
        }
    }
}

// ---------- address policy ----------

fn v4(s: &str) -> IpAddr {
    IpAddr::V4(s.parse().unwrap())
}

#[test]
fn allowed_hub_addresses() {
    for ok in [
        "10.0.0.5",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.1.20",
        "169.254.3.4",
    ] {
        assert!(is_allowed_hub_addr(v4(ok)), "{ok}");
    }
    for no in [
        "0.0.0.0",
        "127.0.0.1",
        "255.255.255.255",
        "224.0.0.251",
        "8.8.8.8",
        "100.64.0.1", // CGNAT
        "172.32.0.1",
        "172.15.0.1",
        "192.169.0.1",
    ] {
        assert!(!is_allowed_hub_addr(v4(no)), "{no}");
    }
    for no in [
        "::",
        "::1",
        "fe80::1",
        "fd00::1",
        "::ffff:192.168.1.5",
        "::ffff:10.0.0.1",
    ] {
        assert!(
            !is_allowed_hub_addr(IpAddr::V6(no.parse::<Ipv6Addr>().unwrap())),
            "{no}"
        );
    }
}

struct Net(Result<Vec<IfaceInfo>, NetError>);
impl NetworkInfo for Net {
    fn interfaces(&self) -> Result<Vec<IfaceInfo>, NetError> {
        self.0.clone()
    }
}
struct Home(Result<Option<String>, NetError>);
impl HomeNetworkStore for Home {
    fn home_network_id(&self) -> Result<Option<String>, NetError> {
        self.0.clone()
    }
}

fn iface(ip: &str, route: bool, cat: NetCategory, id: Option<&str>) -> IfaceInfo {
    IfaceInfo {
        ip: ip.parse().unwrap(),
        prefix: 24,
        has_default_route: route,
        category: cat,
        network_id: id.map(str::to_owned),
    }
}

fn fixture() -> Vec<IfaceInfo> {
    use NetCategory::*;
    vec![
        iface("192.168.1.20", true, Private, Some("home")), // Ethernet
        iface("172.20.0.1", false, Private, Some("wsl")),   // WSL2 / Hyper-V, no default route
        iface("172.17.0.1", false, Private, None),          // Docker
        iface("203.0.113.9", true, Public, Some("vpn")),    // VPN with a public address
        iface("127.0.0.1", true, Private, Some("lo")),
        iface("0.0.0.0", true, Private, Some("any")),
        iface("fe80::1", true, Private, Some("home")),
        iface("100.64.1.1", true, Private, Some("home")), // CGNAT
    ]
}

fn want(window: bool, devices: usize) -> Wanted {
    Wanted {
        pairing_window_open: window,
        paired_devices: devices,
    }
}

#[test]
fn bind_set_is_enumerated_and_never_wildcard_or_loopback() {
    let net = Net(Ok(fixture()));
    for (w, home) in [
        (want(true, 0), Home(Ok(None))),
        (want(false, 1), Home(Ok(Some("home".into())))),
        (want(true, 2), Home(Ok(Some("home".into())))),
    ] {
        let Decision::On(binds) = decide(&net, &home, w) else {
            panic!("off")
        };
        assert_eq!(
            binds,
            vec![Bind {
                ip: Ipv4Addr::new(192, 168, 1, 20),
                prefix: 24
            }]
        );
        for b in &binds {
            assert!(!b.ip.is_unspecified() && !b.ip.is_loopback());
        }
    }
}

#[test]
fn listening_is_fail_closed() {
    use NetCategory::*;
    let good = Net(Ok(fixture()));
    let home = Home(Ok(Some("home".into())));
    // nothing wanted: no listener whatever the network looks like
    assert_eq!(
        decide(&good, &home, want(false, 0)),
        Decision::Off(OffReason::NothingWanted)
    );
    // unreadable interface list / home store
    assert_eq!(
        decide(&Net(Err(NetError)), &home, want(true, 0)),
        Decision::Off(OffReason::NetworkUnreadable)
    );
    assert_eq!(
        decide(&good, &Home(Err(NetError)), want(false, 1)),
        Decision::Off(OffReason::NetworkUnreadable)
    );
    // paired devices but no stored home network
    assert_eq!(
        decide(&good, &Home(Ok(None)), want(false, 1)),
        Decision::Off(OffReason::NoHomeNetwork)
    );
    // another network than the home network
    assert_eq!(
        decide(&good, &Home(Ok(Some("cafe".into()))), want(false, 1)),
        Decision::Off(OffReason::NoQualifyingInterface)
    );
    // interface without a network id never matches a home network
    let no_id = Net(Ok(vec![iface("192.168.1.20", true, Private, None)]));
    assert_eq!(
        decide(&no_id, &home, want(false, 1)),
        Decision::Off(OffReason::NoQualifyingInterface)
    );
    // "Public" network (category) and an unknown category: off, public is reported as such
    for (cat, reason) in [
        (Public, OffReason::PublicNetwork),
        (Domain, OffReason::NoQualifyingInterface),
        (Unknown, OffReason::NoQualifyingInterface),
    ] {
        let n = Net(Ok(vec![iface("192.168.1.20", true, cat, Some("home"))]));
        assert_eq!(
            decide(&n, &home, want(true, 1)),
            Decision::Off(reason),
            "{cat:?}"
        );
    }
    // public address on an otherwise private network
    let pubaddr = Net(Ok(vec![iface("8.8.8.8", true, Private, Some("home"))]));
    assert!(matches!(
        decide(&pubaddr, &home, want(true, 1)),
        Decision::Off(_)
    ));
    // no list at all
    assert!(matches!(
        decide(&Net(Ok(vec![])), &home, want(true, 0)),
        Decision::Off(_)
    ));
}

#[test]
fn listening_state_machine() {
    assert!(!want(false, 0).listening());
    assert!(want(true, 0).listening());
    assert!(want(false, 1).listening());
}

#[test]
fn peers_must_be_private_and_inside_a_bound_subnet() {
    let binds = [Bind {
        ip: Ipv4Addr::new(192, 168, 1, 20),
        prefix: 24,
    }];
    assert!(peer_allowed(v4("192.168.1.77"), &binds));
    for no in [
        "192.168.2.77",
        "8.8.8.8",
        "127.0.0.1",
        "0.0.0.0",
        "10.0.0.1",
        "100.64.0.9",
    ] {
        assert!(!peer_allowed(v4(no), &binds), "{no}");
    }
    let mapped = IpAddr::V6("::ffff:192.168.1.77".parse().unwrap());
    assert!(!peer_allowed(mapped, &binds));
    assert!(!peer_allowed(v4("192.168.1.77"), &[]));
    // a /0 or out-of-range prefix never opens everything
    assert!(!Bind {
        ip: Ipv4Addr::new(10, 0, 0, 1),
        prefix: 33
    }
    .contains(Ipv4Addr::new(10, 0, 0, 2)));
}

// ---------- admission ----------

fn adm() -> Admission {
    let mut a = Admission::new();
    a.set_binds(vec![Bind {
        ip: Ipv4Addr::new(10, 0, 0, 1),
        prefix: 16,
    }]);
    a
}

const T0: Duration = Duration::from_secs(1000);

#[test]
fn admission_refuses_by_address_then_size() {
    let mut a = adm();
    for no in ["8.8.8.8", "127.0.0.1", "192.168.1.5", "10.1.0.1"] {
        assert_eq!(a.admit(v4(no), 97, T0), Err(Refusal::Address), "{no}");
    }
    assert_eq!(
        a.admit(IpAddr::V6("::ffff:10.0.0.7".parse().unwrap()), 97, T0),
        Err(Refusal::Address)
    );
    assert_eq!(a.admit(v4("10.0.0.7"), 257, T0), Err(Refusal::Oversize));
    assert_eq!(a.admit(v4("10.0.0.7"), 256, T0), Ok(()));
    assert_eq!(
        Admission::new().admit(v4("10.0.0.7"), 1, T0),
        Err(Refusal::Address)
    );
}

#[test]
fn handshake_rate_limit_per_address_and_recovery() {
    let mut a = adm();
    let me = v4("10.0.0.7");
    for _ in 0..HANDSHAKES_PER_WINDOW {
        assert_eq!(a.admit(me, 97, T0), Ok(()));
    }
    assert_eq!(a.admit(me, 97, T0), Err(Refusal::RateLimited));
    assert_eq!(
        a.admit(me, 97, T0 + RATE_WINDOW - Duration::from_secs(1)),
        Err(Refusal::RateLimited)
    );
    assert_eq!(
        a.admit(v4("10.0.0.8"), 97, T0),
        Ok(()),
        "other addresses are not affected"
    );
    assert_eq!(
        a.admit(me, 97, T0 + RATE_WINDOW),
        Ok(()),
        "a new window starts"
    );
}

#[test]
fn rate_table_is_bounded_and_fails_closed() {
    let mut a = adm();
    let addr = |i: usize| IpAddr::V4(Ipv4Addr::new(10, 0, (i / 250) as u8, (i % 250) as u8 + 1));
    // refused peers never take a slot
    for i in 0..3000 {
        let _ = a.admit(v4(&format!("8.8.{}.{}", i / 250, i % 250)), 97, T0);
    }
    for i in 0..MAX_TRACKED_ADDRS {
        assert_eq!(a.admit(addr(i), 97, T0), Ok(()));
    }
    assert_eq!(
        a.admit(addr(MAX_TRACKED_ADDRS), 97, T0),
        Err(Refusal::RateLimited)
    );
    // known address still works while the table is full
    assert_eq!(a.admit(addr(0), 97, T0), Ok(()));
    // expired entries make room again
    assert_eq!(
        a.admit(addr(MAX_TRACKED_ADDRS), 97, T0 + RATE_WINDOW),
        Ok(())
    );
}

// ---------- router: one connection, one attempt ----------

struct Keys;
impl DataKeyProvider for Keys {
    fn current(&self) -> Result<DataKey, DataKeyError> {
        Ok(DataKey {
            version: 1,
            key: Zeroizing::new([5u8; 32]),
        })
    }
}

struct R {
    router: Router,
    host: Arc<PairingHost>,
    trust: Arc<MemoryTrustStore>,
    hub: Arc<Hub>,
    clock: Arc<ManualClock>,
    sessions: Arc<SessionRegistry>,
    hub_key: noise::PublicKey,
}

const PEER: &str = "10.0.0.7";

fn rig() -> R {
    let keys = MemoryKeyStore::empty();
    let hub_key = keys.load_or_create().unwrap().public();
    let clock = Arc::new(ManualClock::new());
    let trust = Arc::new(MemoryTrustStore::new());
    let host = Arc::new(PairingHost::new(
        hub_key,
        clock.clone(),
        trust.clone(),
        Arc::new(Keys),
    ));
    let sessions = Arc::new(SessionRegistry::new());
    let ep = Endpoint::start(&keys, trust.clone(), host.clone(), sessions.clone()).unwrap();
    let hub = Arc::new(Hub::new(
        Store::open(":memory:").unwrap(),
        1,
        sessions.clone(),
    ));
    let router = Router::new(ep, host.clone(), hub.clone(), adm());
    R {
        router,
        host,
        trust,
        hub,
        clock,
        sessions,
        hub_key,
    }
}

fn accept(r: &R, wire: &[u8]) -> Opened {
    r.router.accept(v4(PEER), wire, T0)
}

/// Pairing client: first message under the current QR secret.
fn pair_start(r: &R, key: &StaticKey) -> (noise::Initiator, Vec<u8>) {
    let q = qr::decode(&r.host.qr(4000, [10, 0, 0, 1]).unwrap().unwrap()).unwrap();
    noise::start_initiator(
        Mode::Pair,
        key,
        &q.hub_key,
        Some(&Psk::from_secret(&q.secret)),
    )
    .unwrap()
}

struct Paired {
    conn: Box<Connection>,
    transport: Transport,
    attempt: u64,
    code: String,
}

/// Opens a window, runs the pairing up to (and including) the hello; the code is on screen.
fn pair_until_hello(r: &R, key: &StaticKey, name: &str) -> Paired {
    r.host.open().unwrap();
    let (init, wire) = pair_start(r, key);
    let Opened::Accept { m2, mut conn } = accept(r, &wire) else {
        panic!("pairing not accepted")
    };
    let Finished::Established(mut t, sas) = init.finish(&m2).unwrap() else {
        panic!()
    };
    let attempt = conn.pairing_attempt().unwrap();
    assert_eq!(
        conn.on_frame(&t.seal(TAG_HELLO, name.as_bytes()).unwrap(), 5, NOW_MS),
        Outcome::Continue
    );
    Paired {
        conn,
        transport: t,
        attempt,
        code: sas.digits(),
    }
}

fn pair_device(r: &R, key: &StaticKey) {
    let p = pair_until_hello(r, key, "Phone");
    r.host.confirm(p.attempt, &p.code).unwrap();
}

struct Client {
    conn: Box<Connection>,
    t: Transport,
}

fn session(r: &R, key: &StaticKey) -> Client {
    let (init, wire) = noise::start_initiator(Mode::Session, key, &r.hub_key, None).unwrap();
    let Opened::Accept { m2, mut conn } = accept(r, &wire) else {
        panic!("no session")
    };
    let Finished::Established(mut t, _) = init.finish(&m2).unwrap() else {
        panic!()
    };
    assert_eq!(
        conn.on_frame(&t.seal(TAG_HELLO, b"Phone").unwrap(), 6, NOW_MS),
        Outcome::Continue
    );
    t.raise_cap();
    Client { conn, t }
}

impl Client {
    fn request(&mut self, body: &Value) -> Value {
        let wire = self
            .t
            .seal(TAG_REQUEST, body.to_string().as_bytes())
            .unwrap();
        let Outcome::Reply(reply) = self.conn.on_frame(&wire, 7, NOW_MS) else {
            panic!("no reply")
        };
        let (tag, body) = self.t.open(&reply).unwrap();
        assert_eq!(tag, TAG_RESPONSE);
        serde_json::from_slice(&body).unwrap()
    }
}

fn events(r: &R) -> Vec<PairingEvent> {
    r.host.take_events()
}

#[test]
fn a_foreign_connection_cannot_touch_somebody_elses_pairing() {
    let r = rig();
    // B is a paired device with its own live session
    let b_key = StaticKey::generate().unwrap();
    pair_device(&r, &b_key);
    let mut b = session(&r, &b_key);
    events(&r);

    // A starts pairing; B now sends garbage, A's own (valid) hello bytes and a re-used old frame
    let a_key = StaticKey::generate().unwrap();
    r.host.open().unwrap();
    let (init, wire) = pair_start(&r, &a_key);
    let Opened::Accept { m2, conn: mut a } = accept(&r, &wire) else {
        panic!()
    };
    let Finished::Established(mut a_t, a_sas) = init.finish(&m2).unwrap() else {
        panic!()
    };
    let attempt = a.pairing_attempt().unwrap();
    let hello = a_t.seal(TAG_HELLO, b"Tablet").unwrap();
    assert_eq!(b.conn.on_frame(&[7u8; 40], 8, NOW_MS), Outcome::Close);
    assert!(b.conn.is_closed());
    let mut b2 = session(&r, &b_key);
    assert_eq!(
        b2.conn.on_frame(&hello, 8, NOW_MS),
        Outcome::Close,
        "A's frame on B's connection"
    );
    // A's attempt is untouched: its own hello still goes through and confirmation succeeds
    assert_eq!(a.on_frame(&hello, 9, NOW_MS), Outcome::Continue);
    assert!(events(&r)
        .iter()
        .any(|e| matches!(e, PairingEvent::HelloReceived { attempt: x, .. } if *x == attempt)));
    let sealed = r.host.confirm(attempt, &a_sas.digits()).unwrap();
    let (tag, _) = a_t.open(&sealed).unwrap();
    assert_eq!(tag, TAG_DATA_KEY);
    assert_eq!(r.trust.list().len(), 2);
}

#[test]
fn a_second_pairing_connection_is_dropped_while_an_attempt_runs() {
    let r = rig();
    let a_key = StaticKey::generate().unwrap();
    r.host.open().unwrap();
    let (_, w1) = pair_start(&r, &a_key);
    let (_, w2) = pair_start(&r, &StaticKey::generate().unwrap());
    assert!(matches!(accept(&r, &w1), Opened::Accept { .. }));
    assert!(matches!(accept(&r, &w2), Opened::Drop(None)));
}

#[test]
fn dropping_a_pairing_connection_ends_only_its_own_attempt() {
    let r = rig();
    let p = pair_until_hello(&r, &StaticKey::generate().unwrap(), "Phone");
    events(&r);
    let (attempt, code) = (p.attempt, p.code.clone());
    drop(p); // connection gone before the user confirmed
    assert!(events(&r).contains(&PairingEvent::Cancelled(CancelReason::ConnectionLost)));
    assert!(matches!(r.host.confirm(attempt, &code), Err(_)));
    assert!(r.trust.list().is_empty());
    // the finished pairing of a later attempt is not affected by an older connection going away
    let key = StaticKey::generate().unwrap();
    let old = pair_until_hello(&r, &key, "Old");
    let (old_attempt, old_code) = (old.attempt, old.code.clone());
    r.host.confirm(old_attempt, &old_code).unwrap();
    events(&r);
    drop(old);
    assert!(!events(&r)
        .iter()
        .any(|e| matches!(e, PairingEvent::Cancelled(_))));
    r.host.abandon(old_attempt); // finished attempt id: no-op
    r.host.abandon(u64::MAX); // unknown id: no-op
    assert!(events(&r).is_empty());
}

#[test]
fn a_second_frame_on_a_pairing_connection_ends_the_attempt() {
    let r = rig();
    let mut p = pair_until_hello(&r, &StaticKey::generate().unwrap(), "Phone");
    events(&r);
    let extra = p.transport.seal(TAG_HELLO, b"again").unwrap();
    assert_eq!(p.conn.on_frame(&extra, 9, NOW_MS), Outcome::Close);
    assert!(events(&r).contains(&PairingEvent::Cancelled(CancelReason::ConnectionLost)));
    assert!(r.host.confirm(p.attempt, &p.code).is_err());
    assert!(r.trust.list().is_empty());
}

#[test]
fn a_bad_hello_closes_the_connection_and_the_attempt() {
    let r = rig();
    r.host.open().unwrap();
    let (init, wire) = pair_start(&r, &StaticKey::generate().unwrap());
    let Opened::Accept { m2, mut conn } = accept(&r, &wire) else {
        panic!()
    };
    let Finished::Established(mut t, _) = init.finish(&m2).unwrap() else {
        panic!()
    };
    let bad = t.seal(TAG_UNPAIR, b"").unwrap();
    assert_eq!(conn.on_frame(&bad, 1, NOW_MS), Outcome::Close);
    assert!(conn.is_closed());
    assert_eq!(conn.on_frame(&bad, 1, NOW_MS), Outcome::Close);
    assert!(r.trust.list().is_empty());
}

#[test]
fn session_requests_flow_through_the_hub_with_the_key_version() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    pair_device(&r, &key);
    let mut c = session(&r, &key);
    let put = c.request(&json!({"keyVersion":1,"type":"push","ops":[op("r1",1)]}));
    assert_eq!(put["accepted"], 1);
    let stale = c.request(&json!({"keyVersion":9,"type":"pull"}));
    assert_eq!(stale, json!({"error":"stale-key-version"}));
    let bad = c.request(&json!({"keyVersion":1,"type":"push","ops":[{"collection":"todos_task","id":"x","field":"f","hlc":hlc(1),"value":"plain"}]}));
    assert_eq!(bad, json!({"error":"missing-enc"}));
    // rotation ends the session
    r.hub.rotate_to(2).unwrap();
    assert!(c.conn.is_closed());
    let wire =
        c.t.seal(TAG_REQUEST, br#"{"keyVersion":2,"type":"info"}"#)
            .unwrap();
    assert_eq!(c.conn.on_frame(&wire, 7, NOW_MS), Outcome::Close);
    assert_eq!(r.sessions.open_count(), 0);
}

#[test]
fn unknown_tags_and_unpair_close_the_session() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    pair_device(&r, &key);
    let mut c = session(&r, &key);
    let odd = c.t.seal(0x7f, b"x").unwrap();
    assert_eq!(c.conn.on_frame(&odd, 1, NOW_MS), Outcome::Close);
    let mut c = session(&r, &key);
    let un = c.t.seal(TAG_UNPAIR, b"").unwrap();
    assert_eq!(c.conn.on_frame(&un, 1, NOW_MS), Outcome::Close);
    assert!(r.trust.find_by_key(&key.public()).unwrap().revoked);
}

#[test]
fn an_answer_that_does_not_fit_a_frame_becomes_a_small_error() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    pair_device(&r, &key);
    let mut c = session(&r, &key);
    for i in 0..3 {
        let big = FieldOp {
            value: json!(format!("enc:v1:{}", "a".repeat(30_000))),
            ..op(&format!("big{i}"), i)
        };
        let put = c.request(&json!({"keyVersion":1,"type":"push","ops":[big]}));
        assert_eq!(put["accepted"], 1);
    }
    let pulled = c.request(&json!({"keyVersion":1,"type":"pull","limit":10}));
    assert_eq!(pulled, json!({"error":"response-too-large"}));
    let page = c.request(&json!({"keyVersion":1,"type":"pull","limit":1}));
    assert_eq!(page["ops"].as_array().unwrap().len(), 1);
}

#[test]
fn router_drops_by_address_size_and_rate_before_any_crypto() {
    let r = rig();
    r.host.open().unwrap();
    let key = StaticKey::generate().unwrap();
    let (_, wire) = pair_start(&r, &key);
    assert!(matches!(
        r.router.accept(v4("8.8.8.8"), &wire, T0),
        Opened::Drop(Some(Refusal::Address))
    ));
    assert!(matches!(
        r.router.accept(v4(PEER), &vec![MODE_PAIR; 300], T0),
        Opened::Drop(Some(Refusal::Oversize))
    ));
    let junk = vec![9u8; 97];
    for _ in 0..HANDSHAKES_PER_WINDOW {
        assert!(matches!(
            r.router.accept(v4(PEER), &junk, T0),
            Opened::Drop(None)
        ));
    }
    assert!(matches!(
        r.router.accept(v4(PEER), &junk, T0),
        Opened::Drop(Some(Refusal::RateLimited))
    ));
    // the genuine pairing from the limited address is refused too, the window was not burned
    assert!(matches!(
        r.router.accept(v4(PEER), &wire, T0),
        Opened::Drop(Some(Refusal::RateLimited))
    ));
    assert!(matches!(
        r.router.accept(v4(PEER), &wire, T0 + RATE_WINDOW),
        Opened::Accept { .. }
    ));
    r.clock.advance(WINDOW); // keep the clock used
}

#[test]
fn unknown_device_gets_the_authenticated_refusal_through_the_router() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    let (init, wire) = noise::start_initiator(Mode::Session, &key, &r.hub_key, None).unwrap();
    let Opened::Refuse(m2) = accept(&r, &wire) else {
        panic!()
    };
    assert!(matches!(init.finish(&m2).unwrap(), Finished::Refused(_)));
}

// ---------- PSK contract ----------

/// The client side of the contract: a 16-byte QR secret becomes the 32-byte Noise PSK by appending
/// 16 zero bytes. Written out by hand here (not via `Psk`), so the hub and a client built on
/// `snow` alone must agree.
fn client_psk(secret: &[u8; 16]) -> [u8; 32] {
    let mut p = [0u8; 32];
    p[..16].copy_from_slice(secret);
    p
}

const SECRET: [u8; 16] = [
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
];

fn raw_first(
    psk: &[u8; 32],
    own: &StaticKey,
    hub: &noise::PublicKey,
) -> (snow::HandshakeState, Vec<u8>) {
    let mut prologue = PROLOGUE_BASE.to_vec();
    prologue.push(MODE_PAIR);
    let secret = own.to_secret_bytes();
    let mut hs = snow::Builder::new("Noise_IKpsk1_25519_ChaChaPoly_BLAKE2s".parse().unwrap())
        .local_private_key(&*secret)
        .unwrap()
        .remote_public_key(hub.as_bytes())
        .unwrap()
        .prologue(&prologue)
        .unwrap()
        .psk(1, psk)
        .unwrap()
        .build_initiator()
        .unwrap();
    let mut wire = vec![0u8; 97];
    wire[0] = MODE_PAIR;
    hs.write_message(&[], &mut wire[1..]).unwrap();
    (hs, wire)
}

#[test]
fn psk_golden_value() {
    let hex: String = Psk::from_secret(&SECRET)
        .bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    assert_eq!(
        hex, "00112233445566778899aabbccddeeff00000000000000000000000000000000",
        "package 3's client must use this exact padding"
    );
    assert_eq!(*Psk::from_secret(&SECRET).bytes(), client_psk(&SECRET));
}

#[test]
fn hub_and_an_independent_client_agree_on_the_padded_psk() {
    let hub_key = StaticKey::generate().unwrap();
    let hub_psk = Psk::from_secret(&SECRET);
    let client = StaticKey::generate().unwrap();

    // padded like the contract: the hub reads message 1 and the client reads message 2
    let (mut hs, wire) = raw_first(&client_psk(&SECRET), &client, &hub_key.public());
    let first = noise::read_first(&hub_key, &wire, Some(&hub_psk)).expect("hub accepts");
    let (m2, _t, _sas) = first.accept().unwrap();
    let mut out = [0u8; 64];
    hs.read_message(&m2, &mut out).expect("client reads m2");
    assert!(hs.is_handshake_finished());

    // any other extension of the secret is refused (no zero padding on the right)
    let mut wrong = [0xffu8; 32];
    wrong[..16].copy_from_slice(&SECRET);
    let mut left = [0u8; 32];
    left[16..].copy_from_slice(&SECRET);
    let mut doubled = [0u8; 32];
    doubled[..16].copy_from_slice(&SECRET);
    doubled[16..].copy_from_slice(&SECRET);
    for (name, bad) in [
        ("0xff pad", wrong),
        ("left pad", left),
        ("repeated", doubled),
    ] {
        let (_, wire) = raw_first(&bad, &client, &hub_key.public());
        assert!(
            noise::read_first(&hub_key, &wire, Some(&hub_psk)).is_err(),
            "{name}"
        );
    }
}
