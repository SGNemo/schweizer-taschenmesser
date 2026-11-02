use url::Url;

/// Big ad/tracker networks, written by hand for this project (no third-party list is copied: the usual
/// ones are GPL / CC-BY-SA, which the licence policy excludes). Matches the host and every subdomain.
/// Deliberately not complete: the user adds more with "Diese Werbung blockieren".
pub const BUILTIN_DOMAINS: &[&str] = &[
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adservice.google.com",
    "googletagmanager.com",
    "google-analytics.com",
    "adnxs.com",
    "adsrvr.org",
    "advertising.com",
    "amazon-adsystem.com",
    "criteo.com",
    "criteo.net",
    "taboola.com",
    "outbrain.com",
    "pubmatic.com",
    "rubiconproject.com",
    "openx.net",
    "casalemedia.com",
    "smartadserver.com",
    "scorecardresearch.com",
    "quantserve.com",
    "moatads.com",
    "adform.net",
    "yieldlab.net",
    "teads.tv",
    "media.net",
    "2mdn.net",
    "facebook.net",
    "connect.facebook.net",
    "hotjar.com",
    "mixpanel.com",
    "segment.io",
    "branch.io",
    "adjust.com",
    "appsflyer.com",
    "bat.bing.com",
    "ads.linkedin.com",
    "ads.twitter.com",
    "analytics.tiktok.com",
    "ads.yahoo.com",
    "popads.net",
    "propellerads.com",
    "adcolony.com",
    "inmobi.com",
    "mgid.com",
    "zemanta.com",
    "sharethrough.com",
    "33across.com",
    "bidswitch.net",
    "contextweb.com",
    "lijit.com",
    "sovrn.com",
    "triplelift.com",
    "indexww.com",
    "id5-sync.com",
    "adition.com",
    "ioam.de",
    "etracker.com",
    "ivwbox.de",
];

/// One user rule: a whole host (with subdomains) or one exact address (host + path, no query).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Rule {
    Domain(String),
    Address(String),
}

impl Rule {
    /// Build a rule from an address the user chose. `whole_host` = block the domain, else only this path.
    pub fn from_url(url: &Url, whole_host: bool) -> Option<Rule> {
        let host = url.host_str()?.to_ascii_lowercase();
        Some(if whole_host {
            Rule::Domain(host)
        } else {
            Rule::Address(format!("{host}{}", url.path()))
        })
    }
}

/// Decides per request. Built-in list + user rules; `paused_hosts` (sites where the user paused it).
#[derive(Debug, Default, Clone)]
pub struct Blocker {
    pub enabled: bool,
    pub user: Vec<Rule>,
    pub paused_hosts: Vec<String>,
}

fn host_matches(host: &str, domain: &str) -> bool {
    host == domain || host.strip_suffix(domain).is_some_and(|p| p.ends_with('.'))
}

impl Blocker {
    pub fn new(enabled: bool) -> Self {
        Blocker {
            enabled,
            ..Default::default()
        }
    }

    /// Should `request` (sub-resource or navigation) be stopped while the tab shows `page`?
    /// First-party requests (same registrable-ish host as the page) are never blocked, so a site the
    /// user opened on purpose keeps working; user rules still apply to third parties only as well.
    pub fn blocks(&self, request: &Url, page: Option<&Url>) -> bool {
        if !self.enabled || !matches!(request.scheme(), "http" | "https") {
            return false;
        }
        let Some(host) = request.host_str().map(str::to_ascii_lowercase) else {
            return false;
        };
        if let Some(page_host) = page.and_then(|p| p.host_str()).map(str::to_ascii_lowercase) {
            if self
                .paused_hosts
                .iter()
                .any(|p| host_matches(&page_host, p))
            {
                return false;
            }
            if host_matches(&host, &page_host) || host_matches(&page_host, &host) {
                return false;
            }
        }
        if BUILTIN_DOMAINS.iter().any(|d| host_matches(&host, d)) {
            return true;
        }
        let addr = format!("{host}{}", request.path());
        self.user.iter().any(|r| match r {
            Rule::Domain(d) => host_matches(&host, d),
            Rule::Address(a) => *a == addr,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn builtin_matches_host_and_subdomains_only() {
        let b = Blocker::new(true);
        let page = u("https://news.example/");
        assert!(b.blocks(&u("https://doubleclick.net/x"), Some(&page)));
        assert!(b.blocks(&u("https://ad.doubleclick.net/x"), Some(&page)));
        assert!(!b.blocks(&u("https://notdoubleclick.net/x"), Some(&page)));
        assert!(!b.blocks(&u("https://example.net/x"), Some(&page)));
    }

    #[test]
    fn off_and_non_http_never_block() {
        assert!(!Blocker::new(false).blocks(&u("https://doubleclick.net/"), None));
        assert!(!Blocker::new(true).blocks(&u("data:text/plain,x"), None));
    }

    #[test]
    fn first_party_is_kept_and_pause_works() {
        let mut b = Blocker::new(true);
        assert!(!b.blocks(
            &u("https://ads.linkedin.com/a"),
            Some(&u("https://ads.linkedin.com/"))
        ));
        b.paused_hosts.push("news.example".into());
        assert!(!b.blocks(
            &u("https://doubleclick.net/x"),
            Some(&u("https://www.news.example/"))
        ));
    }

    #[test]
    fn user_rules_domain_and_exact_address() {
        let mut b = Blocker::new(true);
        let page = u("https://news.example/");
        b.user
            .push(Rule::from_url(&u("https://cdn.adco.test/banner.png?x=1"), false).unwrap());
        b.user
            .push(Rule::from_url(&u("https://track.other.test/p"), true).unwrap());
        assert!(b.blocks(&u("https://cdn.adco.test/banner.png?y=2"), Some(&page)));
        assert!(!b.blocks(&u("https://cdn.adco.test/logo.png"), Some(&page)));
        assert!(b.blocks(&u("https://a.track.other.test/q"), Some(&page)));
    }
}
