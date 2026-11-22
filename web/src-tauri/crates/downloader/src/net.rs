//! Where a download may connect to (security review 2026-11, DL4, DL7, DL9).
//!
//! * Only public addresses: loopback, private, link-local, CGNAT, unique-local, multicast and
//!   unspecified addresses are refused – for an address typed as an IP at once ([`check_url`]),
//!   for a host name in the resolver, so the address that is checked is the one that is used
//!   (no second lookup an attacker's DNS could answer differently).
//! * Redirects are followed by the worker itself, one hop at a time, at most [`MAX_REDIRECTS`],
//!   each hop checked again, never from `https` to `http` ([`next_hop`]).
//! * A read that gets no byte for [`IDLE`] fails instead of hanging for ever (ureq has only
//!   whole-body timeouts, so each wait for input is capped in the transport).
//! * User name and password in an address are never written to the job list ([`without_credentials`]).

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use ureq::config::Config;
use ureq::http::Uri;
use ureq::unversioned::resolver::{DefaultResolver, ResolvedSocketAddrs, Resolver};
use ureq::unversioned::transport::{
    time::Duration as UreqDuration, Buffers, ConnectionDetails, Connector, DefaultConnector,
    NextTimeout, Transport,
};
use url::Url;

/// Most redirects one download follows.
pub const MAX_REDIRECTS: usize = 3;
/// Longest wait for the next byte from the server.
pub const IDLE: Duration = Duration::from_secs(60);

/// Whether a download may connect to `ip`.
pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => public_v4(v4),
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => public_v4(v4),
            None => public_v6(v6),
        },
    }
}

fn public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_multicast()
        || a == 0
        // shared address space (carrier-grade NAT, also many home routers' WAN side)
        || (a == 100 && (64..128).contains(&b))
        // 198.18.0.0/15 benchmarking, 240.0.0.0/4 reserved
        || (a == 198 && (b == 18 || b == 19))
        || a >= 240)
}

fn public_v6(ip: Ipv6Addr) -> bool {
    let first = ip.segments()[0];
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        // fc00::/7 unique local, fe80::/10 link-local
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80)
}

/// Why an address is refused (short codes for the page).
#[derive(Debug, PartialEq, Eq)]
pub enum Refused {
    /// Not `http`/`https`, or no host.
    Scheme,
    /// A host that is not on the internet (an IP of the home network, `localhost`, …).
    Host,
    /// A redirect from `https` to `http`, or too many redirects.
    Redirect,
}

impl Refused {
    pub fn code(&self) -> &'static str {
        match self {
            Refused::Scheme => "scheme",
            Refused::Host => "blocked",
            Refused::Redirect => "redirect",
        }
    }
}

/// Which addresses a manager may download from. Only [`Reach::Internet`] exists outside this
/// crate's tests.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Reach {
    Internet,
    #[cfg(test)]
    InternetAndLoopback,
}

impl Reach {
    fn allows(self, ip: IpAddr) -> bool {
        match self {
            Reach::Internet => is_public_ip(ip),
            #[cfg(test)]
            Reach::InternetAndLoopback => is_public_ip(ip) || ip.is_loopback(),
        }
    }
}

/// The checks that need no lookup: scheme, and a host written as an IP or as `localhost`.
pub fn check_url(url: &Url) -> Result<(), Refused> {
    check_url_for(url, Reach::Internet)
}

pub(crate) fn check_url_for(url: &Url, reach: Reach) -> Result<(), Refused> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err(Refused::Scheme);
    }
    match url.host() {
        None => Err(Refused::Scheme),
        Some(url::Host::Ipv4(ip)) if !reach.allows(IpAddr::V4(ip)) => Err(Refused::Host),
        Some(url::Host::Ipv6(ip)) if !reach.allows(IpAddr::V6(ip)) => Err(Refused::Host),
        Some(url::Host::Domain(d)) => {
            let d = d.trim_end_matches('.').to_ascii_lowercase();
            if d == "localhost" || d.ends_with(".localhost") {
                Err(Refused::Host)
            } else {
                Ok(())
            }
        }
        Some(_) => Ok(()),
    }
}

/// The address a redirect (`Location`) points to, if the download may follow it.
pub fn next_hop(current: &Url, location: &str) -> Result<Url, Refused> {
    next_hop_for(current, location, Reach::Internet)
}

pub(crate) fn next_hop_for(current: &Url, location: &str, reach: Reach) -> Result<Url, Refused> {
    let next = current.join(location.trim()).map_err(|_| Refused::Redirect)?;
    if current.scheme() == "https" && next.scheme() != "https" {
        return Err(Refused::Redirect);
    }
    check_url_for(&next, reach)?;
    Ok(next)
}

/// `url` without user name and password (the form the job list keeps).
pub fn without_credentials(url: &Url) -> Url {
    let mut out = url.clone();
    let _ = out.set_username("");
    let _ = out.set_password(None);
    out
}

/// The system resolver, keeping only public addresses. When it drops every address it sets
/// `blocked`, so the worker can say "blocked" instead of "not found". The address of a configured
/// proxy is not filtered (the proxy may well be on this machine).
#[derive(Debug)]
pub(crate) struct PublicResolver {
    inner: DefaultResolver,
    reach: Reach,
    pub(crate) blocked: Arc<AtomicBool>,
}

impl PublicResolver {
    pub(crate) fn new(reach: Reach) -> Self {
        PublicResolver {
            inner: DefaultResolver::default(),
            reach,
            blocked: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Resolver for PublicResolver {
    fn resolve(
        &self,
        uri: &Uri,
        config: &Config,
        timeout: NextTimeout,
    ) -> Result<ResolvedSocketAddrs, ureq::Error> {
        let all = self.inner.resolve(uri, config, timeout)?;
        let is_proxy = config
            .proxy()
            .is_some_and(|p| p.uri().host() == uri.host() && p.uri().port() == uri.port());
        if is_proxy {
            return Ok(all);
        }
        let mut kept = self.inner.empty();
        for addr in all.iter().filter(|a| self.reach.allows(a.ip())) {
            kept.push(*addr);
        }
        if kept.is_empty() {
            self.blocked.store(true, Ordering::Relaxed);
            return Err(ureq::Error::HostNotFound);
        }
        Ok(kept)
    }
}

/// Puts [`IdleCap`] over the transports the default connector makes.
#[derive(Debug)]
pub(crate) struct IdleConnector;

impl Connector<Box<dyn Transport>> for IdleConnector {
    type Out = IdleCap;

    fn connect(
        &self,
        _details: &ConnectionDetails,
        chained: Option<Box<dyn Transport>>,
    ) -> Result<Option<IdleCap>, ureq::Error> {
        Ok(chained.map(IdleCap))
    }
}

/// A transport whose every wait for input ends after [`IDLE`] at the latest.
#[derive(Debug)]
pub(crate) struct IdleCap(Box<dyn Transport>);

fn capped(timeout: NextTimeout) -> NextTimeout {
    let idle = UreqDuration::from(IDLE);
    NextTimeout {
        after: if timeout.after < idle {
            timeout.after
        } else {
            idle
        },
        reason: timeout.reason,
    }
}

impl Transport for IdleCap {
    fn buffers(&mut self) -> &mut dyn Buffers {
        self.0.buffers()
    }

    fn transmit_output(&mut self, amount: usize, timeout: NextTimeout) -> Result<(), ureq::Error> {
        self.0.transmit_output(amount, capped(timeout))
    }

    fn await_input(&mut self, timeout: NextTimeout) -> Result<bool, ureq::Error> {
        self.0.await_input(capped(timeout))
    }

    fn is_open(&mut self) -> bool {
        self.0.is_open()
    }

    fn is_tls(&self) -> bool {
        self.0.is_tls()
    }
}

/// The agent of one download: public addresses only, no automatic redirects, the idle cap.
pub(crate) fn agent(reach: Reach) -> (ureq::Agent, Arc<AtomicBool>) {
    let config = ureq::Agent::config_builder()
        .timeout_global(None)
        .timeout_connect(Some(Duration::from_secs(30)))
        .timeout_recv_response(Some(IDLE))
        .max_redirects(0)
        .http_status_as_error(false)
        .build();
    let resolver = PublicResolver::new(reach);
    let blocked = resolver.blocked.clone();
    let connector = DefaultConnector::default().chain(IdleConnector);
    (ureq::Agent::with_parts(config, connector, resolver), blocked)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn only_public_addresses() {
        for bad in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.178.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "224.0.0.1",
            "::1",
            "::",
            "fe80::1",
            "fd00::1",
            "::ffff:192.168.0.1",
        ] {
            assert!(!is_public_ip(bad.parse().unwrap()), "{bad}");
        }
        for ok in ["1.1.1.1", "93.184.216.34", "2606:4700::1111"] {
            assert!(is_public_ip(ok.parse().unwrap()), "{ok}");
        }
    }

    #[test]
    fn addresses_of_the_home_network_are_refused_before_any_connection() {
        assert_eq!(check_url(&u("http://192.168.178.1/x")), Err(Refused::Host));
        assert_eq!(check_url(&u("http://[::1]:8080/x")), Err(Refused::Host));
        assert_eq!(check_url(&u("http://localhost/x")), Err(Refused::Host));
        assert_eq!(check_url(&u("http://a.localhost./x")), Err(Refused::Host));
        assert_eq!(check_url(&u("ftp://example.org/x")), Err(Refused::Scheme));
        assert_eq!(check_url(&u("https://example.org/x.iso")), Ok(()));
    }

    #[test]
    fn redirects_are_checked_per_hop() {
        let from = u("https://example.org/dl");
        assert_eq!(
            next_hop(&from, "/files/a.iso").unwrap().as_str(),
            "https://example.org/files/a.iso"
        );
        assert_eq!(next_hop(&from, "http://example.org/a"), Err(Refused::Redirect));
        assert_eq!(next_hop(&from, "https://127.0.0.1/a"), Err(Refused::Host));
        let plain = u("http://example.org/dl");
        assert!(next_hop(&plain, "https://cdn.example.org/a").is_ok());
        assert_eq!(next_hop(&plain, "http://10.0.0.1/"), Err(Refused::Host));
    }

    #[test]
    fn credentials_never_reach_the_job_list() {
        let full = u("https://user:secret@example.org/a.zip?token=t");
        let kept = without_credentials(&full);
        assert_eq!(kept.as_str(), "https://example.org/a.zip?token=t");
    }

    #[test]
    fn a_wait_is_capped_at_the_idle_limit() {
        let long = NextTimeout {
            after: UreqDuration::from(Duration::from_secs(3600)),
            reason: ureq::Timeout::Global,
        };
        assert_eq!(capped(long).after, UreqDuration::from(IDLE));
        let short = NextTimeout {
            after: UreqDuration::from(Duration::from_secs(5)),
            reason: ureq::Timeout::Global,
        };
        assert_eq!(capped(short).after, UreqDuration::from(Duration::from_secs(5)));
    }
}
