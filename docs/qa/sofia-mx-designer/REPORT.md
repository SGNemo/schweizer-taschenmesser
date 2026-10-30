# QA report: Sofía (graphic designer from Mexico, living in Berlin)

Severity labels follow the team scheme: `blocker / hoch (high) / mittel (medium) / niedrig (low)`. Benefit uses the same words.

## Persona and test setup

- **Sofía, 30**, graphic designer from Mexico City, six months in Berlin. Speaks Spanish and English, no German.
- Phone: Android. Laptop: Windows. Wants bills and subscriptions from unfamiliar German providers, calendar, groceries, a reading list, a password vault, and news feeds in Spanish and English.
- Judges the website and README as a stranger: would she trust and download it?
- **Platforms tested:** phone viewport 412×915 (Chromium, es-MX, Europe/Berlin) as the main platform; desktop 1366×768 and a 420 px narrow window briefly. Not tested: real Android device, Windows exe, Tauri shell.
- **Build:** web app 1.0.0, commit 4af432d, `develop`, Vite dev server. Fresh install (empty database) and the Dev-Preview build with `medium` test data (480 entries).
- **Date:** 2026-10-29. **Duration:** about 3 hours of session time.
- **Not verified / limits:** the dev server has no service worker, so a real offline start could not be tested (offline reload failed with a browser error, not an app error). Sync, push notifications and the GitHub download links were not tested (no server, no outbound network in the sandbox). The native date field showed `10/29/2026`, which may be the headless browser (see B24). I only read CLAUDE.md, the README and the website texts beforehand, no developer docs.

## First impression (10 minutes)

- README: friendly header, clear promise ("Your data stays on your device"), good privacy section. Then: "The app interface is German today; more languages are on the way." That sentence is wrong for the current build and, for me, it ends the visit (B03). The website says the same ("The app is in German"), has no Spanish page, and the install text (SmartScreen "More info → Run anyway", "allow install from this source" for the APK) sounds risky. The open-source/MIT/no-account badges help, a Play Store link would help more.
- First start in Spanish: language was detected by itself, welcome card is calm. The setup wizard has 12 steps and mixes in German (B02) and cut-off text (B11); I would abort around step 5 and use the module library instead.
- After closing the wizard, Resumen is nearly empty ("Aún no hay nada planificado. Con una cosa basta.") which is nice but gives no hint where to add bills first; the module library (More → Biblioteca de módulos) is where I found things.

## My goals as scenarios

| Goal | Result | Steps (taps) | Notes |
|---|---|---|---|
| Subscriptions (BVG Deutschlandticket, Vodafone, Rundfunkbeitrag) | Works, clear totals per month/year | ~8 taps per entry (Dinero → Suscripciones → Añadir → name, amount, date → Guardar) | No help about German providers (I05); "1." day list (B09); the 55,08 € Rundfunkbeitrag is quarterly, no "trimestral" in the repeat list |
| Bills (Vattenfall, Telekom, Nebenkosten) | Works well; grouping, undo, "Marcar como pagada" | ~6 taps | "Facturas" wording (I10), long title cut (B17) |
| Calendar (Bürgeramt, German class, dinner) | Works; reminders offered per event | ~9 taps | Cut-off switch (B06), "KW 44" (B08), empty-day cards (I08) |
| Groceries | Works; "2 aguacates" is parsed into quantity | 1 tap + typing per item | Double checkbox (B07) |
| Reading list | Saves links with type and tags; domain-only link accepted | ~5 taps | Types "Leer/Ver" terse |
| Password vault | Works, generator good, backup includes encrypted entries | ~12 taps to first login | German strength hints (B01), URL field (B05), English passphrase words (I09) |
| News feeds ES/EN | **Not possible** (no feed module) | – | I04 |

## A whole day

- **Morning (Dev build with data):** Resumen shows "Importante ahora", one task with "Empezar · 5 min", events, bills "desde hace 12 días", subscriptions, budgets. Calm, but 16 widgets means a very long scroll (9400 px on the phone); "Mostrar más" hides the rest, which is the right call.
- **Three spontaneous captures:** FAB → "Añadir rápido" with Tarea / Evento / Recordatorio / Guardados / Compra / Gasto / Factura / Nota. Fast and good; the sheet also offers "Añadir con IA" which I would not use.
- **Reminder:** event with "1 día antes" saved fine. Push with the app closed needs the sync server (not testable).
- **One module intensively:** Dinero (subs + invoices + paid-undo): good. Vault: good after the German text issue.
- **Evening wrap-up:** nothing like a closing view; Resumen is the same. I would open the app 2–3 times a day: bills when a letter arrives, groceries in the shop, calendar in the morning.

## Limits tried

Long invoice title (cut, B17); 7 grocery items; deleting and restoring (undo toast works; bought items clear with undo); backup export and import into a fresh browser profile (works, shows a preview, 40 entries restored, vault stays locked); language switch ES → EN → ES (instant, no German except the items listed); dark theme on desktop (good); 420 px narrow window (calendar header cramped, see B06); Dev-build with 480 entries (fast). Sync: not possible without a server.

## Language and format judgement

- **Spanish:** mostly natural and warm. Problems are leftovers, not tone: German strings (B01, B02, B08, B09), German quotes (B13), English legal block (B14), title-case months (B10), mixed names (B15, B19).
- **English:** good. "Not again" for "No volver a mostrar" is odd; the list "Compra" stays Spanish because the default list name was created in Spanish (that is my data, fine).
- **Dates/numbers/currency:** Spanish uses Spain conventions (decimal comma, no grouping for 4 digits, `31/12/26`); Mexico would be `1,716.84` and `31/12/2026`. No Mexico entry in "Números y fechas" and the currency is fixed to EUR (I01). In English the UI shows `€1,716.84`, fine.
- **Icons without cultural context:** calendar, wallet, key, box ("Hogar") are clear. The fish mascot is cute and harmless. The wrench for "Herramientas" and the bell are standard.

## Bugs

### B01 · Password-strength feedback is in German inside the Spanish UI

- **Severity:** hoch · **Area:** accounts (vault) · **Frequency:** always · **Platform:** phone (web)
- **Steps:**
  1. Settings language: Spanish (or English).
  2. More → Bóveda → Contraseñas → create vault.
  3. Type "1234" as master password; later type a strong one or add a login with a password.
- **Expected:** Everything in the strength hint is in Spanish.
- **Actual:** "aprox. weniger als eine Sekunde", "Dies ist ein sehr häufig verwendetes Passwort.", "aprox. 2 Stunden", "aprox. Jahrhunderte". Same text appears in the add-login form.
- **Screenshot:** [31-vault-weak.png](screenshots/31-vault-weak.png)

### B02 · AI provider names and options are German in the Spanish setup wizard

- **Severity:** hoch · **Area:** setup / ai · **Frequency:** always · **Platform:** phone (web)
- **Steps:**
  1. Spanish UI, start setup, go to step 5 "Proveedor de IA".
  2. Open the "Añadir proveedor" dropdown.
- **Expected:** Provider names like "Ollama (local)", "OpenRouter (modelos gratuitos)", "Proveedor propio (compatible con OpenAI)".
- **Actual:** "Ollama (lokal)", "OpenRouter (kostenlose Modelle)", "Eigener Anbieter (OpenAI-kompatibel)".
- **Screenshot:** [03-setup-step05.png](screenshots/03-setup-step05.png)

### B03 · README and website tell international visitors the app is German-only

- **Severity:** hoch · **Area:** website / readme · **Frequency:** always · **Platform:** web
- **Steps:**
  1. Open README.md and the site texts (EN).
- **Expected:** Says the app is available in Spanish (and 4 languages) with the download buttons.
- **Actual:** README: "The app interface is German today; more languages are on the way." Website: "The app is in German.", "Full guide (German)", screenshots in German, site only in DE/EN. The app itself has 5 languages. I would not download it.
- **Screenshot:** (text, no screenshot)

### B04 · Strength label contradicts crack time

- **Severity:** mittel · **Area:** accounts (vault) · **Frequency:** always · **Platform:** phone (web)
- **Steps:**
  1. Vault unlocked → Añadir acceso.
  2. Type password "Tortilla-2026-xyz!".
- **Expected:** Consistent label ("Moderada/Fuerte") for a password that is cracked offline in about 2 hours.
- **Actual:** Label "Muy fuerte" next to "aprox. 2 Stunden" (and a full bar).
- **Screenshot:** [36-after-save.png](screenshots/36-after-save.png)

### B05 · Website field rejects "service.berlin.de" with a browser tooltip

- **Severity:** mittel · **Area:** accounts (vault) · **Frequency:** always · **Platform:** phone (web)
- **Steps:**
  1. Vault → Añadir acceso, fill name, user, password.
  2. Website: type service.berlin.de, tap Guardar.
- **Expected:** Domain accepted (the Saved module accepts "elpais.com") or a clear Spanish hint.
- **Actual:** Save does nothing visible except the browser tooltip "Please enter a URL." (English in my test browser). Easy to think saving is broken.
- **Screenshot:** [36-after-save.png](screenshots/36-after-save.png)

### B06 · Calendar/Reminders switch is squeezed and cut off next to the page title at phone width

- **Severity:** mittel · **Area:** calendar · **Frequency:** always · **Platform:** phone 412 px
- **Steps:**
  1. Phone width 412 px, Planificar → Calendario.
- **Expected:** Readable switch or placed on its own row.
- **Actual:** A pill with the text "Calenda" (cut) sits between the title "Calendario" and the "Avanzado" toggle. The same screen has two other ways to switch (top tabs Calendario/Tareas).
- **Screenshot:** [16-calendar.png](screenshots/16-calendar.png)

### B07 · Two identical checkboxes per shopping-list row

- **Severity:** mittel · **Area:** lists · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Hogar → Compra, add "2 aguacates".
  2. Try to tick it off.
- **Expected:** One clear checkbox for "bought".
- **Actual:** Two same-looking checkboxes side by side: left = "Seleccionar" (bulk select), right = bought. In a shop I tapped the wrong one first and got a "1 seleccionado / Marcar / Eliminar" bar.
- **Screenshot:** [23-groceries.png](screenshots/23-groceries.png)

### B08 · "KW 44" (German Kalenderwoche) in week header

- **Severity:** mittel · **Area:** calendar / i18n · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Planificar → Calendario → Semana.
- **Expected:** "Sem. 44" or no week number.
- **Actual:** "KW 44 · 26 Oct – 1 Nov 2026"; month names also capitalised here but lower-case elsewhere ("1 nov 2026").
- **Screenshot:** [18-cal-week.png](screenshots/18-cal-week.png)

### B09 · Day-of-month list uses German ordinal dots ("1.", "2.", "3.")

- **Severity:** mittel · **Area:** subscriptions / i18n · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Dinero → Suscripciones → Añadir suscripción.
  2. Open "Día del mes".
- **Expected:** "1", "2", "3" or "día 1".
- **Actual:** "1." … "31." and "Último día".
- **Screenshot:** [11-sub-form.png](screenshots/11-sub-form.png)

### B10 · Month headings are title-cased in Spanish: "Octubre De 2026"

- **Severity:** mittel · **Area:** i18n (dates) · **Frequency:** always · **Platform:** phone + desktop
- **Steps:**
  1. Dinero → Finanzas or Planificar → Calendario.
- **Expected:** "octubre de 2026" (or "Octubre 2026").
- **Actual:** "Octubre De 2026" (capital D). Looks like a bug on every month header, phone and desktop.
- **Screenshot:** [09-money-hub.png](screenshots/09-money-hub.png)

### B11 · Explanatory paragraphs are cut off mid-word with "…" and no way to read the rest

- **Severity:** mittel · **Area:** setup / i18n · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Spanish UI, start setup.
  2. Look at the welcome card on Resumen and step 5 (AI provider).
- **Expected:** Full text or a "more" link, especially for the privacy statement.
- **Actual:** "…cuando quieras e…", "…en Ajustes → IA….", "…la breve descripción de l…" (privacy sentence cut).
- **Screenshot:** [03-setup-step05.png](screenshots/03-setup-step05.png)

### B12 · Setup wizard has 12 steps with technical topics for a first-time user

- **Severity:** mittel · **Area:** setup · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Start setup, tap through steps 1–12.
- **Expected:** Short start (language, modules) with the rest optional later.
- **Actual:** AI provider, calendar subscription (ICS), "Importar con IA", JSON schema, update channel, "Mostrar herramientas de desarrollo" before I have used the app. I would quit at step 5–6.
- **Screenshot:** [03-setup-step05.png](screenshots/03-setup-step05.png)

### B13 · German-style quotation marks in Spanish

- **Severity:** niedrig · **Area:** search / i18n · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Open search (Buscar), type "noticias RSS".
- **Expected:** «noticias RSS».
- **Actual:** "Preguntar al asistente: „noticias RSS“" (German low-9 quote). Elsewhere the app correctly uses «…».
- **Screenshot:** [38-search-news.png](screenshots/38-search-news.png)

### B14 · English text in Spanish "Acerca de Nemo" legal block

- **Severity:** niedrig · **Area:** settings / i18n · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Settings → Acerca de Nemo, scroll to the end.
- **Expected:** Spanish.
- **Actual:** "Legal: imprint and contact", "Whom to contact with questions".
- **Screenshot:** [50-about.png](screenshots/50-about.png)

### B15 · Same feature has two names: "Silencio" and "Modo juego"

- **Severity:** niedrig · **Area:** notifications · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Open Settings (top card "Silencio").
  2. Open Settings → Notificaciones.
- **Expected:** One name.
- **Actual:** Home card says "Silencio: Desactivado / 1 hora / Hasta mañana"; the Notifications page calls the same idea "Modo juego" (gaming mode). I would not find it.
- **Screenshot:** [04-settings-es.png](screenshots/04-settings-es.png)

### B16 · Currency tool error is unclear and gives no offline fallback

- **Severity:** niedrig · **Area:** tools · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Open Herramientas → Divisas without internet.
- **Expected:** Short sentence with "tipos de cambio" and a retry; ideally bundled rates.
- **Actual:** "No se pudieron cargar los tipos y aún no hay ninguno guardado." ("tipos" alone is not clear.) Tool is useless until first online use.
- **Screenshot:** [39-currency.png](screenshots/39-currency.png)

### B17 · Long invoice title is cut in the list and cannot be read in full

- **Severity:** niedrig · **Area:** invoices · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Facturas → add "Hausverwaltung Miete Nachzahlung (Nebenkostenabrechnung 2025)".
- **Expected:** Wrap to two lines or full text on tap.
- **Actual:** "Hausverwaltung Miete Nachzahlung…" cut; the brackets part is lost.
- **Screenshot:** [14-invoices.png](screenshots/14-invoices.png)

### B18 · Redundant "Mañana" (group header and chip on the row)

- **Severity:** niedrig · **Area:** invoices · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Add an invoice due tomorrow.
- **Expected:** Say it once.
- **Actual:** Group header "Mañana" and the row repeats "Mañana" next to the amount.
- **Screenshot:** [14-invoices.png](screenshots/14-invoices.png)

### B19 · "Saldo", "Balance" and "Disponible" next to each other

- **Severity:** niedrig · **Area:** finance · **Frequency:** always · **Platform:** phone + desktop
- **Steps:**
  1. Dinero → Finanzas.
- **Expected:** Clear difference or fewer terms.
- **Actual:** "Saldo 0,00 €" above "Balance 0,00 €"; on desktop "Disponible" plus "Saldo … · facturas pendientes". For me saldo and balance are the same word.
- **Screenshot:** [09-money-hub.png](screenshots/09-money-hub.png)

### B20 · Keyboard shortcut hint is shown on the phone

- **Severity:** niedrig · **Area:** accounts (vault) · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Open a login detail in the vault.
- **Expected:** No keyboard hints on touch devices.
- **Actual:** "Teclas: U usuario, P contraseña, T código, O abrir sitio web."
- **Screenshot:** [37-access-detail.png](screenshots/37-access-detail.png)

### B21 · Module settings summaries show values without labels

- **Severity:** niedrig · **Area:** settings · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. Settings → Módulos.
- **Expected:** Label for each value.
- **Actual:** "Campos: Mes · 09:00 · 09:00", "Campos: 2 · 09:00", "Campos: 3 · 09:00".
- **Screenshot:** [05-module-library.png](screenshots/05-module-library.png)

### B22 · Developer module "Ejemplo" is offered in the module library for normal users

- **Severity:** niedrig · **Area:** library · **Frequency:** always · **Platform:** phone
- **Steps:**
  1. More → Biblioteca de módulos → Hogar/Conocimiento.
- **Expected:** Hidden unless developer mode.
- **Actual:** "Ejemplo – Desarrolladores – Módulo de referencia del generador…" can be switched on.
- **Screenshot:** [06-module-library.png](screenshots/06-module-library.png)

### B23 · Dev-preview banners and the Settings → Desarrollo page are German in a Spanish UI

- **Severity:** niedrig · **Area:** dev preview · **Frequency:** always · **Platform:** phone (dev preview)
- **Steps:**
  1. Open the dev build (linked from README), language Spanish.
- **Expected:** Spanish or clearly marked English.
- **Actual:** "Testdaten geladen, entfernen unter Einstellungen → Entwickler." and the whole developer page in German. Low because it is the untested preview.
- **Screenshot:** [43-dev-first.png](screenshots/43-dev-first.png)

### B24 · Native date field format follows the test browser (10/29/2026)

- **Severity:** niedrig · **Area:** forms · **Frequency:** unverified · **Platform:** phone (web)
- **Steps:**
  1. Add subscription → "Cargo el".
- **Expected:** dd/mm/aaaa (what I use).
- **Actual:** Showed 10/29/2026 in my headless Chromium. Not verified on a real Android phone, so unclear whether this is the app or the test setup.
- **Screenshot:** [11-sub-form.png](screenshots/11-sub-form.png)

## Improvements

### I01 · Add Mexico (es-MX) formats and a currency choice

- **Situation:** I read 1,716.84 and 12,410.93 differently than the app shows.
- **Problem today:** Formats list only offers Spain (1716,84 €, 12.410,93 €); no Mexico, Latin America or currency choice (EUR fixed). 4-digit amounts have no thousands separator.
- **Proposal:** Add "México (español): 31/12/2026, 1,234.56" and an optional second display currency (MXN) for transfers home.
- **Benefit for me:** hoch · **Area:** i18n / formats
- **Inspiration:** Apple Settings → Region.

### I02 · Spanish (and the other app languages) on website and README, with localised screenshots

- **Situation:** Deciding whether to download.
- **Problem today:** Site and README are DE/EN only and say the app is German (see B03).
- **Proposal:** Say "5 languages" in the hero, add an ES page or at least an ES README, use Spanish screenshots. Trust signals (open source, no account) are already good.
- **Benefit for me:** hoch · **Area:** website / readme
- **Inspiration:** Signal, Obsidian sites.

### I03 · Move data phone ↔ laptop without running a server

- **Situation:** I use Android and a Windows laptop and want the same bills and calendar on both.
- **Problem today:** Sync needs "Dirección del servidor" and a token (own server, Tailscale). That is out of reach for me. Backup file works but is manual.
- **Proposal:** Offer a no-server path: pair two devices over the local network or by QR code, or a one-tap "send backup to my other device". Still local-first, no cloud. (A hosted cloud would contradict the principle.)
- **Benefit for me:** hoch · **Area:** sync
- **Inspiration:** Syncthing, KDE Connect pairing, Quick Share.

### I04 · A feed reader or at least RSS subscriptions inside Saved

- **Situation:** Reading Spanish and English news.
- **Problem today:** No module for feeds. Searching "noticias RSS" only offers the AI assistant. "Saved" stores single links.
- **Proposal:** Optional feed list (RSS/Atom URLs) that fetches only after I add it, with a clear "this contacts the site" hint. Fits "only what you set up leaves the device"; flag: adds new outgoing traffic.
- **Benefit for me:** hoch · **Area:** news / bookmarks
- **Inspiration:** Feedly, NetNewsWire, Feeder.

### I05 · Starter list of common German providers and bill types

- **Situation:** I did not know what Rundfunkbeitrag, Nebenkosten, Deutschlandticket or Hausverwaltung mean.
- **Problem today:** Free text only, no hint, no cancellation info.
- **Proposal:** Offline preset list (name, usual interval, one-line explanation in my language) when adding a subscription/invoice; "what is this?" help line.
- **Benefit for me:** hoch · **Area:** subscriptions / invoices
- **Inspiration:** Bank apps with merchant logos; Wise.

### I06 · Short first run: language, name, 2–3 modules, done

- **Situation:** First 10 minutes.
- **Problem today:** 12 steps (see B12).
- **Proposal:** Show 3 steps, put the rest in a checklist that stays on Resumen (already exists). Profile cards could pre-select with one tap and show what changed.
- **Benefit for me:** mittel · **Area:** setup
- **Inspiration:** Notion onboarding.

### I07 · Spanish shopping vocabulary and templates

- **Situation:** Groceries (tortillas, aguacate, chile) plus German items.
- **Problem today:** List is called "Compra"; in Mexico I say "súper" or "despensa" (and the app uses "Despensa" for the pantry module).
- **Proposal:** Let me rename the default list at creation; a suggestion list when typing; unit chips (kg, g, pza).
- **Benefit for me:** mittel · **Area:** lists
- **Inspiration:** AnyList, Bring!.

### I08 · Compact week view for empty days

- **Situation:** Checking my week.
- **Problem today:** Each empty day takes a whole card with the fish and "Sin entradas" (7 cards = 4+ screens).
- **Proposal:** Collapse empty days into one line or a 7-column strip.
- **Benefit for me:** mittel · **Area:** calendar
- **Inspiration:** Google Calendar schedule view.

### I09 · Spanish passphrase word list

- **Situation:** Memorable master password.
- **Problem today:** Generator offers only English words ("squiggle", "puritan").
- **Proposal:** Word list per language, with accent-free words.
- **Benefit for me:** mittel · **Area:** accounts (vault)
- **Inspiration:** Bitwarden passphrase options.

### I10 · "Recibo/cuenta" wording for bills I owe

- **Situation:** Paying utilities.
- **Problem today:** "Facturas" means tax invoices I issue for me; the module is for bills to pay.
- **Proposal:** "Recibos y cuentas por pagar" or "Pagos pendientes" as es label; keep Factura for the other.
- **Benefit for me:** mittel · **Area:** invoices
- **Inspiration:** —

### I11 · Say clearly what the search can and cannot do

- **Situation:** Typing "noticias RSS".
- **Problem today:** Only offers "Preguntar al asistente" even though no AI is configured.
- **Proposal:** If no AI is set up, show "no results" plus the link to modules.
- **Benefit for me:** mittel · **Area:** search
- **Inspiration:** Spotlight.

### I12 · Wordmark readability at small size

- **Situation:** Designer eye.
- **Problem today:** The hand-drawn "Nemo" in the header is hard to read at 20 px height (letters merge).
- **Proposal:** Icon-only or simpler wordmark in the header on small screens.
- **Benefit for me:** niedrig · **Area:** design
- **Inspiration:** —

### I13 · Quick-add FAB covers content and duplicates the page button

- **Situation:** Adding things.
- **Problem today:** "+" round button overlaps the last card, while "+ Movimiento"/"Añadir factura" exist on the page.
- **Proposal:** Hide the FAB on pages with their own primary button or lift it above content.
- **Benefit for me:** niedrig · **Area:** forms
- **Inspiration:** Material guidelines.

### I14 · Warn clearly that document files are not in backup

- **Situation:** Storing passport/residence permit scans.
- **Problem today:** Note exists but is easy to miss; losing the phone loses the files.
- **Proposal:** Show it at the moment of attaching a file, with a "export files" button.
- **Benefit for me:** niedrig · **Area:** documents
- **Inspiration:** —

## What is good (please keep)

1. Spanish is detected automatically from the phone; I did not have to find a language switch.
2. Most Spanish copy is natural and kind ("Con una cosa basta", "Aún no hay nada planificado. Con una cosa basta."), no guilt wording.
3. Dates in lists read well in Spanish ("Vence el: vie, 30 oct", "dentro de 2 días", "desde hace 12 días").
4. Undo after destructive actions (paying an invoice, removing bought items) with a toast: "Marcada como pagada. Deshacer".
5. Quick-date chips "Hoy / Mañana / Próxima semana" in invoice and event forms.
6. Backup: preview of what will be restored ("Esto pasará al restaurar"), merge vs replace; restore worked first time (40 entries).
7. Honest privacy copy: "La contraseña maestra no se puede restablecer", what leaves the device is listed.
8. Desktop layout with sidebar, search (Ctrl+K), dark theme looks calm and consistent; contrast fine.
9. "Importante ahora" strip on Resumen: short, no red alarm, one next step ("Empezar · 5 min").
10. Subscriptions total per month/year updates instantly (143,07 € / 1716,84 €); the calendar shows the next charge date.

## Understanding

| Term / icon / text | What I understood, suggestion |
|---|---|
| "Argon2id, AES-256" in the vault intro | Technical; say "cifrado fuerte" and keep details behind the "?" icon. |
| "Pegar JSON … en formato Nemo", "Copiar esquema para la IA", "Importar con IA" | I do not know what JSON or a schema is; explain "Pega aquí una lista…" or hide for non-technical profiles. |
| "Avanzado" toggle on every page | No hint what changes. Add one line under it. |
| Bell icon with a number (12) and the tool icon (wrench) | Wrench = "Herramientas" is okay on desktop (labelled) but on phone it is an unlabelled icon. |
| Tick button on invoice rows | Only an icon; I learned it by the toast. Add text "Pagada" on first use. |
| "Despensa" vs "Hogar" vs "Compra" | Pantry vs household vs shopping list; the three words overlap in Mexican Spanish. |
| "Modo juego" | Looks like a game feature (see B15). |
| "Guardados · Marcadores · Leer / Ver" | "Leer" and "Ver" as types are infinitives; "Para leer / Para ver". |
| Mascot fish in empty states | Cute but I read it as a decorative icon, not as meaning; fine. |
| "Resumen" for Home and the Finanzas overview | Same word in two places. |
| Foreign terms: Anmeldung, Bürgeramt, Rundfunkbeitrag | Not the app's fault, but no help text (see I05). |

## Verdict of the day

**Would I keep using it?** Yes, for bills, subscriptions and the calendar, if the German leftovers go away and the README stops saying the app is German. It is calmer than my bank apps, and I like that nothing leaves my phone. The vault and the backup preview made me trust it.

**One reason to uninstall:** not being able to see the same data on phone and laptop without running my own server (I03). Second place: a security screen in German (B01).

**Would I download it from the website today?** No. The page tells me the app is in German (B03).
