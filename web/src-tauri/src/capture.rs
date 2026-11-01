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
}

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
    tray: Mutex<Option<TrayItems>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    capture: String,
    open: String,
    quit: String,
    tooltip: String,
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

/// The whole tray menu: the "Heute" block (only when it has lines), then capture/open/quit as
/// before. The three fixed items are reused, so their translated labels stay.
fn tray_menu(app: &AppHandle, items: &TrayItems, today: &TrayToday) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    let lines = tray_today_lines(today);
    if !lines.is_empty() {
        let heading = MenuItem::with_id(
            app,
            "today-heading",
            tray_text(&today.heading),
            false,
            None::<&str>,
        )?;
        menu.append(&heading)?;
        for (index, label) in &lines {
            let id = TRAY_TODAY_IDS[*index];
            menu.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
        }
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        menu.append(&MenuItem::with_id(
            app,
            TRAY_NOW,
            tray_text(&today.now),
            true,
            None::<&str>,
        )?)?;
        menu.append(&MenuItem::with_id(
            app,
            TRAY_TIMER,
            tray_text(&today.timer),
            true,
            None::<&str>,
        )?)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&items.capture)?;
    menu.append(&items.open)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&items.quit)?;
    Ok(menu)
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
    };
    // No "Heute" block until the web app sends one.
    let menu = tray_menu(app, &items, &TrayToday::default())?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "capture" => show_capture(app),
            "open" => show_main(app),
            "quit" => app.exit(0),
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
        *slot = Some(items);
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
    let (title, text, quit, cancel) = crate::texts::quit_dialog(crate::webview2::system_lang());
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
#[tauri::command]
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
    if let Ok(items) = state.tray.lock() {
        if let Some(items) = items.as_ref() {
            let _ = items.capture.set_text(&labels.capture);
            let _ = items.open.set_text(&labels.open);
            let _ = items.quit.set_text(&labels.quit);
        }
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(labels.tooltip));
    }
}

/// Replaces the tray's "Heute" block (rebuilds the menu; no polling, nothing stored but the labels
/// inside the menu). No items = the block is hidden and the menu is the one from before.
#[tauri::command]
pub fn desktop_set_tray_today(app: AppHandle, state: State<'_, CaptureState>, today: TrayToday) {
    let Ok(items) = state.tray.lock() else {
        return;
    };
    let Some(items) = items.as_ref() else {
        return;
    };
    if let (Ok(menu), Some(tray)) = (tray_menu(&app, items, &today), app.tray_by_id(TRAY_ID)) {
        let _ = tray.set_menu(Some(menu));
    }
}

#[tauri::command]
pub fn desktop_set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
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
#[tauri::command]
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
#[tauri::command]
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
