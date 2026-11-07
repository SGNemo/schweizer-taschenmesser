//! Keeps the listeners in line with the wish and the network: [`Supervisor::tick`] is called every
//! few seconds (and after a command) with the current interfaces, and it
//!
//! * asks `netpolicy::decide` whether the hub may listen at all and on which addresses,
//! * tears everything down **before** anything else when the answer is "off" or the set of
//!   addresses (or the UTC day of the mDNS hint) changed, then starts again on the new set,
//! * never starts anything while the decision is "off" (fail-closed), and retries a failed start
//!   on the next tick.
//!
//! What "start" means is behind [`Launcher`] (tests count calls; [`RealLauncher`] opens the
//! transport and the announcement).

use crate::discovery::Announcer;
use crate::hub::netpolicy::{
    decide, Bind, Decision, HomeNetworkStore, NetworkInfo, OffReason, Wanted,
};
use crate::hub::router::Router;
use crate::noise::PublicKey;
use crate::transport::{Server, ServerConfig};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

pub trait Launcher: Send {
    /// Dropping the handle stops everything that was started.
    type Handle: Send;
    /// Starts on exactly `binds`; returns the handle and the port.
    fn launch(&mut self, binds: &[Bind], day: i64) -> Result<(Self::Handle, u16), ()>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Status {
    Off(OffReason),
    /// The decision allowed listening but the start failed (retried on the next tick).
    Failed,
    Listening {
        binds: Vec<Bind>,
        port: u16,
    },
}

struct Running<H> {
    handle: H,
    binds: Vec<Bind>,
    day: i64,
    port: u16,
}

pub struct Supervisor<L: Launcher> {
    launcher: L,
    running: Option<Running<L::Handle>>,
}

impl<L: Launcher> Supervisor<L> {
    pub fn new(launcher: L) -> Self {
        Supervisor {
            launcher,
            running: None,
        }
    }

    pub fn tick(
        &mut self,
        info: &dyn NetworkInfo,
        home: &dyn HomeNetworkStore,
        wanted: Wanted,
        day: i64,
    ) -> Status {
        match decide(info, home, wanted) {
            Decision::Off(reason) => {
                self.stop();
                Status::Off(reason)
            }
            Decision::On(binds) => {
                if let Some(r) = &self.running {
                    if r.binds == binds && r.day == day {
                        return Status::Listening {
                            binds,
                            port: r.port,
                        };
                    }
                }
                // changed (or not running): the old sockets go first
                self.stop();
                match self.launcher.launch(&binds, day) {
                    Ok((handle, port)) => {
                        self.running = Some(Running {
                            handle,
                            binds: binds.clone(),
                            day,
                            port,
                        });
                        Status::Listening { binds, port }
                    }
                    Err(()) => Status::Failed,
                }
            }
        }
    }

    pub fn stop(&mut self) {
        self.running = None;
    }

    pub fn handle(&self) -> Option<&L::Handle> {
        self.running.as_ref().map(|r| &r.handle)
    }

    /// Port and addresses while listening.
    pub fn listening(&self) -> Option<(&[Bind], u16)> {
        self.running.as_ref().map(|r| (&r.binds[..], r.port))
    }
}

/// The real thing: transport server plus mDNS announcement on the same addresses.
pub struct RealLauncher {
    pub router: Arc<Router>,
    pub hub_key: PublicKey,
    pub cfg: ServerConfig,
}

/// What a running hub consists of. Dropping it closes the listeners and withdraws the
/// announcement; the router then admits nobody.
pub struct Live {
    server: Option<Server>,
    _announcer: Option<Announcer>,
    router: Arc<Router>,
}

impl Live {
    pub fn deliver(&self, attempt: u64, wire: Vec<u8>) -> bool {
        self.server
            .as_ref()
            .is_some_and(|s| s.deliver(attempt, wire))
    }
}

impl Drop for Live {
    fn drop(&mut self) {
        self.router.set_binds(Vec::new());
        // listeners first, then the announcement
        self.server = None;
    }
}

fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

impl Launcher for RealLauncher {
    type Handle = Live;

    fn launch(&mut self, binds: &[Bind], _day: i64) -> Result<(Live, u16), ()> {
        self.router.set_binds(binds.to_vec());
        let server = match Server::start(binds, 0, self.router.clone(), self.cfg) {
            Ok(s) => s,
            Err(_) => {
                self.router.set_binds(Vec::new());
                return Err(());
            }
        };
        let port = server.port();
        // no mDNS (multicast blocked, no permission): the hub still serves, the QR carries the address
        let announcer = Announcer::start(binds, port, &self.hub_key, unix_secs()).ok();
        Ok((
            Live {
                server: Some(server),
                _announcer: announcer,
                router: self.router.clone(),
            },
            port,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hub::netpolicy::{IfaceInfo, NetCategory, NetError};
    use std::cell::RefCell;
    use std::net::IpAddr;
    use std::rc::Rc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    struct Net(RefCell<Result<Vec<IfaceInfo>, NetError>>);
    impl NetworkInfo for Net {
        fn interfaces(&self) -> Result<Vec<IfaceInfo>, NetError> {
            self.0.borrow().clone()
        }
    }
    struct Home(Option<String>);
    impl HomeNetworkStore for Home {
        fn home_network_id(&self) -> Result<Option<String>, NetError> {
            Ok(self.0.clone())
        }
    }

    fn iface(ip: &str, id: &str) -> IfaceInfo {
        IfaceInfo {
            ip: ip.parse::<IpAddr>().unwrap(),
            prefix: 24,
            has_default_route: true,
            category: NetCategory::Private,
            network_id: Some(id.into()),
        }
    }

    #[derive(Default)]
    struct Counters {
        started: AtomicUsize,
        alive: AtomicUsize,
    }
    struct Handle(Arc<Counters>);
    impl Drop for Handle {
        fn drop(&mut self) {
            self.0.alive.fetch_sub(1, Ordering::SeqCst);
        }
    }
    struct Fake {
        c: Arc<Counters>,
        fail: Arc<AtomicBool>,
    }
    impl Launcher for Fake {
        type Handle = Handle;
        fn launch(&mut self, _b: &[Bind], _d: i64) -> Result<(Handle, u16), ()> {
            if self.fail.load(Ordering::SeqCst) {
                return Err(());
            }
            self.c.started.fetch_add(1, Ordering::SeqCst);
            self.c.alive.fetch_add(1, Ordering::SeqCst);
            Ok((Handle(self.c.clone()), 4242))
        }
    }

    fn rig() -> (Supervisor<Fake>, Arc<Counters>, Arc<AtomicBool>) {
        let c = Arc::new(Counters::default());
        let fail = Arc::new(AtomicBool::new(false));
        (
            Supervisor::new(Fake {
                c: c.clone(),
                fail: fail.clone(),
            }),
            c,
            fail,
        )
    }

    const PAIRED: Wanted = Wanted {
        pairing_window_open: false,
        paired_devices: 1,
    };

    #[test]
    fn nothing_starts_without_a_wish_or_in_the_wrong_network() {
        let (mut s, c, _) = rig();
        let net = Net(RefCell::new(Ok(vec![iface("192.168.1.20", "home")])));
        let none = Wanted {
            pairing_window_open: false,
            paired_devices: 0,
        };
        assert_eq!(
            s.tick(&net, &Home(None), none, 1),
            Status::Off(OffReason::NothingWanted)
        );
        assert_eq!(
            s.tick(&net, &Home(None), PAIRED, 1),
            Status::Off(OffReason::NoHomeNetwork)
        );
        assert_eq!(
            s.tick(&net, &Home(Some("cafe".into())), PAIRED, 1),
            Status::Off(OffReason::NoQualifyingInterface)
        );
        assert_eq!(c.started.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn it_listens_in_the_home_network_and_stops_the_moment_it_leaves() {
        let (mut s, c, _) = rig();
        let net = Net(RefCell::new(Ok(vec![iface("192.168.1.20", "home")])));
        let home = Home(Some("home".into()));
        assert!(matches!(
            s.tick(&net, &home, PAIRED, 1),
            Status::Listening { port: 4242, .. }
        ));
        assert!(matches!(
            s.tick(&net, &home, PAIRED, 1),
            Status::Listening { .. }
        ));
        assert_eq!(
            c.started.load(Ordering::SeqCst),
            1,
            "no restart without a change"
        );
        // moved to a café: sockets are gone at once
        *net.0.borrow_mut() = Ok(vec![iface("10.5.0.7", "cafe")]);
        assert_eq!(
            s.tick(&net, &home, PAIRED, 1),
            Status::Off(OffReason::NoQualifyingInterface)
        );
        assert_eq!(c.alive.load(Ordering::SeqCst), 0);
        // an unreadable network list is "off", not "keep going"
        *net.0.borrow_mut() = Ok(vec![iface("192.168.1.20", "home")]);
        assert!(matches!(
            s.tick(&net, &home, PAIRED, 1),
            Status::Listening { .. }
        ));
        *net.0.borrow_mut() = Err(NetError);
        assert_eq!(
            s.tick(&net, &home, PAIRED, 1),
            Status::Off(OffReason::NetworkUnreadable)
        );
        assert_eq!(c.alive.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn a_new_address_or_a_new_day_restarts_with_the_old_sockets_closed_first() {
        let (mut s, c, _) = rig();
        let net = Net(RefCell::new(Ok(vec![iface("192.168.1.20", "home")])));
        let home = Home(Some("home".into()));
        s.tick(&net, &home, PAIRED, 1);
        *net.0.borrow_mut() = Ok(vec![iface("192.168.1.21", "home")]);
        s.tick(&net, &home, PAIRED, 1);
        assert_eq!(
            (
                c.started.load(Ordering::SeqCst),
                c.alive.load(Ordering::SeqCst)
            ),
            (2, 1)
        );
        s.tick(&net, &home, PAIRED, 2); // midnight: new hint
        assert_eq!(
            (
                c.started.load(Ordering::SeqCst),
                c.alive.load(Ordering::SeqCst)
            ),
            (3, 1)
        );
        assert_eq!(s.listening().unwrap().1, 4242);
        s.stop();
        assert_eq!(c.alive.load(Ordering::SeqCst), 0);
        assert!(s.handle().is_none());
    }

    #[test]
    fn a_failed_start_is_reported_and_retried() {
        let (mut s, c, fail) = rig();
        let net = Net(RefCell::new(Ok(vec![iface("192.168.1.20", "home")])));
        let home = Home(Some("home".into()));
        fail.store(true, Ordering::SeqCst);
        assert_eq!(s.tick(&net, &home, PAIRED, 1), Status::Failed);
        assert!(s.listening().is_none());
        fail.store(false, Ordering::SeqCst);
        assert!(matches!(
            s.tick(&net, &home, PAIRED, 1),
            Status::Listening { .. }
        ));
        assert_eq!(c.started.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn an_open_window_listens_in_any_private_network() {
        let (mut s, _, _) = rig();
        let net = Net(RefCell::new(Ok(vec![iface("10.5.0.7", "cafe")])));
        let w = Wanted {
            pairing_window_open: true,
            paired_devices: 0,
        };
        assert!(matches!(
            s.tick(&net, &Home(None), w, 1),
            Status::Listening { .. }
        ));
    }
}
