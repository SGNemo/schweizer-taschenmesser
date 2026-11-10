//! The few texts the native shell shows before (or outside) the web app: the OAuth result page in
//! the browser and the "WebView2 missing" dialog. The web app's catalogs are not reachable there, so
//! each text exists here in the active UI languages (German, English); the language comes from the
//! browser's `Accept-Language` header or from the operating system. Spanish, French and Brazilian
//! Portuguese are frozen (docs/i18n/FROZEN.md): their texts stay below but are never picked, so a
//! device in one of them gets English, like the web app.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lang {
    De,
    En,
    #[allow(dead_code)] // frozen (docs/i18n/FROZEN.md)
    Es,
    #[allow(dead_code)] // frozen
    Fr,
    #[allow(dead_code)] // frozen
    Pt,
}

impl Lang {
    /// BCP 47 tag for `<html lang>`.
    pub fn tag(self) -> &'static str {
        match self {
            Lang::De => "de",
            Lang::En => "en",
            Lang::Es => "es",
            Lang::Fr => "fr",
            Lang::Pt => "pt-BR",
        }
    }

    /// The app language the page reports (`de`, `en`, or a longer tag); anything else is `None`
    /// and the caller falls back to the system language.
    pub fn from_app(tag: &str) -> Option<Lang> {
        let primary = tag.split('-').next().unwrap_or("").to_ascii_lowercase();
        Lang::from_primary(&primary)
    }

    fn from_primary(code: &str) -> Option<Lang> {
        match code {
            "de" => Some(Lang::De),
            "en" => Some(Lang::En),
            // es, fr, pt are frozen: not matched, the fallback is English.
            _ => None,
        }
    }
}

/// First supported language of an `Accept-Language` value ("de-CH,de;q=0.9,en;q=0.8"), else English.
/// Quality values are respected; ties keep the header order.
pub fn from_accept_language(header: &str) -> Lang {
    let mut best: Option<(f32, usize, Lang)> = None;
    for (index, part) in header.split(',').enumerate() {
        let mut pieces = part.trim().split(';');
        let tag = pieces.next().unwrap_or("").trim().to_ascii_lowercase();
        let q = pieces
            .find_map(|p| {
                p.trim()
                    .strip_prefix("q=")
                    .and_then(|v| v.parse::<f32>().ok())
            })
            .unwrap_or(1.0);
        let primary = tag.split('-').next().unwrap_or("");
        if let Some(lang) = Lang::from_primary(primary) {
            let better = match best {
                None => true,
                Some((bq, bi, _)) => q > bq || (q == bq && index < bi),
            };
            if better && q > 0.0 {
                best = Some((q, index, lang));
            }
        }
    }
    best.map(|(_, _, l)| l).unwrap_or(Lang::En)
}

/// `Accept-Language` of a raw HTTP request (headers are case-insensitive).
pub fn accept_language_of(request: &str) -> Lang {
    request
        .lines()
        .skip(1)
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.trim()
                .eq_ignore_ascii_case("accept-language")
                .then(|| value.trim().to_string())
        })
        .map(|v| from_accept_language(&v))
        .unwrap_or(Lang::En)
}

/// Windows primary language id (low 10 bits of a LANGID) → language.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn from_windows_langid(langid: u16) -> Lang {
    match langid & 0x3ff {
        0x07 => Lang::De,
        // Spanish (0x0a), French (0x0c), Portuguese (0x16) are frozen: English.
        _ => Lang::En,
    }
}

/// OAuth result page: (finished, not finished).
pub fn oauth_page(lang: Lang) -> (&'static str, &'static str) {
    match lang {
        Lang::De => (
            "Die Anmeldung ist abgeschlossen. Du kannst dieses Fenster schließen und zu Nemo zurückkehren.",
            "Die Anmeldung wurde nicht abgeschlossen. Du kannst dieses Fenster schließen und es in Nemo erneut versuchen.",
        ),
        Lang::En => (
            "You're signed in. You can close this window and go back to Nemo.",
            "The sign-in was not completed. You can close this window and try again in Nemo.",
        ),
        Lang::Es => (
            "Has iniciado sesión. Puedes cerrar esta ventana y volver a Nemo.",
            "No se completó el inicio de sesión. Puedes cerrar esta ventana e intentarlo de nuevo en Nemo.",
        ),
        Lang::Fr => (
            "Vous êtes connecté. Vous pouvez fermer cette fenêtre et revenir à Nemo.",
            "La connexion n'a pas abouti. Vous pouvez fermer cette fenêtre et réessayer dans Nemo.",
        ),
        Lang::Pt => (
            "Você entrou. Pode fechar esta janela e voltar ao Nemo.",
            "O login não foi concluído. Você pode fechar esta janela e tentar de novo no Nemo.",
        ),
    }
}

/// "WebView2 missing" dialog: (title, text).
#[cfg_attr(not(windows), allow(dead_code))]
pub fn webview2_dialog(lang: Lang) -> (&'static str, &'static str) {
    match lang {
        Lang::De => (
            "Nemo – WebView2 fehlt",
            "Nemo braucht die Microsoft-Komponente „WebView2“, die auf diesem Computer nicht gefunden wurde.\n\nKlicke auf „OK“, um die Download-Seite zu öffnen. Installiere dort die „Evergreen Bootstrapper“-Version und starte Nemo danach erneut.",
        ),
        Lang::En => (
            "Nemo – WebView2 is missing",
            "Nemo needs the Microsoft component \"WebView2\", which was not found on this computer.\n\nClick \"OK\" to open the download page. Install the \"Evergreen Bootstrapper\" version there, then start Nemo again.",
        ),
        Lang::Es => (
            "Nemo – falta WebView2",
            "Nemo necesita el componente de Microsoft «WebView2», que no se encontró en este equipo.\n\nHaz clic en «Aceptar» para abrir la página de descarga. Instala allí la versión «Evergreen Bootstrapper» y vuelve a iniciar Nemo.",
        ),
        Lang::Fr => (
            "Nemo – WebView2 manquant",
            "Nemo a besoin du composant Microsoft « WebView2 », introuvable sur cet ordinateur.\n\nCliquez sur « OK » pour ouvrir la page de téléchargement. Installez-y la version « Evergreen Bootstrapper », puis relancez Nemo.",
        ),
        Lang::Pt => (
            "Nemo – falta o WebView2",
            "O Nemo precisa do componente da Microsoft \"WebView2\", que não foi encontrado neste computador.\n\nClique em \"OK\" para abrir a página de download. Instale lá a versão \"Evergreen Bootstrapper\" e inicie o Nemo de novo.",
        ),
    }
}

/// "Really quit?" question shown when the main window is closed: (title, text, quit, cancel).
pub fn quit_dialog(lang: Lang) -> (&'static str, &'static str, &'static str, &'static str) {
    match lang {
        Lang::De => (
            "Nemo beenden?",
            "Nemo wird komplett beendet; das Tastenkürzel zum schnellen Erfassen ist dann nicht mehr aktiv.",
            "Beenden",
            "Abbrechen",
        ),
        Lang::En => (
            "Quit Nemo?",
            "Nemo will close completely; the quick capture hotkey will no longer be active.",
            "Quit",
            "Cancel",
        ),
        Lang::Es => (
            "¿Cerrar Nemo?",
            "Nemo se cerrará por completo; el atajo de captura rápida dejará de estar activo.",
            "Cerrar",
            "Cancelar",
        ),
        Lang::Fr => (
            "Quitter Nemo ?",
            "Nemo sera complètement fermé ; le raccourci de saisie rapide ne sera plus actif.",
            "Quitter",
            "Annuler",
        ),
        Lang::Pt => (
            "Sair do Nemo?",
            "O Nemo será fechado por completo; o atalho de captura rápida deixará de funcionar.",
            "Sair",
            "Cancelar",
        ),
    }
}

// ---- remote control (src/remote.rs) ----
//
// German and English only: the frozen languages get English, like everywhere else.

use ::lan_sync::input::wire::Level;

fn german(lang: Lang) -> bool {
    lang == Lang::De
}

/// The confirmation at the PC before remote control is widened: (title, allow, cancel).
pub fn remote_dialog(lang: Lang) -> (&'static str, &'static str, &'static str) {
    if german(lang) {
        ("Fernsteuerung erlauben?", "Erlauben", "Abbrechen")
    } else {
        ("Allow remote control?", "Allow", "Cancel")
    }
}

fn remote_level(lang: Lang, level: Level) -> &'static str {
    match (german(lang), level) {
        (true, Level::Full) => "Maus und Tastatur, dazu Medien, Lautstärke und das Sperren des PCs",
        (true, _) => "Medien, Lautstärke und das Sperren des PCs",
        (false, Level::Full) => "mouse and keyboard, plus media, volume and locking the PC",
        (false, _) => "media, volume and locking the PC",
    }
}

/// A device that claimed no usable name; `id` is the start of its id.
pub fn remote_unnamed(lang: Lang, id: &str) -> String {
    if german(lang) {
        format!("Gerät ohne Namen ({id})")
    } else {
        format!("Device without a name ({id})")
    }
}

/// First line of the question for one device: the name alone behind a fixed label. `name` is
/// already plain text.
pub fn remote_ask_device(lang: Lang, name: &str) -> String {
    if german(lang) {
        format!("Gerät: {name}")
    } else {
        format!("Device: {name}")
    }
}

/// What that device may do afterwards.
pub fn remote_ask_level(lang: Lang, level: Level) -> &'static str {
    match (german(lang), level) {
        (true, Level::Full) => {
            "Dieses Gerät darf danach Maus und Tastatur dieses PCs steuern, dazu Medien, Lautstärke und das Sperren des PCs."
        }
        (true, _) => {
            "Dieses Gerät darf danach Medien und Lautstärke dieses PCs steuern und den PC sperren."
        }
        (false, Level::Full) => {
            "This device may then control the mouse and keyboard of this PC, plus media, volume and locking the PC."
        }
        (false, _) => "This device may then control media and volume of this PC and lock the PC.",
    }
}

pub fn remote_ask_unpause(lang: Lang) -> &'static str {
    if german(lang) {
        "Das Gerät ist zurzeit pausiert und wird wieder eingeschaltet."
    } else {
        "The device is paused right now and will be switched on again."
    }
}

pub fn remote_ask_no_unlock(lang: Lang) -> &'static str {
    if german(lang) {
        "Maus und Tastatur gehen dann auch, ohne das Handy vorher zu entsperren."
    } else {
        "Mouse and keyboard will then work without unlocking the phone first."
    }
}

/// "Last contact" in whole days: no clock format, so no locale is needed.
pub fn remote_last_contact(lang: Lang, last_seen: Option<u64>, now: u64) -> String {
    let days = last_seen.map(|seen| now.saturating_sub(seen) / 86_400);
    match (german(lang), days) {
        (true, None) => "Letzter Kontakt: noch nie verbunden.".to_owned(),
        (true, Some(0)) => "Letzter Kontakt: in den letzten 24 Stunden.".to_owned(),
        (true, Some(1)) => "Letzter Kontakt: vor einem Tag.".to_owned(),
        (true, Some(n)) => format!("Letzter Kontakt: vor {n} Tagen."),
        (false, None) => "Last contact: never connected yet.".to_owned(),
        (false, Some(0)) => "Last contact: within the last 24 hours.".to_owned(),
        (false, Some(1)) => "Last contact: one day ago.".to_owned(),
        (false, Some(n)) => format!("Last contact: {n} days ago."),
    }
}

/// First line of the question for the master switch.
pub fn remote_ask_switch(lang: Lang) -> &'static str {
    if german(lang) {
        "Die Fernsteuerung dieses PCs wird eingeschaltet. Diese Geräte dürfen ihn dann steuern:"
    } else {
        "Remote control of this PC will be switched on. These devices may then control it:"
    }
}

/// One device of that list: the name alone on a labelled line (a name holds no line break), what
/// it may do on the line below.
pub fn remote_ask_switch_line(lang: Lang, name: &str, level: Level) -> String {
    format!(
        "{}\n      {}",
        remote_ask_device(lang, name),
        remote_level(lang, level)
    )
}

pub fn remote_ask_more(lang: Lang, more: usize) -> String {
    if german(lang) {
        format!("… und {more} weitere.")
    } else {
        format!("… and {more} more.")
    }
}

/// The notice when a device starts to control mouse and keyboard: (title, text). `name` is
/// already plain text. It says what happens and where it ends; nothing to do, no alarm.
pub fn remote_notice(lang: Lang, name: &str) -> (&'static str, String) {
    if german(lang) {
        (
            "Fernsteuerung",
            format!("{name} steuert jetzt Maus und Tastatur dieses PCs. Beenden: Nemo-Symbol in der Taskleiste."),
        )
    } else {
        (
            "Remote control",
            format!("{name} now controls this PC's mouse and keyboard. To end it: the Nemo icon in the taskbar."),
        )
    }
}

/// The tray entry while a device controls this PC.
pub fn remote_end_label(lang: Lang) -> &'static str {
    if german(lang) {
        "Fernsteuerung beenden"
    } else {
        "End remote control"
    }
}

/// Under that entry, not clickable: what the click also does.
pub fn remote_end_hint(lang: Lang) -> &'static str {
    if german(lang) {
        "Danach bleibt das Gerät pausiert, bis du es hier wieder einschaltest"
    } else {
        "Afterwards the device stays paused until you switch it on here"
    }
}

/// The tray tooltip while a device controls this PC: who controls comes first (Windows cuts long
/// tooltips at the end), the page's text – capped – after it. `name` is already plain text.
pub fn remote_tooltip(lang: Lang, base: &str, name: &str) -> String {
    let base: String = base.chars().take(40).collect();
    if german(lang) {
        format!("Wird ferngesteuert von {name} – {base}")
    } else {
        format!("Remote controlled by {name} – {base}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_the_best_supported_language() {
        assert_eq!(from_accept_language("de-CH,de;q=0.9,en;q=0.8"), Lang::De);
        assert_eq!(from_accept_language("en;q=0.4,de-AT;q=0.9"), Lang::De);
        // Frozen languages are skipped: the next active one, else English.
        assert_eq!(from_accept_language("fr,de;q=0.5"), Lang::De);
        assert_eq!(from_accept_language("ja,fr;q=0.7,en;q=0.5"), Lang::En);
        assert_eq!(from_accept_language("pt-PT"), Lang::En);
        assert_eq!(from_accept_language("ja,ko"), Lang::En);
        assert_eq!(from_accept_language(""), Lang::En);
    }

    #[test]
    fn reads_the_header_from_a_request() {
        let req = "GET /callback HTTP/1.1\r\nHost: 127.0.0.1\r\naccept-language: de-DE,de\r\n\r\n";
        assert_eq!(accept_language_of(req), Lang::De);
        let frozen = "GET /callback HTTP/1.1\r\naccept-language: es-ES,es\r\n\r\n";
        assert_eq!(accept_language_of(frozen), Lang::En);
        assert_eq!(accept_language_of("GET / HTTP/1.1\r\n\r\n"), Lang::En);
    }

    #[test]
    fn the_app_language_is_one_of_the_active_ones_or_nothing() {
        assert_eq!(Lang::from_app("de"), Some(Lang::De));
        assert_eq!(Lang::from_app("en-GB"), Some(Lang::En));
        assert_eq!(Lang::from_app("EN"), Some(Lang::En));
        for other in ["", "fr", "pt-BR", "x", "de_DE; drop"] {
            assert_eq!(Lang::from_app(other), None, "{other:?}");
        }
    }

    #[test]
    fn maps_windows_language_ids() {
        assert_eq!(from_windows_langid(0x0407), Lang::De);
        assert_eq!(from_windows_langid(0x0807), Lang::De);
        assert_eq!(from_windows_langid(0x0409), Lang::En);
        assert_eq!(from_windows_langid(0x0416), Lang::En); // Portuguese: frozen
        assert_eq!(from_windows_langid(0x040c), Lang::En); // French: frozen
        assert_eq!(from_windows_langid(0x0411), Lang::En);
    }

    #[test]
    fn every_language_has_every_text() {
        // Frozen languages included: their texts are kept for re-activation.
        for lang in [Lang::De, Lang::En, Lang::Es, Lang::Fr, Lang::Pt] {
            let (ok, fail) = oauth_page(lang);
            let (title, text) = webview2_dialog(lang);
            assert!(ok.contains("Nemo") && fail.contains("Nemo"));
            assert!(title.contains("WebView2") && text.contains("WebView2"));
            let (qt, qx, qq, qc) = quit_dialog(lang);
            assert!(qt.contains("Nemo") && qx.contains("Nemo"));
            assert!(!qq.is_empty() && !qc.is_empty());
        }
    }

    #[test]
    fn remote_texts_exist_in_both_active_languages_and_frozen_ones_get_english() {
        for lang in [Lang::De, Lang::En, Lang::Es, Lang::Fr, Lang::Pt] {
            let (title, allow, cancel) = remote_dialog(lang);
            assert!(!title.is_empty() && !allow.is_empty() && !cancel.is_empty());
            assert_ne!(allow, cancel);
            assert!(remote_ask_device(lang, "X").ends_with('X'));
            assert!(remote_unnamed(lang, "ab12").contains("ab12"));
            for level in [Level::Media, Level::Full] {
                assert!(remote_ask_switch_line(lang, "X", level).contains('X'));
            }
            assert_ne!(
                remote_ask_level(lang, Level::Media),
                remote_ask_level(lang, Level::Full)
            );
            let tip = remote_tooltip(lang, &"N".repeat(300), "X");
            assert!(tip.contains('X') && tip.chars().count() < 100);
            assert!(!remote_end_label(lang).is_empty() && !remote_end_hint(lang).is_empty());
            let (title, text) = remote_notice(lang, "X");
            assert!(!title.is_empty() && text.starts_with('X') && !text.contains('!'));
        }
        assert_eq!(remote_dialog(Lang::Fr), remote_dialog(Lang::En));
        assert_ne!(remote_dialog(Lang::De), remote_dialog(Lang::En));
    }

    #[test]
    fn last_contact_counts_whole_days_and_never_goes_negative() {
        let day = 86_400;
        assert!(remote_last_contact(Lang::De, None, 5).contains("noch nie"));
        assert!(remote_last_contact(Lang::De, Some(100), 100 + day - 1).contains("24 Stunden"));
        assert!(remote_last_contact(Lang::De, Some(100), 100 + day).contains("einem Tag"));
        assert!(remote_last_contact(Lang::En, Some(100), 100 + 9 * day).contains("9 days"));
        // a clock set back: counted as now
        assert!(remote_last_contact(Lang::En, Some(500), 100).contains("24 hours"));
    }
}
