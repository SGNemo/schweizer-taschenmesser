use super::*;
use crate::endpoint::Endpoint;
use crate::hub::router::Admission;
use crate::hub::{Hub, TAG_REQUEST, TAG_RESPONSE};
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
    adm.set_binds(loopback());
    adm.allow_loopback_for_tests();
    let router = Arc::new(Router::new(ep, host.clone(), hub, adm));
    let server = Server::start_for_tests(&loopback(), router.clone(), cfg).unwrap();
    Rig {
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
