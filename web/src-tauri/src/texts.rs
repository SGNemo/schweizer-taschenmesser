//! The few texts the native shell shows before (or outside) the web app: the OAuth result page in
//! the browser and the "WebView2 missing" dialog. The web app's catalogs are not reachable there, so
//! each text exists here in the five UI languages; the language comes from the browser's
//! `Accept-Language` header or from the operating system.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lang {
    De,
    En,
    Es,
    Fr,
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

    fn from_primary(code: &str) -> Option<Lang> {
        match code {
            "de" => Some(Lang::De),
            "en" => Some(Lang::En),
            "es" => Some(Lang::Es),
            "fr" => Some(Lang::Fr),
            "pt" => Some(Lang::Pt),
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
        0x0a => Lang::Es,
        0x0c => Lang::Fr,
        0x16 => Lang::Pt,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_the_best_supported_language() {
        assert_eq!(from_accept_language("de-CH,de;q=0.9,en;q=0.8"), Lang::De);
        assert_eq!(from_accept_language("ja,fr;q=0.7,en;q=0.5"), Lang::Fr);
        assert_eq!(from_accept_language("en;q=0.4,pt-PT;q=0.9"), Lang::Pt);
        assert_eq!(from_accept_language("ja,ko"), Lang::En);
        assert_eq!(from_accept_language(""), Lang::En);
    }

    #[test]
    fn reads_the_header_from_a_request() {
        let req = "GET /callback HTTP/1.1\r\nHost: 127.0.0.1\r\naccept-language: es-ES,es\r\n\r\n";
        assert_eq!(accept_language_of(req), Lang::Es);
        assert_eq!(accept_language_of("GET / HTTP/1.1\r\n\r\n"), Lang::En);
    }

    #[test]
    fn maps_windows_language_ids() {
        assert_eq!(from_windows_langid(0x0407), Lang::De);
        assert_eq!(from_windows_langid(0x0807), Lang::De);
        assert_eq!(from_windows_langid(0x0416), Lang::Pt);
        assert_eq!(from_windows_langid(0x0411), Lang::En);
    }

    #[test]
    fn every_language_has_every_text() {
        for lang in [Lang::De, Lang::En, Lang::Es, Lang::Fr, Lang::Pt] {
            let (ok, fail) = oauth_page(lang);
            let (title, text) = webview2_dialog(lang);
            assert!(ok.contains("Nemo") && fail.contains("Nemo"));
            assert!(title.contains("WebView2") && text.contains("WebView2"));
        }
    }
}
