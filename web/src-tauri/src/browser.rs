//! Built-in browser (desktop): every tab is a child webview of the main window with its OWN data
//! store (cookies/cache in `browser-profile`, or in memory for private tabs). The tab webviews have
//! no IPC: no capability names them, they load remote pages, and we inject no script into them.
//! Back/forward use the tab's own address list (no `history.back()` eval); popups, downloads and
//! non-HTTP(S) schemes are stopped in the navigation handlers. Decisions live in
//! `crates/browser-filter` (Tauri-free, unit-tested). Only the `main` webview may call these commands.

use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::Mutex,
};

use browser_filter::{classify, Blocker, Rule, Verdict};
use serde::{Deserialize, Serialize};
use tauri::{
    ipc::Channel,
    webview::{DownloadEvent, NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, LogicalPosition, LogicalSize, Manager, State, Url, Webview, WebviewUrl,
};

const MAIN: &str = "main";

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum Event {
    Url { tab: u32, url: String },
    Title { tab: u32, title: String },
    Loading { tab: u32, loading: bool },
    HttpHeld { tab: u32, url: String },
    PopupBlocked { tab: u32, url: String },
    Download { tab: u32, url: String },
    Blocked { tab: u32, host: String },
    Seen { tab: u32, host: String },
}

#[derive(Deserialize, Clone, Copy)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenOptions {
    tab: u32,
    url: String,
    bounds: Bounds,
    private_tab: bool,
    zoom: f64,
    #[serde(default)]
    allow_http: bool,
}

#[derive(Deserialize)]
pub struct RuleIn {
    kind: String,
    value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    warn_http: bool,
    blocker_enabled: bool,
    rules: Vec<RuleIn>,
    paused_hosts: Vec<String>,
}

struct Tab {
    events: Channel<Event>,
    /// Addresses this tab visited (own list: back/forward navigate to them).
    history: Vec<Url>,
    pos: usize,
    by_history: bool,
    /// Plain-HTTP addresses the user confirmed.
    allowed_http: HashSet<String>,
    page: Option<Url>,
    /// Third-party hosts already reported as `Seen`.
    seen: HashSet<String>,
    /// Which `browser_open` call created this entry (see the check after `add_child`).
    attempt: u64,
    /// The webview was created. Only then can `browser_show` call it lost: while `browser_open`
    /// still builds it, the entry exists and the webview does not.
    ready: bool,
}

struct Inner {
    warn_http: bool,
    blocker: Blocker,
    tabs: HashMap<u32, Tab>,
    attempts: u64,
}

/// `.1` serialises `browser_show` and holds the page life (`epoch`) and the newest `seq` applied in it (see there).
pub struct BrowserState(Mutex<Inner>, Mutex<(u64, u64)>);

impl Default for BrowserState {
    fn default() -> Self {
        BrowserState(
            Mutex::new(Inner {
                warn_http: true,
                blocker: Blocker::new(true),
                tabs: HashMap::new(),
                attempts: 0,
            }),
            Mutex::new((0, 0)),
        )
    }
}

impl BrowserState {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn emit(&self, tab: u32, event: Event) {
        let channel = self.lock().tabs.get(&tab).map(|t| t.events.clone());
        if let Some(c) = channel {
            let _ = c.send(event);
        }
    }
}

fn label(tab: u32) -> String {
    format!("browser-tab-{tab}")
}

fn ensure_main(webview: &Webview) -> Result<(), String> {
    if webview.label() == MAIN {
        Ok(())
    } else {
        Err("forbidden".into())
    }
}

/// Where cookies and cache of the browser live: next to the portable exe, else in the user's local app data.
fn profile_dir(app: &AppHandle) -> Option<PathBuf> {
    #[cfg(windows)]
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| crate::portable::data_dir(&exe, &app.config().identifier))
    {
        return dir.parent().map(|p| p.join("browser-profile"));
    }
    app.path()
        .app_local_data_dir()
        .ok()
        .map(|d| d.join("browser-profile"))
}

fn parse(url: &str) -> Result<Url, String> {
    Url::parse(url).map_err(|_| "url".to_string())
}

/// Lifecycle commands (`open`, `close`, `clear_data`) run with `async`, i.e. on Tauri's async
/// runtime, never on the main thread: creating a webview from a synchronous command deadlocks
/// WebView2 on Windows (tauri `WebviewBuilder` docs, wry#583). That froze the main thread, so no
/// IPC call and no app asset (lazy module pages) was answered any more and every other page stayed
/// at "…" until a restart. `tests/commands.rs` pins this.
#[tauri::command(async)]
pub fn browser_open(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    options: OpenOptions,
    events: Channel<Event>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let tab = options.tab;
    let url = parse(&options.url)?;
    let verdict = classify(&url);
    if verdict == Verdict::Deny {
        return Err("scheme".into());
    }
    // Idempotent: a tab id that still has a webview (an earlier attempt) is replaced, not duplicated.
    forget(&app, &state, tab);
    let warn = state.lock().warn_http;
    let held = verdict == Verdict::WarnHttp && warn && !options.allow_http;
    let start = if held {
        parse("about:blank")?
    } else {
        url.clone()
    };
    let mut allowed = HashSet::new();
    if options.allow_http {
        allowed.insert(url.to_string());
    }
    let attempt = {
        let mut g = state.lock();
        g.attempts += 1;
        let attempt = g.attempts;
        g.tabs.insert(
            tab,
            Tab {
                events: events.clone(),
                history: Vec::new(),
                pos: 0,
                by_history: false,
                allowed_http: allowed,
                page: None,
                seen: HashSet::new(),
                attempt,
                ready: false,
            },
        );
        attempt
    };
    if held {
        let _ = events.send(Event::HttpHeld {
            tab,
            url: url.to_string(),
        });
    }

    let a_nav = app.clone();
    let a_load = app.clone();
    let a_title = app.clone();
    let a_pop = app.clone();
    let a_dl = app.clone();
    let mut builder = WebviewBuilder::new(label(tab), WebviewUrl::External(start))
        .on_navigation(move |u| {
            let state = a_nav.state::<BrowserState>();
            let (allow, event) = {
                let g = state.lock();
                let page = g.tabs.get(&tab).and_then(|t| t.page.clone());
                match classify(u) {
                    Verdict::Deny => (false, None),
                    Verdict::WarnHttp
                        if g.warn_http
                            && !g
                                .tabs
                                .get(&tab)
                                .is_some_and(|t| t.allowed_http.contains(u.as_str())) =>
                    {
                        (
                            false,
                            Some(Event::HttpHeld {
                                tab,
                                url: u.to_string(),
                            }),
                        )
                    }
                    _ if g.blocker.blocks(u, page.as_ref()) => (
                        false,
                        Some(Event::Blocked {
                            tab,
                            host: u.host_str().unwrap_or_default().to_string(),
                        }),
                    ),
                    _ => (true, None),
                }
            };
            if let Some(e) = event {
                state.emit(tab, e);
            }
            allow
        })
        .on_page_load(move |_, payload| {
            let state = a_load.state::<BrowserState>();
            let url = payload.url().clone();
            match payload.event() {
                PageLoadEvent::Started => {
                    if url.as_str() != "about:blank" {
                        {
                            let mut g = state.lock();
                            if let Some(t) = g.tabs.get_mut(&tab) {
                                if t.by_history {
                                    t.by_history = false;
                                } else if t.history.get(t.pos) != Some(&url) {
                                    if !t.history.is_empty() {
                                        t.history.truncate(t.pos + 1);
                                    }
                                    t.history.push(url.clone());
                                    t.pos = t.history.len() - 1;
                                }
                                t.page = Some(url.clone());
                            }
                        }
                        state.emit(
                            tab,
                            Event::Url {
                                tab,
                                url: url.to_string(),
                            },
                        );
                    }
                    state.emit(tab, Event::Loading { tab, loading: true });
                }
                PageLoadEvent::Finished => {
                    state.emit(
                        tab,
                        Event::Loading {
                            tab,
                            loading: false,
                        },
                    );
                }
            }
        })
        .on_document_title_changed(move |_, title| {
            a_title
                .state::<BrowserState>()
                .emit(tab, Event::Title { tab, title });
        })
        .on_new_window(move |u, _| {
            a_pop.state::<BrowserState>().emit(
                tab,
                Event::PopupBlocked {
                    tab,
                    url: u.to_string(),
                },
            );
            NewWindowResponse::Deny
        })
        .on_download(move |_, ev| {
            if let DownloadEvent::Requested { url, .. } = ev {
                a_dl.state::<BrowserState>().emit(
                    tab,
                    Event::Download {
                        tab,
                        url: url.to_string(),
                    },
                );
            }
            // Never saved by the webview; the address goes to the download manager.
            false
        });
    if options.private_tab {
        builder = builder.incognito(true);
    } else if let Some(dir) = profile_dir(&app) {
        builder = builder.data_directory(dir);
    }

    let window = app.get_window(MAIN).ok_or("window")?;
    let b = options.bounds;
    let created = window
        .add_child(
            builder,
            LogicalPosition::new(b.x, b.y),
            LogicalSize::new(b.width, b.height),
        )
        .map_err(|e| e.to_string());
    // The page may have given up meanwhile (timeout → `browser_close`): a webview without its entry
    // would be out of reach of `browser_show` and stay on top of every page, so it is closed again.
    let current = |g: &Inner| g.tabs.get(&tab).is_some_and(|t| t.attempt == attempt);
    match created {
        Ok(wv) if !mark_ready(&mut state.lock(), tab, attempt) => {
            let _ = wv.close();
            Err("tab".into())
        }
        Ok(wv) => {
            #[cfg(windows)]
            crate::browser_win::hook(&app, &wv, tab);
            if (options.zoom - 1.0).abs() > f64::EPSILON {
                let _ = wv.set_zoom(options.zoom);
            }
            Ok(())
        }
        Err(e) => {
            let mut g = state.lock();
            if current(&g) {
                g.tabs.remove(&tab);
            }
            Err(e)
        }
    }
}

/// Marks the entry of this `browser_open` call as having its webview; `false` when the entry is gone
/// or belongs to a newer call.
fn mark_ready(inner: &mut Inner, tab: u32, attempt: u64) -> bool {
    match inner.tabs.get_mut(&tab) {
        Some(t) if t.attempt == attempt => {
            t.ready = true;
            true
        }
        _ => false,
    }
}

/// Whether a `browser_show` call numbered `seq` is newer than the last one applied; remembers it if so.
///
/// The page counts from 1 again after every reload of the main window, while this state lives as long as
/// the app. `epoch` names the page life the call comes from: a call from another life than the last one
/// applied is always the newest (the old page is gone and can send nothing any more), and counting starts
/// over. Without it every show after a reload did nothing until the counter had caught up.
fn newer_show(last: &mut (u64, u64), epoch: u64, seq: u64) -> bool {
    if epoch == last.0 && seq <= last.1 {
        return false;
    }
    *last = (epoch, seq);
    true
}

/// Forgets the tabs in `gone` (id, attempt) that are still the same ready entry and returns their
/// ids. An entry that was closed or reopened meanwhile is not lost and is left alone.
fn drop_lost(inner: &mut Inner, gone: &[(u32, u64)]) -> Vec<u32> {
    let mut lost: Vec<u32> = gone
        .iter()
        .filter(|(id, attempt)| {
            inner
                .tabs
                .get(id)
                .is_some_and(|t| t.ready && t.attempt == *attempt)
        })
        .map(|(id, _)| *id)
        .collect();
    for id in &lost {
        inner.tabs.remove(id);
    }
    lost.sort_unstable();
    lost
}

fn tab_webview(app: &AppHandle, tab: u32) -> Result<Webview, String> {
    app.get_webview(&label(tab))
        .ok_or_else(|| "tab".to_string())
}

#[tauri::command]
pub fn browser_navigate(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: u32,
    url: String,
    allow_http: bool,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let url = parse(&url)?;
    if classify(&url) == Verdict::Deny {
        return Err("scheme".into());
    }
    if allow_http {
        if let Some(t) = state.lock().tabs.get_mut(&tab) {
            t.allowed_http.insert(url.to_string());
        }
    }
    tab_webview(&app, tab)?
        .navigate(url)
        .map_err(|e| e.to_string())
}

fn step(app: &AppHandle, state: &BrowserState, tab: u32, delta: isize) -> Result<(), String> {
    let target = {
        let mut g = state.lock();
        let t = g.tabs.get_mut(&tab).ok_or("tab")?;
        let next = t.pos as isize + delta;
        if next < 0 || next as usize >= t.history.len() {
            return Ok(());
        }
        t.pos = next as usize;
        t.by_history = true;
        t.history[t.pos].clone()
    };
    tab_webview(app, tab)?
        .navigate(target)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_back(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: u32,
) -> Result<(), String> {
    ensure_main(&webview)?;
    step(&app, &state, tab, -1)
}

#[tauri::command]
pub fn browser_forward(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: u32,
) -> Result<(), String> {
    ensure_main(&webview)?;
    step(&app, &state, tab, 1)
}

#[tauri::command]
pub fn browser_reload(app: AppHandle, webview: Webview, tab: u32) -> Result<(), String> {
    ensure_main(&webview)?;
    tab_webview(&app, tab)?.reload().map_err(|e| e.to_string())
}

/// Drops the tab's state and closes its webview if there is one. Safe to call any number of times.
fn forget(app: &AppHandle, state: &BrowserState, tab: u32) {
    state.lock().tabs.remove(&tab);
    if let Ok(wv) = tab_webview(app, tab) {
        let _ = wv.close();
    }
}

#[tauri::command(async)]
pub fn browser_close(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: u32,
) -> Result<(), String> {
    ensure_main(&webview)?;
    forget(&app, &state, tab);
    Ok(())
}

/// Shows `tab` (and hides every other tab); `None` hides all. Runs off the main thread like the
/// lifecycle commands, so two calls can overtake each other: the page numbers them (`seq`) and a
/// call older than the last applied one does nothing, otherwise a late "show" could put a tab back
/// on top of another Nemo page after the "hide" that followed it.
///
/// Returns the ids of tabs whose webview no longer exists although it was created (it is not
/// registered any more, e.g. after it was destroyed underneath us). They are forgotten here and the
/// page shows "Tab neu öffnen" instead of an empty area. A tab that is still being created is not lost.
#[tauri::command(async)]
pub fn browser_show(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: Option<u32>,
    bounds: Option<Bounds>,
    epoch: u64,
    seq: u64,
) -> Result<Vec<u32>, String> {
    ensure_main(&webview)?;
    let mut last = state.1.lock().unwrap_or_else(|e| e.into_inner());
    if !newer_show(&mut last, epoch, seq) {
        return Ok(Vec::new());
    }
    let ids: Vec<(u32, u64, bool)> = state
        .lock()
        .tabs
        .iter()
        .map(|(id, t)| (*id, t.attempt, t.ready))
        .collect();
    let mut gone = Vec::new();
    for (id, attempt, ready) in ids {
        let Ok(wv) = tab_webview(&app, id) else {
            if ready {
                gone.push((id, attempt));
            }
            continue;
        };
        if Some(id) == tab {
            if let Some(b) = bounds {
                let _ = wv.set_position(LogicalPosition::new(b.x, b.y));
                let _ = wv.set_size(LogicalSize::new(b.width, b.height));
            }
            let _ = wv.show();
        } else {
            let _ = wv.hide();
        }
    }
    Ok(drop_lost(&mut state.lock(), &gone))
}

#[tauri::command]
pub fn browser_set_zoom(
    app: AppHandle,
    webview: Webview,
    tab: u32,
    factor: f64,
) -> Result<(), String> {
    ensure_main(&webview)?;
    tab_webview(&app, tab)?
        .set_zoom(factor.clamp(0.25, 3.0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_configure(
    webview: Webview,
    state: State<'_, BrowserState>,
    config: Config,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let user = config
        .rules
        .into_iter()
        .filter_map(|r| match r.kind.as_str() {
            "domain" => Some(Rule::Domain(r.value.to_ascii_lowercase())),
            "address" => Some(Rule::Address(r.value.to_ascii_lowercase())),
            _ => None,
        })
        .collect();
    let mut g = state.lock();
    g.warn_http = config.warn_http;
    g.blocker = Blocker {
        enabled: config.blocker_enabled,
        user,
        paused_hosts: config
            .paused_hosts
            .into_iter()
            .map(|h| h.to_ascii_lowercase())
            .collect(),
    };
    Ok(())
}

/// Closes every tab and deletes cookies, cache and site data of the browser profile (not of Nemo).
#[tauri::command(async)]
pub fn browser_clear_data(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let ids: Vec<u32> = state.lock().tabs.keys().copied().collect();
    for id in &ids {
        if let Ok(wv) = tab_webview(&app, *id) {
            let _ = wv.clear_all_browsing_data();
        }
    }
    for id in ids {
        if let Ok(wv) = tab_webview(&app, id) {
            let _ = wv.close();
        }
    }
    state.lock().tabs.clear();
    // Best effort: files may stay locked until the last tab process ends; the data was cleared above.
    if let Some(dir) = profile_dir(&app) {
        let _ = std::fs::remove_dir_all(dir);
    }
    Ok(())
}

/// Called for every request a tab makes (Windows hook): `true` = stop it. Third-party hosts that were
/// not stopped are reported once as `Seen`, so the page can offer "Blocken" for them.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn decide_request(app: &AppHandle, tab: u32, url: &Url) -> bool {
    let state = app.state::<BrowserState>();
    let (block, new_host) = {
        let mut g = state.lock();
        let page = g.tabs.get(&tab).and_then(|t| t.page.clone());
        let block = g.blocker.blocks(url, page.as_ref());
        let host = url.host_str().map(str::to_ascii_lowercase);
        let third = match (&host, page.as_ref().and_then(|p| p.host_str())) {
            (Some(h), Some(p)) => h != &p.to_ascii_lowercase(),
            _ => false,
        };
        let new_host = if !block && third && matches!(url.scheme(), "http" | "https") {
            host.filter(|h| {
                g.tabs
                    .get_mut(&tab)
                    .is_some_and(|t| t.seen.insert(h.clone()))
            })
        } else {
            None
        };
        (block, new_host)
    };
    if block {
        state.emit(
            tab,
            Event::Blocked {
                tab,
                host: url.host_str().unwrap_or_default().to_string(),
            },
        );
    } else if let Some(host) = new_host {
        state.emit(tab, Event::Seen { tab, host });
    }
    block
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inner_with(tabs: &[(u32, u64, bool)]) -> Inner {
        let mut inner = Inner {
            warn_http: true,
            blocker: Blocker::new(true),
            tabs: HashMap::new(),
            attempts: 0,
        };
        for &(id, attempt, ready) in tabs {
            inner.tabs.insert(
                id,
                Tab {
                    events: Channel::new(|_| Ok(())),
                    history: Vec::new(),
                    pos: 0,
                    by_history: false,
                    allowed_http: HashSet::new(),
                    page: None,
                    seen: HashSet::new(),
                    attempt,
                    ready,
                },
            );
        }
        inner
    }

    #[test]
    fn an_older_show_never_overrides_a_newer_one() {
        let mut last = (0, 0);
        assert!(newer_show(&mut last, 7, 2));
        assert!(!newer_show(&mut last, 7, 1), "overtaken call");
        assert!(!newer_show(&mut last, 7, 2), "same call twice");
        assert!(newer_show(&mut last, 7, 3));
        assert_eq!(last, (7, 3));
    }

    #[test]
    fn a_reloaded_page_counts_from_one_again_and_is_heard() {
        let mut last = (0, 0);
        for seq in 1..=40 {
            assert!(newer_show(&mut last, 7, seq));
        }
        // The main window reloaded: a new page life, its first call is number 1.
        assert!(newer_show(&mut last, 8, 1), "first show after a reload");
        assert!(!newer_show(&mut last, 8, 1), "same call twice");
        assert!(newer_show(&mut last, 8, 2));
        assert_eq!(last, (8, 2));
    }

    #[test]
    fn only_a_created_tab_of_the_same_attempt_counts_as_lost() {
        // 1: created, webview gone → lost. 2: still being created. 3: reopened meanwhile (attempt 9).
        let mut inner = inner_with(&[(1, 1, true), (2, 2, false), (3, 9, true)]);
        // 4 was closed meanwhile (no entry any more).
        let lost = drop_lost(&mut inner, &[(1, 1), (2, 2), (3, 3), (4, 4)]);
        assert_eq!(lost, [1]);
        let mut left: Vec<u32> = inner.tabs.keys().copied().collect();
        left.sort_unstable();
        assert_eq!(left, [2, 3]);
        // Reported once: the entry is forgotten.
        assert!(drop_lost(&mut inner, &[(1, 1)]).is_empty());
    }

    #[test]
    fn a_tab_is_ready_only_for_the_call_that_created_it() {
        let mut inner = inner_with(&[(1, 5, false)]);
        assert!(!mark_ready(&mut inner, 1, 4), "an older open call");
        assert!(!mark_ready(&mut inner, 2, 5), "closed meanwhile");
        assert!(!inner.tabs[&1].ready);
        assert!(mark_ready(&mut inner, 1, 5));
        assert!(inner.tabs[&1].ready);
    }
}
