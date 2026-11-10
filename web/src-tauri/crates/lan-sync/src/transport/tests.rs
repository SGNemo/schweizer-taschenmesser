use super::*;
use crate::endpoint::Endpoint;
use crate::hub::router::Admission;
use crate::hub::{Hub, TAG_REQUEST, TAG_RESPONSE};
use crate::input::tests::{Confirmed, TestSink};
use crate::input::{MemorySwitch, Remote};
use crate::noise::frame::{TAG_DATA_KEY, TAG_HELLO};
use crate::noise::{self, Finished, Mode, Psk, StaticKey, Transport};
use crate::pairing::{
    qr, DataKey, DataKeyError, DataKeyProvider, ManualClock, PairingEvent, PairingHost,
};
use crate::trust::{MemoryKeyStore, MemoryTrustStore, SessionRegistry, StaticKeyStore, TrustStore};
use crate::Store;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::Ipv4Addr;
use zeroize::Zeroizing;

struct Keys;
impl DataKeyProvider for Keys {
    fn current(&self) -> Result<DataKey, DataKeyError> {
        Ok(DataKey {
            version: 1,
            key: Zeroizing::new([5u8; 32]),
        })
    }
}

struct Rig {
    remote: Arc<Remote>,
    sink: Arc<TestSink>,
    router: Arc<Router>,
    server: Server,
    host: Arc<PairingHost>,
    trust: Arc<MemoryTrustStore>,
    sessions: Arc<SessionRegistry>,
    hub_key: noise::PublicKey,
}

fn loopback() -> Vec<Bind> {
    vec![Bind::new(Ipv4Addr::LOCALHOST, 8).unwrap()]
}

fn rig_with(cfg: ServerConfig) -> Rig {
    rig_on(cfg, true)
}

/// `home`: whether the one bind counts as the stored home network (input sessions only there).
fn rig_on(cfg: ServerConfig, home: bool) -> Rig {
    let keys = MemoryKeyStore::empty();
    let hub_key = keys.load_or_create().unwrap().public();
    let trust = Arc::new(MemoryTrustStore::new());
    let host = Arc::new(PairingHost::new(
        hub_key,
        Arc::new(ManualClock::new()),
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
    let mut adm = Admission::new();
    adm.set_binds(loopback().into_iter().map(|b| b.with_home(home)).collect());
    adm.allow_loopback_for_tests();
    let switch = Arc::new(MemorySwitch::new());
    let remote = Arc::new(Remote::new(trust.clone(), switch));
    let sink = TestSink::new();
    let router =
        Arc::new(Router::new(ep, host.clone(), hub, adm).with_input(remote.clone(), sink.clone()));
    let server = Server::start_for_tests(&loopback(), router.clone(), cfg).unwrap();
    Rig {
        remote,
        sink,
        router,
        server,
        host,
        trust,
        sessions,
        hub_key,
    }
}

fn rig() -> Rig {
    rig_with(ServerConfig {
        tick: Duration::from_millis(20),
        ..ServerConfig::default()
    })
}

fn connect(r: &Rig) -> TcpStream {
    let s = TcpStream::connect(r.server.local_addrs()[0]).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
    s
}

fn send(s: &mut TcpStream, wire: &[u8]) {
    assert!(write_frame(s, wire));
}

fn recv(s: &mut TcpStream) -> Option<Vec<u8>> {
    let mut head = [0u8; 2];
    s.read_exact(&mut head).ok()?;
    let mut body = vec![0u8; usize::from(u16::from_be_bytes(head))];
    s.read_exact(&mut body).ok()?;
    Some(body)
}

/// True once the server has closed the connection.
fn closed(s: &mut TcpStream) -> bool {
    let mut b = [0u8; 1];
    matches!(s.read(&mut b), Ok(0) | Err(_))
}

fn pair_over_socket(r: &Rig, key: &StaticKey) {
    r.host.open().unwrap();
    let q = qr::decode(&r.host.qr(r.server.port(), [10, 0, 0, 1]).unwrap().unwrap()).unwrap();
    let (init, m1) = noise::start_initiator(
        Mode::Pair,
        key,
        &q.hub_key,
        Some(&Psk::from_secret(&q.secret)),
    )
    .unwrap();
    let mut s = connect(r);
    send(&mut s, &m1);
    let m2 = recv(&mut s).expect("m2");
    let Finished::Established(mut t, sas) = init.finish(&m2).unwrap() else {
        panic!()
    };
    send(&mut s, &t.seal(TAG_HELLO, b"Phone").unwrap());
    let attempt = wait_hello(r);
    let sealed = r.host.confirm(attempt, &sas.digits()).unwrap();
    assert!(
        r.server.deliver(attempt, sealed),
        "connection of the attempt"
    );
    let (tag, body) = t.open(&recv(&mut s).expect("key frame")).unwrap();
    assert_eq!(tag, TAG_DATA_KEY);
    assert_eq!(body.len(), 36);
}

fn wait_hello(r: &Rig) -> u64 {
    for _ in 0..200 {
        for e in r.host.take_events() {
            if let PairingEvent::HelloReceived { attempt, .. } = e {
                return attempt;
            }
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    panic!("no hello")
}

struct Client {
    s: TcpStream,
    t: Transport,
}

fn session(r: &Rig, key: &StaticKey) -> Client {
    let (init, m1) = noise::start_initiator(Mode::Session, key, &r.hub_key, None).unwrap();
    let mut s = connect(r);
    send(&mut s, &m1);
    let m2 = recv(&mut s).expect("m2");
    let Finished::Established(mut t, _) = init.finish(&m2).unwrap() else {
        panic!()
    };
    send(&mut s, &t.seal(TAG_HELLO, b"Phone").unwrap());
    t.raise_cap();
    Client { s, t }
}

impl Client {
    fn request(&mut self, body: &Value) -> Value {
        let wire = self
            .t
            .seal(TAG_REQUEST, body.to_string().as_bytes())
            .unwrap();
        send(&mut self.s, &wire);
        let (tag, body) = self.t.open(&recv(&mut self.s).expect("reply")).unwrap();
        assert_eq!(tag, TAG_RESPONSE);
        serde_json::from_slice(&body).unwrap()
    }
}

fn hlc(i: usize) -> String {
    let now = u64::try_from(unix_now().1).unwrap();
    format!("{:013}-{:04}-aaaa0001", now - 1000, i % 10_000)
}

#[test]
fn a_thousand_ops_push_and_pull_over_a_socket() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    pair_over_socket(&r, &key);
    let mut c = session(&r, &key);
    for chunk in 0..5 {
        let ops: Vec<Value> = (0..200)
            .map(|i| {
                let n = chunk * 200 + i;
                json!({"collection":"todos_task","id":format!("r{n}"),"field":"title",
                       "hlc":hlc(n),"value":format!("enc:v1:iv{n}:data")})
            })
            .collect();
        let put = c.request(&json!({"keyVersion":1,"type":"push","ops":ops}));
        assert_eq!(put["accepted"], 200, "{put}");
    }
    let (mut since, mut got) = (0, 0);
    loop {
        let page = c.request(&json!({"keyVersion":1,"type":"pull","since":since,"limit":200}));
        got += page["ops"].as_array().unwrap().len();
        since = page["cursor"].as_i64().unwrap();
        if page["more"] == false {
            break;
        }
    }
    assert_eq!((got, since), (1000, 1000));
}

#[test]
fn production_start_refuses_every_forbidden_address() {
    let keys = MemoryKeyStore::empty();
    let hub_key = keys.load_or_create().unwrap().public();
    let trust = Arc::new(MemoryTrustStore::new());
    let host = Arc::new(PairingHost::new(
        hub_key,
        Arc::new(ManualClock::new()),
        trust.clone(),
        Arc::new(Keys),
    ));
    let sessions = Arc::new(SessionRegistry::new());
    let ep = Endpoint::start(&keys, trust, host.clone(), sessions.clone()).unwrap();
    let hub = Arc::new(Hub::new(Store::open(":memory:").unwrap(), 1, sessions));
    let router = Arc::new(Router::new(ep, host, hub, Admission::new()));
    for ip in [
        "0.0.0.0",
        "127.0.0.1",
        "8.8.8.8",
        "100.64.0.1",
        "255.255.255.255",
    ] {
        let b = Bind::new(ip.parse().unwrap(), 24).unwrap();
        let res = Server::start(&[b], 0, router.clone(), ServerConfig::default());
        assert!(
            matches!(res, Err(ServerError::ForbiddenAddress)),
            "{ip} must never be bound"
        );
    }
    assert!(matches!(
        Server::start(&[], 0, router, ServerConfig::default()),
        Err(ServerError::NoAddress)
    ));
}

#[test]
fn the_server_listens_on_exactly_the_given_addresses() {
    let r = rig();
    assert_eq!(r.server.local_addrs().len(), 1);
    assert_eq!(*r.server.local_addrs()[0].ip(), Ipv4Addr::LOCALHOST);
}

#[test]
fn per_address_and_total_caps_close_the_excess() {
    let r = rig_with(ServerConfig {
        max_per_ip: 2,
        max_connections: 2,
        tick: Duration::from_millis(20),
        ..ServerConfig::default()
    });
    let _a = connect(&r);
    let _b = connect(&r);
    std::thread::sleep(Duration::from_millis(200));
    assert_eq!(r.server.open_connections(), 2);
    let mut c = connect(&r);
    assert!(closed(&mut c), "third connection is dropped");
    drop(_a);
    std::thread::sleep(Duration::from_millis(300));
    assert_eq!(r.server.open_connections(), 1, "the slot is released");
    let mut d = connect(&r);
    send(&mut d, &[0u8; 97]); // junk first message: the router drops it, the slot is free again
    assert!(closed(&mut d));
}

#[test]
fn oversize_and_slow_and_silent_peers_are_closed() {
    let r = rig_with(ServerConfig {
        handshake_timeout: Duration::from_millis(300),
        frame_deadline: Duration::from_millis(300),
        tick: Duration::from_millis(20),
        ..ServerConfig::default()
    });
    // announced length above the pre-handshake cap: closed before the body is read
    let mut big = connect(&r);
    big.write_all(&(u16::try_from(PRE_HANDSHAKE_CAP + 1).unwrap()).to_be_bytes())
        .unwrap();
    assert!(closed(&mut big));
    // zero length
    let mut zero = connect(&r);
    zero.write_all(&[0, 0]).unwrap();
    assert!(closed(&mut zero));
    // half a frame, then nothing
    let mut slow = connect(&r);
    slow.write_all(&[0, 97, 1, 2, 3]).unwrap();
    assert!(closed(&mut slow));
    // connected, never says anything
    let mut mute = connect(&r);
    assert!(closed(&mut mute));
}

#[test]
fn an_idle_session_is_closed() {
    let r = rig_with(ServerConfig {
        idle_timeout: Duration::from_millis(300),
        tick: Duration::from_millis(20),
        ..ServerConfig::default()
    });
    let key = StaticKey::generate().unwrap();
    pair_over_socket(&r, &key);
    let mut c = session(&r, &key);
    assert_eq!(
        c.request(&json!({"keyVersion":1,"type":"info"}))["keyVersion"],
        1
    );
    assert!(closed(&mut c.s));
}

#[test]
fn revoking_a_device_closes_its_open_socket_session() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    pair_over_socket(&r, &key);
    let mut c = session(&r, &key);
    assert_eq!(
        c.request(&json!({"keyVersion":1,"type":"info"}))["keyVersion"],
        1
    );
    assert!(r.sessions.revoke(&*r.trust, &key.public()).unwrap());
    assert!(closed(&mut c.s), "the socket is closed by the hub");
    // and a new session of the revoked key gets only the authenticated refusal
    let (init, m1) = noise::start_initiator(Mode::Session, &key, &r.hub_key, None).unwrap();
    let mut s = connect(&r);
    send(&mut s, &m1);
    let m2 = recv(&mut s).unwrap();
    assert!(matches!(init.finish(&m2).unwrap(), Finished::Refused(_)));
}

#[test]
fn stop_tears_everything_down() {
    let r = rig();
    let addr = r.server.local_addrs()[0];
    let mut open = connect(&r);
    std::thread::sleep(Duration::from_millis(100));
    r.server.stop();
    assert!(closed(&mut open));
    assert!(TcpStream::connect(addr).is_err(), "listener is gone");
}

#[test]
fn a_foreign_connection_cannot_deliver_into_a_pairing() {
    let r = rig();
    // nothing registered: deliver reports false for any attempt id
    assert!(!r.server.deliver(1, vec![1, 2, 3]));
}

/// Window open, handshake and hello over a socket; returns the client side and the SAS code.
fn pair_until_hello(r: &Rig, key: &StaticKey) -> (TcpStream, Transport, u64, String) {
    r.host.open().unwrap();
    let q = qr::decode(&r.host.qr(r.server.port(), [10, 0, 0, 1]).unwrap().unwrap()).unwrap();
    let (init, m1) = noise::start_initiator(
        Mode::Pair,
        key,
        &q.hub_key,
        Some(&Psk::from_secret(&q.secret)),
    )
    .unwrap();
    let mut s = connect(r);
    send(&mut s, &m1);
    let m2 = recv(&mut s).expect("m2");
    let Finished::Established(mut t, sas) = init.finish(&m2).unwrap() else {
        panic!()
    };
    send(&mut s, &t.seal(TAG_HELLO, b"Phone").unwrap());
    let attempt = wait_hello(r);
    (s, t, attempt, sas.digits())
}

#[test]
fn confirm_without_a_live_connection_trusts_nobody() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    let (s, _t, attempt, code) = pair_until_hello(&r, &key);
    drop(s); // the device goes away before the user confirms
    for _ in 0..100 {
        if r.server.open_connections() == 0 {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let deliverer = r.server.deliverer();
    let res = r
        .host
        .confirm_deliver(attempt, &code, &mut |w| deliverer.deliver(attempt, w));
    assert!(res.is_err(), "{res:?}");
    assert!(r.trust.list().is_empty(), "nobody is trusted without a key");
    // and nothing is delivered to an attempt that has no connection
    assert!(!r.server.deliver(attempt, vec![1]));
}

#[test]
fn a_failed_write_after_the_accept_rolls_the_trust_entry_back() {
    let r = rig();
    let key = StaticKey::generate().unwrap();
    let (_s, _t, attempt, code) = pair_until_hello(&r, &key);
    r.host.take_events();
    let res = r.host.confirm_deliver(attempt, &code, &mut |_| false);
    assert_eq!(res, Err(crate::pairing::PairError::Delivery));
    assert!(r.trust.find_by_key(&key.public()).is_none());
    assert!(r.trust.list().is_empty());
    assert!(r.host.take_events().contains(&PairingEvent::Cancelled(
        crate::pairing::CancelReason::Rejected
    )));
    assert!(
        r.host.is_open(),
        "a fresh window follows, like after any failed attempt"
    );
}

#[test]
fn a_peer_outside_every_bound_subnet_costs_no_slot() {
    let r = rig();
    r.router
        .set_binds(vec![Bind::new(Ipv4Addr::new(10, 0, 0, 1), 8).unwrap()]);
    let mut c = connect(&r);
    assert!(closed(&mut c));
    assert_eq!(r.server.open_connections(), 0);
}

// ---- the device side (`client`) against this hub ----

mod device_client {
    use super::*;
    use crate::client::testing::{open_via, pair_via};
    use crate::client::{self, ClientError};
    use std::sync::atomic::AtomicBool;

    fn qr_text(r: &Rig) -> String {
        r.host.qr(r.server.port(), [10, 0, 0, 1]).unwrap().unwrap()
    }

    fn addr(r: &Rig) -> std::net::SocketAddrV4 {
        r.server.local_addrs()[0]
    }

    /// Pairs `key` through the client, playing the user who confirms the code on the PC.
    fn pair_client(r: &Rig, key: &StaticKey) -> (client::Paired, String) {
        r.host.open().unwrap();
        let text = qr_text(r);
        let a = addr(r);
        let k = StaticKey::from_secret_bytes(key.to_secret_bytes()).unwrap();
        let shown = Arc::new(Mutex::new(String::new()));
        let shown2 = shown.clone();
        let device = std::thread::spawn(move || {
            pair_via(
                a,
                &text,
                &k,
                "Pixel 7",
                &mut |code| *shown2.lock().unwrap() = code.to_owned(),
                &|| false,
            )
        });
        let attempt = wait_hello(r);
        // the PC compares the code the device shows
        let code = loop {
            let c = shown.lock().unwrap().clone();
            if !c.is_empty() {
                break c;
            }
            std::thread::sleep(Duration::from_millis(10));
        };
        let sealed = r.host.confirm(attempt, &code).unwrap();
        assert!(r.server.deliver(attempt, sealed));
        (device.join().unwrap().expect("paired"), code)
    }

    #[test]
    fn tags_match_the_hub() {
        assert_eq!(client::TAG_REQUEST, TAG_REQUEST);
        assert_eq!(client::TAG_RESPONSE, TAG_RESPONSE);
    }

    #[test]
    fn a_device_pairs_by_qr_gets_the_data_key_and_syncs() {
        let r = rig();
        let key = StaticKey::generate().unwrap();
        let (paired, code) = pair_client(&r, &key);
        assert_eq!(code.len(), 6);
        assert_eq!(paired.data_key_version, 1);
        assert_eq!(*paired.data_key, [5u8; 32]);
        assert_eq!(paired.hub_key, r.hub_key);
        assert!(r
            .trust
            .list()
            .iter()
            .any(|d| d.name == "Pixel 7" && !d.revoked));

        let mut s = open_via(addr(&r), &key, &r.hub_key, "Pixel 7").unwrap();
        let ops = json!([{"collection":"todos_task","id":"r1","field":"title","hlc":hlc(1),"value":"enc:v1:a:b"}]);
        let put: Value = serde_json::from_slice(
            &s.request(
                json!({"keyVersion":1,"type":"push","ops":ops})
                    .to_string()
                    .as_bytes(),
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(put["accepted"], 1, "{put}");
        let page: Value = serde_json::from_slice(
            &s.request(br#"{"keyVersion":1,"type":"pull","since":0,"limit":10}"#)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(page["ops"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn a_used_or_closed_window_is_pairing_not_possible() {
        let r = rig();
        let key = StaticKey::generate().unwrap();
        pair_client(&r, &key);
        // the QR of that window again: the hub drops it silently
        r.host.open().unwrap();
        let text = qr_text(&r);
        r.host.cancel();
        let err = pair_via(
            addr(&r),
            &text,
            &StaticKey::generate().unwrap(),
            "Other",
            &mut |_| {},
            &|| false,
        )
        .unwrap_err();
        assert_eq!(err, ClientError::PairingNotPossible);
    }

    #[test]
    fn only_the_hub_can_say_unknown_device_and_a_wrong_hub_is_just_unreachable() {
        let r = rig();
        let key = StaticKey::generate().unwrap();
        // never paired: authenticated refusal
        assert_eq!(
            open_via(addr(&r), &key, &r.hub_key, "X").unwrap_err(),
            ClientError::UnknownDevice
        );
        // pinned key of another hub (reinstalled PC, impostor): no claim, calm network
        let other = StaticKey::generate().unwrap().public();
        assert_eq!(
            open_via(addr(&r), &key, &other, "X").unwrap_err(),
            ClientError::Network
        );
    }

    #[test]
    fn a_device_can_unpair_itself_and_is_refused_afterwards() {
        let r = rig();
        let key = StaticKey::generate().unwrap();
        pair_client(&r, &key);
        let s = open_via(addr(&r), &key, &r.hub_key, "Pixel 7").unwrap();
        s.unpair().unwrap();
        for _ in 0..100 {
            if r.trust.list().iter().all(|d| d.revoked) {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(r.trust.list().iter().all(|d| d.revoked));
        assert_eq!(
            open_via(addr(&r), &key, &r.hub_key, "Pixel 7").unwrap_err(),
            ClientError::UnknownDevice
        );
    }

    #[test]
    fn waiting_for_the_pc_can_be_cancelled_on_the_device() {
        let r = rig();
        r.host.open().unwrap();
        let text = qr_text(&r);
        let stop = Arc::new(AtomicBool::new(false));
        let stop2 = stop.clone();
        let a = addr(&r);
        let device = std::thread::spawn(move || {
            pair_via(
                a,
                &text,
                &StaticKey::generate().unwrap(),
                "P",
                &mut |_| {},
                &move || stop2.load(Ordering::SeqCst),
            )
        });
        wait_hello(&r);
        stop.store(true, Ordering::SeqCst);
        assert_eq!(device.join().unwrap().unwrap_err(), ClientError::Cancelled);
    }

    #[test]
    fn after_unpairing_only_a_fresh_device_key_pairs_again() {
        let r = rig();
        let old = StaticKey::generate().unwrap();
        pair_client(&r, &old);
        let s = open_via(addr(&r), &old, &r.hub_key, "Pixel 7").unwrap();
        s.unpair().unwrap();
        for _ in 0..100 {
            if r.trust.list().iter().all(|d| d.revoked) {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        // the old key never pairs again: the hub drops the attempt silently
        r.host.open().unwrap();
        let text = qr_text(&r);
        let err = pair_via(addr(&r), &text, &old, "Pixel 7", &mut |_| {}, &|| false).unwrap_err();
        assert_eq!(err, ClientError::PairingNotPossible);
        // a fresh key ("Neu koppeln") does
        let fresh = StaticKey::generate().unwrap();
        let (paired, _) = pair_client(&r, &fresh);
        assert_eq!(paired.hub_key, r.hub_key);
        assert!(open_via(addr(&r), &fresh, &r.hub_key, "Pixel 7").is_ok());
    }

    #[test]
    fn the_link_opens_a_fresh_session_once_after_the_hub_closed_an_idle_one() {
        let r = rig_with(ServerConfig {
            tick: Duration::from_millis(20),
            idle_timeout: Duration::from_millis(300),
            ..ServerConfig::default()
        });
        let key = StaticKey::generate().unwrap();
        pair_client(&r, &key);
        let mut link = client::Link::new();
        let mut opened = 0;
        let a = addr(&r);
        let hub = r.hub_key;
        let mut open = || {
            opened += 1;
            open_via(a, &key, &hub, "Pixel 7")
        };
        let body = br#"{"keyVersion":1,"type":"info"}"#;
        assert!(link.request(body, &mut open).is_ok());
        std::thread::sleep(Duration::from_millis(700)); // the hub closes the idle session
        assert!(link.request(body, &mut open).is_ok());
        assert_eq!(opened, 2);
    }

    #[test]
    fn a_largest_value_travels_in_one_frame_and_a_too_big_page_says_so() {
        let r = rig();
        let key = StaticKey::generate().unwrap();
        pair_client(&r, &key);
        let mut s = open_via(addr(&r), &key, &r.hub_key, "Pixel 7").unwrap();
        // the JSON-encoded value (with quotes) may be 60 000 bytes
        let value = format!("enc:v1:{}", "a".repeat(60_000 - 2 - 7));
        for i in 0..2 {
            let ops = json!([{"collection":"todos_task","id":format!("big{i}"),"field":"title","hlc":hlc(i),"value":value}]);
            let put: Value = serde_json::from_slice(
                &s.request(
                    json!({"keyVersion":1,"type":"push","ops":ops})
                        .to_string()
                        .as_bytes(),
                )
                .unwrap(),
            )
            .unwrap();
            assert_eq!(put["accepted"], 1, "{put}");
        }
        let two: Value = serde_json::from_slice(
            &s.request(br#"{"keyVersion":1,"type":"pull","since":0,"limit":2}"#)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(two["error"], "response-too-large");
        let one: Value = serde_json::from_slice(
            &s.request(br#"{"keyVersion":1,"type":"pull","since":0,"limit":1}"#)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(one["ops"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn cancelling_while_still_connecting_ends_at_once() {
        let r = rig();
        r.host.open().unwrap();
        let text = qr_text(&r);
        // a host that accepts but never answers message 1
        let silent = std::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let std::net::SocketAddr::V4(silent_addr) = silent.local_addr().unwrap() else {
            panic!()
        };
        let began = std::time::Instant::now();
        let stop_at = began + Duration::from_millis(300);
        let err = pair_via(
            silent_addr,
            &text,
            &StaticKey::generate().unwrap(),
            "P",
            &mut |_| {},
            &|| std::time::Instant::now() > stop_at,
        )
        .unwrap_err();
        assert_eq!(err, ClientError::Cancelled);
        assert!(began.elapsed() < Duration::from_secs(3));
        drop(silent);
    }

    #[test]
    fn cancel_on_the_pc_is_pairing_aborted_not_a_network_problem() {
        let r = rig();
        r.host.open().unwrap();
        let text = qr_text(&r);
        let a = addr(&r);
        let device = std::thread::spawn(move || {
            pair_via(
                a,
                &text,
                &StaticKey::generate().unwrap(),
                "P",
                &mut |_| {},
                &|| false,
            )
        });
        let attempt = wait_hello(&r);
        // the user pressed "Abbrechen" on the PC: the shell cancels and ends that connection
        r.host.cancel();
        let began = std::time::Instant::now();
        r.server.deliverer().abort(attempt);
        assert_eq!(
            device.join().unwrap().unwrap_err(),
            ClientError::PairingAborted
        );
        assert!(
            began.elapsed() < Duration::from_secs(3),
            "not the device's own timeout"
        );
    }

    #[test]
    fn names_are_cleaned_for_the_hub() {
        assert_eq!(client::hello_name("  Pixel 7\n "), "Pixel 7");
        assert_eq!(client::hello_name(""), "Gerät");
        let long = "ä".repeat(40);
        let cut = client::hello_name(&long);
        assert!(cut.len() <= 64 && cut.chars().all(|c| c == 'ä'));
    }
}

/// The phone's input client against the real server: own connection, own handshake, duplex.
mod input_client {
    use super::*;
    use crate::input::wire::{self, Code, Level, Media, Record};
    use crate::input::Action;
    use crate::input_client::{testing::open_via, Event, InputError, InputSession};
    use crate::noise::frame::{INPUT_CAP, TAG_UNPAIR};
    use crate::trust::RemoteGrant;
    use std::sync::mpsc::{channel, Receiver};

    fn addr(r: &Rig) -> std::net::SocketAddrV4 {
        r.server.local_addrs()[0]
    }

    /// A paired device with a grant, on a hub whose switch is on.
    fn granted(r: &Rig, level: Level) -> StaticKey {
        let key = StaticKey::generate().unwrap();
        pair_over_socket(r, &key);
        r.remote.enable_now(true).unwrap();
        r.remote
            .grant_now(
                &key.public(),
                RemoteGrant {
                    level,
                    ..RemoteGrant::default()
                },
            )
            .unwrap();
        key
    }

    fn open(
        r: &Rig,
        key: &StaticKey,
        level: Level,
    ) -> Result<(InputSession, wire::Opened, Receiver<Event>), InputError> {
        let (tx, rx) = channel();
        open_via(
            addr(r),
            key,
            &r.hub_key,
            level,
            Box::new(move |e| {
                let _ = tx.send(e);
            }),
        )
        .map(|(s, o)| (s, o, rx))
    }

    fn wait_for(what: impl Fn() -> bool) {
        for _ in 0..300 {
            if what() {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        panic!("did not happen");
    }

    const WAIT: Duration = Duration::from_secs(5);

    #[test]
    fn a_granted_phone_controls_media_and_hears_the_state_while_sync_goes_on() {
        let r = rig();
        let key = granted(&r, Level::Media);
        let mut sync = session(&r, &key);
        let (input, opened, events) = open(&r, &key, Level::Full).unwrap();
        // asked for full, granted media: the session is a media session
        assert_eq!((opened.level, opened.grant), (Level::Media, Level::Media));
        assert_eq!(opened.state.volume, 42);

        input
            .send_events(&[
                Record::Media(Media::VolumeDown),
                Record::Media(Media::PlayPause),
            ])
            .unwrap();
        wait_for(|| r.sink.actions.lock().unwrap().len() == 2);
        assert!(
            r.sink.taken()
                == vec![
                    Action::Media(Media::VolumeDown),
                    Action::Media(Media::PlayPause)
                ]
        );
        // the PC tells its new state without being asked
        r.sink.set_volume(40);
        let Ok(Event::State(s)) = events.recv_timeout(WAIT) else {
            panic!("no state")
        };
        assert_eq!(s.volume, 40);
        // the sync session of the same device is its own connection and keeps working
        let info = sync.request(&json!({"keyVersion": 1, "type": "info"}));
        assert!(info.get("error").is_none());
        assert_eq!(r.server.open_connections(), 2);

        // ended at the PC: the phone hears why, and sync goes on
        assert_eq!(r.remote.end(), Some(key.public()));
        assert_eq!(
            events.recv_timeout(WAIT),
            Ok(Event::Closed(Some(Code::Ended)))
        );
        wait_for(|| input.is_over());
        assert_eq!(
            input.send_events(&[Record::Media(Media::PlayPause)]),
            Err(InputError::Network)
        );
        assert!(r.sink.taken().is_empty());
        assert!(sync
            .request(&json!({"keyVersion": 1, "type": "info"}))
            .get("error")
            .is_none());
        // and the next try says "paused"
        assert_eq!(
            open(&r, &key, Level::Media).err(),
            Some(InputError::Refused(Code::Paused))
        );
        input.close();
    }

    #[test]
    fn mouse_keyboard_and_text_travel_on_a_full_session_and_close_a_media_one() {
        let r = rig();
        let key = granted(&r, Level::Full);
        let (media, opened, events) = open(&r, &key, Level::Media).unwrap();
        assert_eq!((opened.level, opened.grant), (Level::Media, Level::Full));
        assert!(opened.unlock_required);
        // a pointer record on the media session: the hub closes it, nothing acts
        media.send_events(&[Record::Move { dx: 5, dy: 5 }]).unwrap();
        assert_eq!(events.recv_timeout(WAIT), Ok(Event::Closed(None)));
        assert!(r.sink.taken().is_empty());
        media.close();

        // the phone opens anew at the full level
        let (full, opened, _events) = open(&r, &key, Level::Full).unwrap();
        assert_eq!(opened.level, Level::Full);
        let moves = vec![Record::Move { dx: 1, dy: -1 }; 40]; // more than one frame
        full.send_events(&moves).unwrap();
        full.send_text("Grüße").unwrap();
        wait_for(|| r.sink.actions.lock().unwrap().len() == 41);
        let acted = r.sink.taken();
        assert!(acted[..40]
            .iter()
            .all(|a| *a == Action::Move { dx: 1, dy: -1 }));
        assert!(acted[40] == Action::Text("Grüße".into()));
        // text the protocol does not carry never leaves the phone
        assert_eq!(full.send_text("a\nb"), Err(InputError::Protocol));
        assert_eq!(full.send_text(""), Err(InputError::Protocol));
        full.close();
        wait_for(|| r.remote.status().controller.is_none());
        // once for the media session the hub closed, once for the full one
        assert_eq!(r.sink.released.load(std::sync::atomic::Ordering::SeqCst), 2);
    }

    #[test]
    fn every_refusal_reaches_the_phone_as_its_own_code() {
        let r = rig();
        let key = StaticKey::generate().unwrap();
        pair_over_socket(&r, &key);
        let refusal = |level| open(&r, &key, level).err();
        // paired, but the PC's switch is off
        assert_eq!(
            refusal(Level::Media),
            Some(InputError::Refused(Code::RemoteOff))
        );
        r.remote.enable_now(true).unwrap();
        assert_eq!(
            refusal(Level::Media),
            Some(InputError::Refused(Code::NotGranted))
        );
        let grant = |level| {
            r.remote
                .grant_now(
                    &key.public(),
                    RemoteGrant {
                        level,
                        ..RemoteGrant::default()
                    },
                )
                .unwrap()
        };
        grant(Level::Full);
        r.sink.set_locked(true);
        assert_eq!(
            refusal(Level::Full),
            Some(InputError::Refused(Code::Locked))
        );
        r.sink.set_locked(false);
        r.sink
            .supported
            .store(false, std::sync::atomic::Ordering::SeqCst);
        assert_eq!(
            refusal(Level::Media),
            Some(InputError::Refused(Code::Unsupported))
        );
        r.sink
            .supported
            .store(true, std::sync::atomic::Ordering::SeqCst);
        // another device controls
        let other = granted(&r, Level::Media);
        let (held, _, _) = open(&r, &other, Level::Media).unwrap();
        assert_eq!(refusal(Level::Media), Some(InputError::Refused(Code::Busy)));
        held.close();
        wait_for(|| r.remote.status().controller.is_none());
        // a device the hub does not know: the authenticated refusal
        let stranger = StaticKey::generate().unwrap();
        assert_eq!(
            open(&r, &stranger, Level::Media).err(),
            Some(InputError::UnknownDevice)
        );
        // a hub that hangs up on the first message without a word: a wrong hub key here, and what
        // a hub from before remote control does with the unknown mode
        let wrong = StaticKey::generate().unwrap().public();
        let (tx, _rx) = channel();
        assert_eq!(
            open_via(
                addr(&r),
                &key,
                &wrong,
                Level::Media,
                Box::new(move |e| {
                    let _ = tx.send(e);
                })
            )
            .err(),
            Some(InputError::NoAnswer)
        );
        // nobody listening at all is "not reachable"
        let dead = {
            let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            match l.local_addr().unwrap() {
                std::net::SocketAddr::V4(a) => a,
                _ => unreachable!(),
            }
        };
        let (tx, _rx) = channel();
        assert_eq!(
            open_via(
                dead,
                &key,
                &r.hub_key,
                Level::Media,
                Box::new(move |e| {
                    let _ = tx.send(e);
                })
            )
            .err(),
            Some(InputError::Network)
        );
        assert!(r.sink.taken().is_empty());
    }

    /// The phone is in the middle of sending when the PC ends the session: the reason still
    /// arrives (the hub does not just drop the socket with unread bytes in it).
    #[test]
    fn the_reason_arrives_also_while_the_phone_is_still_sending() {
        for _ in 0..5 {
            let r = rig();
            let key = granted(&r, Level::Full);
            let (input, _, events) = open(&r, &key, Level::Full).unwrap();
            let input = Arc::new(input);
            let sender = {
                let input = input.clone();
                std::thread::spawn(move || {
                    let frame = [Record::Move { dx: 1, dy: 0 }; 8];
                    while input.send_events(&frame).is_ok() {
                        std::thread::sleep(Duration::from_millis(1));
                    }
                })
            };
            wait_for(|| !r.sink.actions.lock().unwrap().is_empty());
            r.remote.end();
            assert_eq!(
                events.recv_timeout(WAIT),
                Ok(Event::Closed(Some(Code::Ended)))
            );
            sender.join().unwrap();
        }
    }

    #[test]
    fn outside_the_home_network_the_hub_takes_sync_but_no_input() {
        // the bind exists (a pairing window in another network), but it is not the home network
        let r = rig_on(
            ServerConfig {
                tick: Duration::from_millis(20),
                ..ServerConfig::default()
            },
            false,
        );
        let key = granted(&r, Level::Full);
        assert_eq!(
            open(&r, &key, Level::Media).err(),
            Some(InputError::UnknownDevice)
        );
        // sync works there as before, so the phone can tell this from an old or absent hub
        let mut sync = session(&r, &key);
        assert!(sync
            .request(&json!({"keyVersion": 1, "type": "info"}))
            .get("error")
            .is_none());
        assert_eq!(r.remote.status().controller, None);
    }

    #[test]
    fn what_the_pc_sends_unasked_does_not_keep_an_idle_session_alive() {
        let r = rig_with(ServerConfig {
            tick: Duration::from_millis(20),
            idle_timeout: Duration::from_millis(600),
            ..ServerConfig::default()
        });
        let key = granted(&r, Level::Media);
        let (input, _, events) = open(&r, &key, Level::Media).unwrap();
        // the PC's state keeps changing, the phone sends nothing
        let began = std::time::Instant::now();
        let mut states = 0;
        let end = loop {
            r.sink
                .set_volume((began.elapsed().as_millis() / 50 % 100) as u8);
            match events.recv_timeout(Duration::from_millis(50)) {
                Ok(Event::State(_)) => states += 1,
                Ok(closed @ Event::Closed(_)) => break closed,
                Err(_) => {}
            }
            assert!(began.elapsed() < WAIT, "never closed");
        };
        assert_eq!(end, Event::Closed(None), "idle: closed without a reason");
        assert!(states >= 1, "state frames did arrive");
        // one per 200 ms at most, however fast the state changes
        let most = began.elapsed().as_millis() / 200 + 1;
        assert!(
            states as u128 <= most,
            "{states} state frames, at most {most}"
        );
        wait_for(|| r.remote.status().controller.is_none());
        input.close();
    }

    #[test]
    fn a_frame_over_512_bytes_ends_an_input_connection_before_it_is_read() {
        let r = rig();
        let key = granted(&r, Level::Full);
        let (init, m1) = noise::start_initiator(Mode::Input, &key, &r.hub_key, None).unwrap();
        let mut s = connect(&r);
        send(&mut s, &m1);
        let Finished::Established(mut t, _) = init.finish(&recv(&mut s).unwrap()).unwrap() else {
            panic!()
        };
        send(&mut s, &t.seal(TAG_HELLO, b"Phone").unwrap());
        // announces a 513-byte frame: the hub closes on the length alone
        use std::io::Write;
        s.write_all(&u16::try_from(INPUT_CAP + 1).unwrap().to_be_bytes())
            .unwrap();
        assert!(closed(&mut s));

        // and before the first authenticated frame the cap is 256, as for every session
        let (init, m1) = noise::start_initiator(Mode::Input, &key, &r.hub_key, None).unwrap();
        let mut s = connect(&r);
        send(&mut s, &m1);
        let Finished::Established(..) = init.finish(&recv(&mut s).unwrap()).unwrap() else {
            panic!()
        };
        s.write_all(&257u16.to_be_bytes()).unwrap();
        assert!(closed(&mut s));
    }

    #[test]
    fn revoking_closes_the_input_session_and_unpair_is_not_an_input_frame() {
        let r = rig();
        let key = granted(&r, Level::Media);
        let (input, _, events) = open(&r, &key, Level::Media).unwrap();
        r.sessions.revoke(&*r.trust, &key.public()).unwrap();
        assert_eq!(events.recv_timeout(WAIT), Ok(Event::Closed(None)));
        input.close();
        assert_eq!(
            open(&r, &key, Level::Media).err(),
            Some(InputError::UnknownDevice)
        );

        // a raw `unpair` on an input session closes it and unpairs nobody
        let key = granted(&r, Level::Media);
        let (init, m1) = noise::start_initiator(Mode::Input, &key, &r.hub_key, None).unwrap();
        let mut s = connect(&r);
        send(&mut s, &m1);
        let Finished::Established(mut t, _) = init.finish(&recv(&mut s).unwrap()).unwrap() else {
            panic!()
        };
        send(&mut s, &t.seal(TAG_HELLO, b"Phone").unwrap());
        send(&mut s, &t.seal(TAG_UNPAIR, &[]).unwrap());
        assert!(closed(&mut s));
        assert!(!r.trust.find_by_key(&key.public()).unwrap().revoked);
    }

    #[test]
    fn the_input_client_dials_private_addresses_only() {
        let key = StaticKey::generate().unwrap();
        let hub = StaticKey::generate().unwrap().public();
        for public in ["8.8.8.8:4000", "127.0.0.1:4000", "100.64.0.1:4000"] {
            let (tx, _rx) = channel();
            assert_eq!(
                InputSession::open(
                    public.parse().unwrap(),
                    &key,
                    &hub,
                    "Phone",
                    Level::Media,
                    Box::new(move |e| {
                        let _ = tx.send(e);
                    })
                )
                .err(),
                Some(InputError::Network),
                "{public}"
            );
        }
    }
}
