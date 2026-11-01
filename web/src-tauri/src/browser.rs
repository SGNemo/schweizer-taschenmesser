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
}

struct Inner {
    warn_http: bool,
    blocker: Blocker,
    tabs: HashMap<u32, Tab>,
}

pub struct BrowserState(Mutex<Inner>);

impl Default for BrowserState {
    fn default() -> Self {
        BrowserState(Mutex::new(Inner {
            warn_http: true,
            blocker: Blocker::new(true),
            tabs: HashMap::new(),
        }))
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

#[tauri::command]
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
    state.lock().tabs.insert(
        tab,
        Tab {
            events: events.clone(),
            history: Vec::new(),
            pos: 0,
            by_history: false,
            allowed_http: allowed,
            page: None,
            seen: HashSet::new(),
        },
    );
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
    match created {
        Ok(wv) => {
            #[cfg(windows)]
            crate::browser_win::hook(&app, &wv, tab);
            if (options.zoom - 1.0).abs() > f64::EPSILON {
                let _ = wv.set_zoom(options.zoom);
            }
            Ok(())
        }
        Err(e) => {
            state.lock().tabs.remove(&tab);
            Err(e)
        }
    }
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

#[tauri::command]
pub fn browser_close(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: u32,
) -> Result<(), String> {
    ensure_main(&webview)?;
    state.lock().tabs.remove(&tab);
    if let Ok(wv) = tab_webview(&app, tab) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn browser_show(
    app: AppHandle,
    webview: Webview,
    state: State<'_, BrowserState>,
    tab: Option<u32>,
    bounds: Option<Bounds>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let ids: Vec<u32> = state.lock().tabs.keys().copied().collect();
    for id in ids {
        let Ok(wv) = tab_webview(&app, id) else {
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
    Ok(())
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
#[tauri::command]
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
