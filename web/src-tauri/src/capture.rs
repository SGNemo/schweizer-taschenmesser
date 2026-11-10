//! Quick capture shell: a small always-on-top input window that is created hidden at startup (so
//! it opens instantly), a global hotkey that toggles it, a tray icon with a menu (with an optional
//! "Heute" block the web app fills), "close to tray", and "start with Windows".
//!
//! Everything here is plumbing. What is typed, parsed and saved lives in the TypeScript app
//! (`web/src/quickCapture`); the capture window loads `capture.html`, a second entry of the same
//! frontend that writes through the module adapters. Hotkey and autostart are handled in Rust
//! (not via the plugins' JavaScript APIs) so that no window needs plugin permissions for them.

use std::error::Error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent, Wry,
};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_clipboard_manager::ClipboardExt as _;
use tauri_plugin_dialog::{DialogExt as _, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_global_shortcut::{GlobalShortcutExt as _, Shortcut, ShortcutState};

pub const AUTOSTART_FLAG: &str = "--autostart";
const MAIN: &str = "main";
const CAPTURE: &str = "capture";
const TRAY_ID: &str = "main";
/// A blur right after `show` is the window manager settling focus, not the user leaving.
const BLUR_GRACE: Duration = Duration::from_millis(400);
/// Never hand more than this to the web view when pre-filling from the clipboard.
const CLIPBOARD_MAX_CHARS: usize = 1000;

/// Menu texts; the web app replaces them from `strings.ts` right after start (German only).
const DEFAULT_LABELS: (&str, &str, &str, &str) = ("Erfassen", "App öffnen", "Beenden", "Nemo");

struct TrayItems {
    capture: MenuItem<Wry>,
    open: MenuItem<Wry>,
    quit: MenuItem<Wry>,
    /// "Fernsteuerung beenden"; its text is native (`texts.rs`), the page never sets it.
    remote_end: MenuItem<Wry>,
    /// Not clickable, under it: the device stays paused afterwards.
    remote_hint: MenuItem<Wry>,
}

/// Everything the tray shows. The page sends labels, tooltip and the "Heute" block; who controls
/// this PC comes from Rust (`remote.rs`) only, and every rebuild reads it from here – so no call
/// from the page can make the tray look calm while a device controls the PC.
struct Tray {
    items: TrayItems,
    /// The tooltip the page asked for (the plain one).
    tooltip: String,
    today: TrayToday,
    /// A device controls this PC right now: its name (plain text, may be empty).
    remote: Option<String>,
}

/// The language of the shell's own texts (tray entry, tooltip, confirmation dialogs): the app's,
/// so the tray is not half German and half English; the system's before the page said it.
pub fn native_lang(app: &AppHandle) -> crate::texts::Lang {
    lang_of(&app.state::<CaptureState>())
}

/// Kept apart from the tray state: commands and the tray thread read it from any thread, while
/// the tray state itself is only ever locked on the main thread.
fn lang_of(state: &CaptureState) -> crate::texts::Lang {
    state
        .lang
        .lock()
        .ok()
        .and_then(|lang| *lang)
        .unwrap_or_else(crate::webview2::system_lang)
}

const TRAY_REMOTE_END: &str = "remote-end";

/// Lines of the tray's "Heute" block; the web app never sends more (`traySnapshot.ts`).
const TRAY_TODAY_MAX: usize = 5;
/// Longest label shown in the tray (the web app already cuts titles to 40 characters).
const TRAY_LABEL_MAX_CHARS: usize = 60;
/// Menu ids of the "Heute" block, in order; a click only sends the id back to the page.
const TRAY_TODAY_IDS: [&str; TRAY_TODAY_MAX] =
    ["today-0", "today-1", "today-2", "today-3", "today-4"];
const TRAY_NOW: &str = "tray-now";
const TRAY_TIMER: &str = "tray-timer";

#[derive(Default)]
pub struct CaptureState {
    close_to_tray: AtomicBool,
    /// The quit question is open; a second close click must not stack another one.
    quit_prompt_open: AtomicBool,
    hotkey: Mutex<Option<Shortcut>>,
    /// Second global key: opens the vault search (the web app decides whether the vault is unlocked).
    vault_hotkey: Mutex<Option<Shortcut>>,
    /// Third global key: starts/stops voice input in the main window (off until the user sets one).
    voice_hotkey: Mutex<Option<Shortcut>>,
    shown_at: Mutex<Option<Instant>>,
    tray: Mutex<Option<Tray>>,
    /// The app language once the page said it (`desktop_set_tray_labels`); the system language
    /// until then.
    lang: Mutex<Option<crate::texts::Lang>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    capture: String,
    open: String,
    quit: String,
    tooltip: String,
    /// The app language (`de`, `en`): the shell's own tray and dialog texts follow it.
    #[serde(default)]
    lang: Option<String>,
}

/// The tray's "Heute" block, all texts from the web app (Rust knows no strings). Only these labels
/// live here, inside the native menu; where a line leads stays in the web app. Never logged.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrayToday {
    #[serde(default)]
    heading: String,
    #[serde(default)]
    items: Vec<String>,
    #[serde(default)]
    now: String,
    #[serde(default)]
    timer: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopInfo {
    /// A `data/` folder next to the executable: the app runs from a (possibly removable) folder.
    portable: bool,
}

/// Creates the hidden capture window and the tray icon; called from the builder's setup hook.
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn Error>> {
    let handle = app.handle();
    create_capture_window(handle)?;
    build_tray(handle)?;
    // Started by "start with Windows": stay in the tray instead of opening the main window.
    if std::env::args().any(|a| a == AUTOSTART_FLAG) {
        if let Some(main) = handle.get_webview_window(MAIN) {
            let _ = main.hide();
        }
    }
    Ok(())
}

fn create_capture_window(app: &AppHandle) -> tauri::Result<()> {
    let builder = WebviewWindowBuilder::new(app, CAPTURE, WebviewUrl::App("capture.html".into()))
        .title("Schnell erfassen")
        .inner_size(560.0, 320.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .center();
    // Same WebView2 profile as the main window, otherwise the two would not share IndexedDB.
    #[cfg(windows)]
    let builder = match std::env::current_exe()
        .ok()
        .and_then(|exe| crate::portable::data_dir(&exe, &app.config().identifier))
    {
        Some(dir) => builder.data_directory(dir),
        None => builder,
    };
    builder.build()?;
    Ok(())
}

/// One line of plain text for a native menu: no line breaks or control characters, capped, and
/// `&` doubled (a single one would turn the next letter into a keyboard mnemonic on Windows).
fn tray_text(label: &str) -> String {
    let flat: String = label
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let words: Vec<&str> = flat.split_whitespace().collect();
    let joined = words.join(" ");
    let capped: String = if joined.chars().count() > TRAY_LABEL_MAX_CHARS {
        let mut cut: String = joined.chars().take(TRAY_LABEL_MAX_CHARS - 1).collect();
        cut.push('…');
        cut
    } else {
        joined
    };
    capped.replace('&', "&&")
}

/// The page script for a click on a tray item of the "Heute" block. Constant per id: only the
/// fixed id crosses, never a label or a route.
fn tray_item_script(id: &str) -> Option<&'static str> {
    Some(match id {
        "today-0" => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'today-0'}))",
        "today-1" => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'today-1'}))",
        "today-2" => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'today-2'}))",
        "today-3" => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'today-3'}))",
        "today-4" => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'today-4'}))",
        TRAY_NOW => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'now'}))",
        TRAY_TIMER => "window.dispatchEvent(new CustomEvent('tm-tray-item',{detail:'timer'}))",
        _ => return None,
    })
}

/// The "Heute" labels that will be shown, with their position in what the page sent (a click
/// reports that position, so a dropped empty label never shifts the others): at most five.
fn tray_today_lines(today: &TrayToday) -> Vec<(usize, String)> {
    today
        .items
        .iter()
        .take(TRAY_TODAY_MAX)
        .map(|l| tray_text(l))
        .enumerate()
        .filter(|(_, l)| !l.is_empty())
        .collect()
}

/// One row of the tray menu, in order.
#[derive(Debug, Clone, PartialEq, Eq)]
enum TrayRow {
    RemoteEnd,
    RemoteHint,
    Separator,
    Heading(String),
    Today(usize, String),
    Now(String),
    Timer(String),
    Capture,
    Open,
    Quit,
}

/// The whole tray menu as rows: "Fernsteuerung beenden" first while a device controls this PC,
/// then the "Heute" block (only when it has lines), then capture/open/quit as before.
fn tray_rows(today: &TrayToday, remote: bool) -> Vec<TrayRow> {
    let mut rows = Vec::new();
    if remote {
        rows.push(TrayRow::RemoteEnd);
        rows.push(TrayRow::RemoteHint);
        rows.push(TrayRow::Separator);
    }
    let lines = tray_today_lines(today);
    if !lines.is_empty() {
        rows.push(TrayRow::Heading(tray_text(&today.heading)));
        rows.extend(lines.into_iter().map(|(i, l)| TrayRow::Today(i, l)));
        rows.push(TrayRow::Separator);
        rows.push(TrayRow::Now(tray_text(&today.now)));
        rows.push(TrayRow::Timer(tray_text(&today.timer)));
        rows.push(TrayRow::Separator);
    }
    rows.extend([
        TrayRow::Capture,
        TrayRow::Open,
        TrayRow::Separator,
        TrayRow::Quit,
    ]);
    rows
}

/// Builds the menu from the rows. The fixed items are reused, so their translated labels stay.
fn tray_menu(app: &AppHandle, tray: &Tray) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    let item = |id: &str, label: &str, enabled: bool| {
        MenuItem::with_id(app, id, label, enabled, None::<&str>)
    };
    for row in tray_rows(&tray.today, tray.remote.is_some()) {
        match row {
            TrayRow::RemoteEnd => menu.append(&tray.items.remote_end)?,
            TrayRow::RemoteHint => menu.append(&tray.items.remote_hint)?,
            TrayRow::Separator => menu.append(&PredefinedMenuItem::separator(app)?)?,
            TrayRow::Heading(label) => menu.append(&item("today-heading", &label, false)?)?,
            TrayRow::Today(index, label) => {
                menu.append(&item(TRAY_TODAY_IDS[index], &label, true)?)?
            }
            TrayRow::Now(label) => menu.append(&item(TRAY_NOW, &label, true)?)?,
            TrayRow::Timer(label) => menu.append(&item(TRAY_TIMER, &label, true)?)?,
            TrayRow::Capture => menu.append(&tray.items.capture)?,
            TrayRow::Open => menu.append(&tray.items.open)?,
            TrayRow::Quit => menu.append(&tray.items.quit)?,
        }
    }
    Ok(menu)
}

/// The tooltip that is shown: the page's one, with who controls this PC behind it.
fn tray_tooltip(tray: &Tray, lang: crate::texts::Lang) -> String {
    match &tray.remote {
        Some(name) => crate::texts::remote_tooltip(lang, &tray.tooltip, name),
        None => tray.tooltip.clone(),
    }
}

/// Edge length of the badge square, as a share of the icon's shorter side.
const BADGE_SHARE: u32 = 2;

/// The tray icon while a device controls this PC: the app icon with a filled dot in the lower
/// right corner (white ring, orange centre), so the state is visible with the window closed.
fn badged_icon(rgba: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut out = rgba.to_vec();
    if width == 0 || height == 0 || out.len() != (width as usize) * (height as usize) * 4 {
        return out;
    }
    let size = (width.min(height) / BADGE_SHARE).max(1) as i64;
    let radius = size as f32 / 2.0;
    let (cx, cy) = (width as f32 - radius, height as f32 - radius);
    for y in (height as i64 - size).max(0)..height as i64 {
        for x in (width as i64 - size).max(0)..width as i64 {
            let (dx, dy) = (x as f32 + 0.5 - cx, y as f32 + 0.5 - cy);
            let dist = (dx * dx + dy * dy).sqrt();
            let colour = if dist > radius {
                continue;
            } else if dist > radius * 0.72 {
                [255, 255, 255, 255]
            } else {
                [230, 120, 20, 255]
            };
            let at = ((y as usize) * (width as usize) + x as usize) * 4;
            out[at..at + 4].copy_from_slice(&colour);
        }
    }
    out
}

/// Applies the stored tray state: menu and tooltip. The one place that does it, for the page's
/// calls and for Rust's.
fn apply_tray(app: &AppHandle, tray: &Tray) {
    let Some(icon) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    if let Ok(menu) = tray_menu(app, tray) {
        let _ = icon.set_menu(Some(menu));
    }
    let lang = lang_of(&app.state::<CaptureState>());
    let _ = icon.set_tooltip(Some(tray_tooltip(tray, lang)));
}

/// The icon follows who controls; only touched when that changes.
fn apply_tray_icon(app: &AppHandle, tray: &Tray) {
    let Some(icon) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    if let Some(base) = app.default_window_icon() {
        let image = if tray.remote.is_some() {
            tauri::image::Image::new_owned(
                badged_icon(base.rgba(), base.width(), base.height()),
                base.width(),
                base.height(),
            )
        } else {
            base.clone()
        };
        let _ = icon.set_icon(Some(image));
    }
}

/// Who controls this PC right now (`None`: nobody). Called from Rust only (`remote.rs`), from any
/// thread: the work is handed to the main thread, where the page's tray commands run too – so the
/// tray state is only ever locked there, and no thread waits for the main thread while holding it.
pub fn set_remote_tray(app: &AppHandle, controller: Option<String>) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let state = handle.state::<CaptureState>();
        let Ok(mut slot) = state.tray.lock() else {
            return;
        };
        let Some(tray) = slot.as_mut() else {
            return;
        };
        if tray.remote == controller {
            return;
        }
        tray.remote = controller;
        apply_tray(&handle, tray);
        apply_tray_icon(&handle, tray);
    });
}

/// A click in the "Heute" block: the main window comes forward (the existing open path) and the
/// page gets the item id; it navigates or starts the timer itself.
fn open_tray_item(app: &AppHandle, id: &str) {
    let Some(script) = tray_item_script(id) else {
        return;
    };
    show_main(app);
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.eval(script);
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let (capture, open, quit, tooltip) = DEFAULT_LABELS;
    let items = TrayItems {
        capture: MenuItem::with_id(app, "capture", capture, true, None::<&str>)?,
        open: MenuItem::with_id(app, "open", open, true, None::<&str>)?,
        quit: MenuItem::with_id(app, "quit", quit, true, None::<&str>)?,
        remote_end: MenuItem::with_id(
            app,
            TRAY_REMOTE_END,
            crate::texts::remote_end_label(crate::webview2::system_lang()),
            true,
            None::<&str>,
        )?,
        remote_hint: MenuItem::with_id(
            app,
            "remote-hint",
            crate::texts::remote_end_hint(crate::webview2::system_lang()),
            false,
            None::<&str>,
        )?,
    };
    // No "Heute" block until the web app sends one, and nobody controls this PC yet.
    let state = Tray {
        items,
        tooltip: tooltip.to_owned(),
        today: TrayToday::default(),
        remote: None,
    };
    let menu = tray_menu(app, &state)?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "capture" => show_capture(app),
            "open" => show_main(app),
            "quit" => app.exit(0),
            TRAY_REMOTE_END => crate::remote::end_from_tray(app),
            other => open_tray_item(app, other),
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    if let Ok(mut slot) = app.state::<CaptureState>().tray.lock() {
        *slot = Some(state);
    }
    Ok(())
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn show_capture(app: &AppHandle) {
    let Some(window) = app.get_webview_window(CAPTURE) else {
        return;
    };
    if let Ok(mut at) = app.state::<CaptureState>().shown_at.lock() {
        *at = Some(Instant::now());
    }
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    // Tells the page to reset and focus its input; a constant script, no data crosses here.
    let _ = window.eval("window.dispatchEvent(new Event('tm-capture-open'))");
}

fn hide_capture(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(CAPTURE) {
        let _ = window.hide();
    }
}

/// Brings the main window forward and tells the page to open the vault search. A constant script,
/// no data crosses here; the page only acts on it while the vault is unlocked.
fn open_vault_search(app: &AppHandle) {
    show_main(app);
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.eval("window.dispatchEvent(new Event('tm-vault-search'))");
    }
}

/// Brings the main window forward and tells the page to start or stop voice input. A constant
/// script, no data crosses here; the page only acts on it while voice input is switched on.
fn toggle_voice(app: &AppHandle) {
    show_main(app);
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.eval("window.dispatchEvent(new Event('tm-voice-toggle'))");
    }
}

fn toggle_capture(app: &AppHandle) {
    let open = app
        .get_webview_window(CAPTURE)
        .map(|w| w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false))
        .unwrap_or(false);
    if open {
        hide_capture(app);
    } else {
        show_capture(app);
    }
}

/// Builder-level window events: "close to tray" for the main window, dismiss-on-blur for the
/// capture window.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    let app = window.app_handle();
    match (window.label(), event) {
        (MAIN, WindowEvent::CloseRequested { api, .. }) => {
            if app
                .state::<CaptureState>()
                .close_to_tray
                .load(Ordering::Relaxed)
            {
                api.prevent_close();
                let _ = window.hide();
            } else {
                // The hidden capture window and the tray icon would keep the process alive with
                // no main window to show again, so closing the main window has to end the app.
                api.prevent_close();
                ask_quit(app);
            }
        }
        (CAPTURE, WindowEvent::CloseRequested { api, .. }) => {
            api.prevent_close();
            let _ = window.hide();
        }
        (CAPTURE, WindowEvent::Focused(false)) => {
            let settled = app
                .state::<CaptureState>()
                .shown_at
                .lock()
                .ok()
                .and_then(|at| *at)
                .map_or(true, |at| at.elapsed() > BLUR_GRACE);
            if settled {
                let _ = window.hide();
            }
        }
        _ => {}
    }
}

/// Asks whether to quit and, on yes, ends the whole process (not just the main window).
fn ask_quit(app: &AppHandle) {
    let state = app.state::<CaptureState>();
    if state.quit_prompt_open.swap(true, Ordering::AcqRel) {
        return;
    }
    let (title, text, quit, cancel) = crate::texts::quit_dialog(native_lang(app));
    let handle = app.clone();
    app.dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            quit.into(),
            cancel.into(),
        ))
        .show(move |confirmed| {
            handle
                .state::<CaptureState>()
                .quit_prompt_open
                .store(false, Ordering::Release);
            if confirmed {
                handle.exit(0);
            }
        });
}

/// Maps the message of a failed registration to a code the UI turns into German text.
fn hotkey_error_code(message: &str) -> &'static str {
    if message.to_lowercase().contains("already registered") {
        "taken"
    } else {
        "failed"
    }
}

/// Registers `accelerator` (e.g. `Ctrl+Shift+Space`) as the capture hotkey, or removes it for
/// `None`. The new key is registered before the old one is released, so a rejected change keeps
/// the working hotkey. Errors: `invalid` (cannot parse), `taken` (another program owns it),
/// `failed`.
fn set_hotkey(
    app: &AppHandle,
    slot: &Mutex<Option<Shortcut>>,
    accelerator: Option<&str>,
    action: fn(&AppHandle),
) -> Result<(), &'static str> {
    let next = match accelerator.map(str::trim).filter(|a| !a.is_empty()) {
        Some(a) => Some(a.parse::<Shortcut>().map_err(|_| "invalid")?),
        None => None,
    };
    let mut current = slot.lock().map_err(|_| "failed")?;
    let shortcuts = app.global_shortcut();
    if let Some(n) = next {
        if *current != Some(n) {
            shortcuts
                .on_shortcut(n, move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        action(app);
                    }
                })
                .map_err(|e| match e {
                    tauri_plugin_global_shortcut::Error::GlobalHotkey(m) => hotkey_error_code(&m),
                    _ => "failed",
                })?;
        }
    }
    if let Some(old) = current.take() {
        if Some(old) != next {
            let _ = shortcuts.unregister(old);
        }
    }
    *current = next;
    Ok(())
}

#[tauri::command]
pub fn capture_set_hotkey(
    app: AppHandle,
    state: State<'_, CaptureState>,
    accelerator: Option<String>,
) -> Result<(), String> {
    set_hotkey(&app, &state.hotkey, accelerator.as_deref(), toggle_capture).map_err(str::to_owned)
}

/// Same contract as `capture_set_hotkey`, for the vault search key (off until the user sets one).
#[tauri::command]
pub fn desktop_set_vault_hotkey(
    app: AppHandle,
    state: State<'_, CaptureState>,
    accelerator: Option<String>,
) -> Result<(), String> {
    set_hotkey(
        &app,
        &state.vault_hotkey,
        accelerator.as_deref(),
        open_vault_search,
    )
    .map_err(str::to_owned)
}

/// Same contract as `capture_set_hotkey`, for the voice input key (off until the user sets one).
#[tauri::command]
pub fn desktop_set_voice_hotkey(
    app: AppHandle,
    state: State<'_, CaptureState>,
    accelerator: Option<String>,
) -> Result<(), String> {
    set_hotkey(
        &app,
        &state.voice_hotkey,
        accelerator.as_deref(),
        toggle_voice,
    )
    .map_err(str::to_owned)
}

#[tauri::command]
pub fn capture_hide(app: AppHandle) {
    hide_capture(&app);
}

/// Only called by the capture window when the user switched the clipboard option on.
#[tauri::command(async)]
pub fn capture_read_clipboard(app: AppHandle) -> Option<String> {
    let text = app.clipboard().read_text().ok()?;
    let text = text.trim();
    (!text.is_empty()).then(|| text.chars().take(CLIPBOARD_MAX_CHARS).collect())
}

#[tauri::command]
pub fn desktop_set_close_to_tray(state: State<'_, CaptureState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn desktop_set_tray_labels(app: AppHandle, state: State<'_, CaptureState>, labels: TrayLabels) {
    let Ok(mut slot) = state.tray.lock() else {
        return;
    };
    let Some(tray) = slot.as_mut() else {
        return;
    };
    let _ = tray.items.capture.set_text(&labels.capture);
    let _ = tray.items.open.set_text(&labels.open);
    let _ = tray.items.quit.set_text(&labels.quit);
    tray.tooltip = labels.tooltip;
    // The shell's own two rows follow the app language (a fixed choice of texts, never the
    // page's words).
    if let Some(lang) = labels
        .lang
        .as_deref()
        .and_then(crate::texts::Lang::from_app)
    {
        if let Ok(mut stored) = state.lang.lock() {
            *stored = Some(lang);
        }
        let _ = tray
            .items
            .remote_end
            .set_text(crate::texts::remote_end_label(lang));
        let _ = tray
            .items
            .remote_hint
            .set_text(crate::texts::remote_end_hint(lang));
    }
    apply_tray(&app, tray);
}

/// Replaces the tray's "Heute" block (rebuilds the menu; no polling). The labels are kept in memory
/// only, so a rebuild from Rust (remote control) shows the same block; never written or logged. No
/// items = the block is hidden and the menu is the one from before.
#[tauri::command]
pub fn desktop_set_tray_today(app: AppHandle, state: State<'_, CaptureState>, today: TrayToday) {
    let Ok(mut slot) = state.tray.lock() else {
        return;
    };
    let Some(tray) = slot.as_mut() else {
        return;
    };
    tray.today = today;
    apply_tray(&app, tray);
}

#[tauri::command(async)]
pub fn desktop_set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn desktop_autostart_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn desktop_info(app: AppHandle) -> DesktopInfo {
    DesktopInfo {
        portable: std::env::current_exe()
            .ok()
            .and_then(|exe| crate::portable::data_dir(&exe, &app.config().identifier))
            .is_some(),
    }
}

/// The folder that holds the app's data: `data/` next to a portable executable, otherwise the
/// user's local app data folder (WebView profile and the app's private files).
pub(crate) fn app_data_folder(app: &AppHandle) -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| crate::portable::data_dir(&exe, &app.config().identifier))
        .or_else(|| app.path().app_local_data_dir().ok())
}

/// Path of the data folder, shown in "Über Nemo". Takes no argument.
#[tauri::command]
pub fn desktop_data_dir(app: AppHandle) -> Option<String> {
    app_data_folder(&app).map(|dir| dir.display().to_string())
}

/// The panic lines of earlier runs (`logs/panic.log`), handed over once and then removed so they are
/// reported a single time. Takes no argument.
#[tauri::command(async)]
pub fn desktop_take_panic_log(app: AppHandle) -> Option<String> {
    app_data_folder(&app).and_then(|dir| crate::panic_log::take(&dir.join("logs")))
}

pub const SAFE_MODE_FLAG: &str = "--safe-mode";
pub const SAFE_MODE_ENV: &str = "NEMO_SAFE_MODE";

/// Safe mode: start with every module switched off (nothing is changed on disk). Asked by the
/// command line flag `--safe-mode` or the environment variable `NEMO_SAFE_MODE=1`.
pub fn safe_mode_requested<I: IntoIterator<Item = String>>(args: I, env: Option<&str>) -> bool {
    args.into_iter().any(|a| a == SAFE_MODE_FLAG) || matches!(env, Some("1") | Some("true"))
}

/// Whether this launch asked for safe mode. Takes no argument and changes nothing.
#[tauri::command]
pub fn desktop_safe_mode() -> bool {
    safe_mode_requested(
        std::env::args(),
        std::env::var(SAFE_MODE_ENV).ok().as_deref(),
    )
}

#[cfg(test)]
mod safe_mode_tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn flag_or_env_turns_it_on() {
        assert!(safe_mode_requested(args(&["nemo", "--safe-mode"]), None));
        assert!(safe_mode_requested(args(&["nemo"]), Some("1")));
        assert!(safe_mode_requested(args(&["nemo"]), Some("true")));
    }

    #[test]
    fn default_is_off() {
        assert!(!safe_mode_requested(args(&["nemo", "--autostart"]), None));
        assert!(!safe_mode_requested(args(&["nemo"]), Some("0")));
        assert!(!safe_mode_requested(args(&["nemo"]), Some("")));
    }
}

/// Opens exactly that folder in the file manager. Takes no path, so the webview cannot make the
/// app open anything else.
#[tauri::command(async)]
pub fn desktop_open_data_dir(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt as _;
    let dir = app_data_folder(&app)
        .filter(|dir| dir.is_dir())
        .ok_or_else(|| "no-data-dir".to_owned())?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|_| "failed".to_owned())
}

#[tauri::command]
pub fn desktop_show_main(app: AppHandle) {
    show_main(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_labels_are_one_plain_capped_line() {
        assert_eq!(tray_text("  15:00 · Zahnarzt\n "), "15:00 · Zahnarzt");
        assert_eq!(tray_text("Max & Moritz"), "Max && Moritz");
        assert_eq!(tray_text("a\tb\u{0007}c"), "a b c");
        let long = "x".repeat(200);
        let cut = tray_text(&long);
        assert_eq!(cut.chars().count(), TRAY_LABEL_MAX_CHARS);
        assert!(cut.ends_with('…'));
    }

    #[test]
    fn tray_today_shows_at_most_five_non_empty_lines() {
        let today = TrayToday {
            items: (0..8)
                .map(|i| format!("Ding {i}"))
                .chain([" ".into()])
                .collect(),
            ..Default::default()
        };
        assert_eq!(tray_today_lines(&today).len(), TRAY_TODAY_MAX);
        assert!(tray_today_lines(&TrayToday::default()).is_empty());
        let blank = TrayToday {
            items: vec!["".into(), " \n".into()],
            ..Default::default()
        };
        assert!(tray_today_lines(&blank).is_empty());
        let gap = TrayToday {
            items: vec!["A".into(), "\n".into(), "C".into()],
            ..Default::default()
        };
        assert_eq!(
            tray_today_lines(&gap),
            vec![(0, "A".to_owned()), (2, "C".to_owned())]
        );
    }

    #[test]
    fn the_end_entry_leads_the_menu_whatever_the_page_sent() {
        let full = TrayToday {
            heading: "Heute".into(),
            items: vec!["a".into(), "b".into()],
            now: "Jetzt".into(),
            timer: "Timer".into(),
        };
        for today in [TrayToday::default(), full] {
            let rows = tray_rows(&today, true);
            assert_eq!(
                rows[..3],
                [TrayRow::RemoteEnd, TrayRow::RemoteHint, TrayRow::Separator]
            );
            // the rest is exactly the menu without a controller
            assert_eq!(rows[3..], tray_rows(&today, false)[..]);
            assert!(!tray_rows(&today, false).contains(&TrayRow::RemoteEnd));
        }
    }

    #[test]
    fn every_tray_update_goes_through_the_stored_state() {
        // Source check: the page's two tray commands and Rust's own update all end in
        // `apply_tray`, which reads the controller from the stored state; nothing else sets the
        // menu or the tooltip.
        // LF line ends: a Windows checkout has CRLF, and the patterns below span lines
        let src = include_str!("capture.rs").replace("\r\n", "\n");
        let code = src.split("#[cfg(test)]").next().unwrap();
        assert_eq!(code.matches(".set_menu(").count(), 1);
        assert_eq!(code.matches(".set_tooltip(").count(), 1);
        for command in ["fn desktop_set_tray_labels", "fn desktop_set_tray_today"] {
            let body = code.split(command).nth(1).unwrap();
            let body = &body[..body.find("\n}\n").unwrap()];
            assert!(body.contains("apply_tray(&app, tray)"), "{command}");
            assert!(
                !body.contains("tray.remote") && !body.contains("set_remote_tray"),
                "{command} touches the controller"
            );
            // the shell's own two rows only ever get the shell's own fixed texts, never the page's
            assert!(!body.contains("remote_end.set_text(&labels"), "{command}");
            assert!(!body.contains("remote_hint.set_text(&labels"), "{command}");
            let own = body.matches("crate::texts::remote_").count();
            let rows = body.matches(".remote_end").count() + body.matches(".remote_hint").count();
            assert_eq!(own, rows, "{command}: a remote row without a shell text");
        }
        // only Rust names the controller
        assert_eq!(code.matches("tray.remote = ").count(), 1);
    }

    #[test]
    fn the_badge_marks_the_lower_right_corner_only() {
        let (w, h) = (32u32, 32u32);
        let plain = vec![7u8; (w * h * 4) as usize];
        let marked = badged_icon(&plain, w, h);
        assert_eq!(marked.len(), plain.len());
        let pixel = |x: u32, y: u32| {
            let at = ((y * w + x) * 4) as usize;
            [marked[at], marked[at + 1], marked[at + 2], marked[at + 3]]
        };
        assert_eq!(pixel(0, 0), [7, 7, 7, 7]);
        assert_eq!(pixel(15, 15), [7, 7, 7, 7]);
        assert_eq!(pixel(24, 24), [230, 120, 20, 255]);
        // a buffer that does not match its size is left alone
        assert_eq!(badged_icon(&[1, 2, 3], 4, 4), vec![1, 2, 3]);
    }

    #[test]
    fn tray_clicks_send_only_fixed_ids() {
        for (i, id) in TRAY_TODAY_IDS.iter().enumerate() {
            let script = tray_item_script(id).unwrap();
            assert!(script.contains(&format!("'today-{i}'")));
        }
        assert!(tray_item_script(TRAY_NOW).unwrap().contains("'now'"));
        assert!(tray_item_script(TRAY_TIMER).unwrap().contains("'timer'"));
        for other in [
            "capture",
            "open",
            "quit",
            TRAY_REMOTE_END,
            "today-5",
            "today-heading",
            "x');alert(1);//",
        ] {
            assert!(tray_item_script(other).is_none(), "{other}");
        }
    }

    #[test]
    fn classifies_registration_failures() {
        assert_eq!(
            hotkey_error_code("HotKey { mods: CONTROL, key: Space } already registered"),
            "taken"
        );
        assert_eq!(hotkey_error_code("Failed to register hotkey"), "failed");
    }

    #[test]
    fn default_hotkey_parses() {
        assert!("Ctrl+Shift+Space".parse::<Shortcut>().is_ok());
        assert!("CommandOrControl+Shift+Space".parse::<Shortcut>().is_ok());
        assert!("Ctrl+Nonsense+".parse::<Shortcut>().is_err());
    }
}
