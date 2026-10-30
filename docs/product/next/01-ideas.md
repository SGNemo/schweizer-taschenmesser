# Ideen für die nächsten Aufgaben (Runde 2, 2026-10-16)

Grundlage: [00-known-open.md](00-known-open.md), Screenshots des Dev-Builds (Desktop 1280 px, Handy 390 px), Antworten des Maintainers aus Runde 1 und eine Web-Recherche (Quellen unten). Jede Idee: Nutzen in einem Satz · Aufwand S (Stunden) / M (Tage) / L (Woche+) · Reizlast (senkt / neutral / erhöht) · Kategorie.

**Was Runde 1 ergeben hat:** Täglich gemeint sind Kalender + ToDos, Geld und Tresor. Tatsächlich ist der Umstieg aber noch gar nicht passiert: Termine und Aufgaben liegen bei Google, Geld in Banking-App und Excel, Spontanes im Kopf oder in Handy-Notizen – weil der Umstieg schwerfällt. Die App wird nicht geöffnet unterwegs (zu viel Kopfzeug), zum schnellen Erfassen (zu langsam), abends (kein Anlass) und am PC nebenbei (nicht präsent). Daraus folgt die wichtigste neue Kategorie **Umstieg**: der Weg von „habe ich installiert“ zu „nutze ich“.

**Nicht aufgenommen, weil schon einem laufenden Chat gehörend** (`feat/focus2-*`, [focus/11-plan-2.md](../focus/11-plan-2.md)): ruhige Defaults (#177), „Heute“-Karte und ruhiges ToDo-Layout ohne FAB, Snooze in Zeilen, Touch-Ziele, Wetter-Widget, Screenshot-Werkzeug, Shortcut-Karte, globaler Hotkey.

## Top 10 nach Nutzen/Aufwand

| Nr. | Idee (kurz) | Nutzen | Aufwand | Reizlast | Kategorie |
|---|---|---|---|---|---|
| 1 | Google-Takeout-Import (Kalender, Tasks, Keep) | Der Hauptgrund, warum der Umstieg nicht passiert ist | M | senkt | Umstieg |
| 2 | Bank-CSV-Presets + OFX + Spaltenzuordnung | Geld-Modul mit echten Daten statt Excel daneben | M | senkt | Umstieg |
| 35 | „In Arbeit anzeigen“-Schalter (Reifegrad je Modul/Werkzeug/Einstellung) | Alles Halbfertige verschwindet, bis man es will; ehrlich beim Launch | M | senkt stark | Komfort |
| 16 | Mobile Kopfzeile halbieren (Bereich, Tabs, Titel, Erweitert in eine Zeile) | Handy zeigt Inhalt statt Rahmen | M | senkt | Verschönerung |
| 7 | Android App-Shortcuts + Schnelleinstellungs-Kachel | Erfassen in 1 Tipp ohne App-Start | S | senkt | Funktion |
| 8 | Windows-Tray „Mini-Heute“ (nächste 3 Dinge, Anfangen, Timer) | App ist am PC präsent, ohne offen zu sein | S–M | neutral | Funktion |
| 37 | Kaltstart und Bundle (Lazy-Load schwerer Teile, Messung) | Handy öffnet schnell genug, um einen Gedanken zu fangen | M | senkt | Technik |
| 28 | Geld-Regeln: Abo ↔ Buchung, Kategorie-Regeln, Preis erhöht | Geld-Modul arbeitet von selbst, weniger Pflege | M | senkt | Automatisierung |
| 15 | Mehrere Dinge auf einmal erfassen (Absatz → Einträge mit Vorschau) | „Kopf leeren“ in einem Rutsch, auch abends | S–M | senkt | Funktion |
| 11 | Android-Homescreen-Widget „Eingang“ (nativ, Offline-Warteschlange) | Der direkteste Weg vom Gedanken in die App | L | senkt | Funktion |

Nachrücker: 3 Umzugsassistent (M), 38 Test-Tempo (M), 21/22 Leerzustände + Mikro-Übergänge (S–M), 27 Komfort-Reste Paket 9 (M), 17 FAB/Bottom-Nav-Überdeckung (S).

## Alle Ideen

### A. Umstieg (Quelle 2 + 3: Recherche, Alltagslücken)
1. **Google-Takeout-Import mit Vorschau.** Takeout-ZIP oder Einzeldateien wählen: Kalender-ICS → Termine (ICS-Parser vorhanden), Tasks-JSON (eine Datei je Liste) → ToDo-Listen inkl. erledigt/Fälligkeit, Keep-JSON/HTML → Notizen oder Listen (Checkboxen werden Listen). Dedupe über UID/Titel+Datum, alles eine Charge mit Rückgängig (`core/importer/batches.ts`). Google exportiert Tasks nur als Ganzes ohne Re-Import – genau da ist Nemo die Alternative. · M · senkt · Umstieg
2. **Bank-Import für den deutschen Alltag.** OFX/QIF neben CSV/CAMT; Spalten-Presets für häufige Banken-CSV (Sparkasse, ING, DKB, N26, comdirect, Volksbank), dazu „eigene Tabelle“ mit Spaltenzuordnung, die sich die App merkt; Dedupe über Transaktions-ID/Hash. ROADMAP M5 im Kern. · M · senkt · Umstieg
3. **Umzugsassistent.** Ein Schritt im Einrichtungsassistenten „Woher kommst du?“ (Google, Apple, Papier, Excel, Bitwarden/KeePass) führt zu den passenden Importern und hinterlässt eine Checkliste „Was fehlt noch“ (z. B. „Google-Kalender als Abo verbinden“, „Bank-Export holen“). Wiederaufrufbar unter Einstellungen → Daten. Baut auf 1 und 2 auf. · M · senkt · Umstieg
4. **Parallelbetrieb statt Schnitt: Google Tasks lesend.** Wer noch nicht loslassen kann, sieht Google-Aufgaben in Nemo (Connector `google`, Feature `tasks`, nur lesend wie der Kalender), erledigt in Nemo wird nach Google gespiegelt (optional, einzelne Schreibrichtung). Riskanter als 1; nur wenn 1 nicht reicht. · M · neutral · Umstieg
5. **Weg zurück: Export je Modul.** ICS (Kalender), CSV (Geld, ToDos, Personen), Markdown-Ordner (Notizen), Netscape-HTML (Merkliste) – unter Einstellungen → Daten. Wer weiß, dass er jederzeit raus kann, steigt leichter um. ROADMAP M2 (ICS) enthalten. · S–M · neutral · Umstieg
6. **Tresor-Import: KeePass XML/CSV, 1Password CSV, Credential-Exchange (CXP).** Heute nur Bitwarden-CSV (`modules/accounts/csv.ts`). Sicherheitsbereich: nur Parser und Vorschau, keine Änderung an Verschlüsselung oder Format. · M · neutral · Umstieg

### B. Erfassen und Präsenz (Quelle 2 + 3 + 5)
7. **Android App-Shortcuts + Schnelleinstellungs-Kachel.** Statisches `shortcuts.xml` (Schnellerfassung, Suche, Heute) und ein Tile „Nemo: Erfassen“, beides öffnet `/?capture=1`. Schon als Vorschlag in `features/quick-capture.md`. · S · senkt · Funktion
8. **Windows-Tray „Mini-Heute“.** Tray-Menü zeigt die nächsten 3 Dinge (Termin, ToDo, Fälligkeit), „Jetzt dran anfangen“, „Timer 25“ und „Erfassen“; Linksklick bleibt Hauptfenster. Kein eigenes Fenster, nur Menüeinträge aus einem kleinen Snapshot, den die App in `_meta` schreibt. · S–M · neutral · Funktion
9. **Android-Benachrichtigungen mit Aktionen.** „Erledigt“ und „Später“ direkt in der Erinnerung (heute keine Aktionen; „Später“ nur in der In-App-Karte). Snooze-Dauer aus den Fokus-Einstellungen. Grenze zu `feat/focus2-reminders` (Snooze in Zeilen) klar ziehen: hier nur die native Benachrichtigung. · M · senkt · Funktion
10. **PWA-Badge mit Fälligkeiten.** Badging-API: Zahl auf dem App-Icon = heute fällig; abschaltbar, standardmäßig aus; Service Worker `sw.ts` setzt sie beim Planen der Erinnerungen. · S · neutral · Funktion
11. **Android-Homescreen-Widget „Eingang“.** Nativer Knopf → Textfeld → Speichern in die ToDo-Liste „Eingang“, ohne WebView-Start, mit Offline-Warteschlange (SharedPreferences → beim nächsten App-Start eingelesen). Zweite Ausbaustufe: Mini-Agenda (3 Zeilen). Entweder Kotlin RemoteViews im bestehenden Plugin-Kontext oder `tauri-plugin-widgets` (0.5, JSON-Konfiguration, Handarbeit). Größter Hebel gegen „zu langsam zum Erfassen“, aber nur auf Hardware testbar. · L · senkt · Funktion
12. **Share-Target für Dateien und Bilder auf Android.** PDF-Beleg oder Foto teilen → Unterlagen oder Rechnung (heute nur `text/plain`). ROADMAP I5. · M · neutral · Funktion
13. **Erfassen ohne Rückfrage auch am Handy sichtbar machen.** Beim Teilen aus einer anderen App kein Dialog, sondern Toast „Im Eingang“ mit „Ändern“; Voreinstellung bleibt „Ohne Rückfrage speichern“. · S · senkt · Komfort
14. **Zwischenablage-Vorschlag beim Öffnen am Handy.** Enthält die Zwischenablage einen Link oder ein Datum, bietet die Schnellerfassung eine Zeile „Aus Zwischenablage: …“ an (Desktop-Option „Zwischenablage einfügen“ gibt es schon; auf Android nur nach Nutzeraktion lesbar, daher Knopf, keine Automatik). · S · neutral · Komfort
15. **Mehrere Dinge auf einmal erfassen.** Ein Absatz oder mehrere Zeilen in der Leiste → der vorhandene Regel-Parser macht je Zeile einen Eintrag (ToDo, Termin, Merkliste, Buchung-Entwurf), Vorschau wie beim Import, ein Klick speichert alles. „Kopf leeren“ abends, Diktat über die Handy-Tastatur funktioniert automatisch mit. · S–M · senkt · Funktion

### C. Handy-Oberfläche (Quelle 3 + 4, Screenshots)
16. **Mobile Kopfzeile halbieren.** Heute auf 844 px: Topbar, Bereichs-Label, Bereichs-Tabs, H1 mit „Erweitert“-Schalter, dann erst Inhalt (bei ToDos zusätzlich „Neue Liste“, Chips, Eingabefeld). Ziel: Bereich + Tabs als eine kompakte Zeile, „Erweitert“ ins Kontext-Zahnrad, Titel kleiner, Topbar beim Scrollen eingeklappt (nur Suche bleibt). Nur `layout/AreaFrame.tsx`, `TopBar.tsx`, Seitenkopf-Komponente – nicht ToDo-Seite und FAB (gehören `feat/focus2-today`). · M · senkt · Verschönerung
17. **FAB/Bottom-Nav verdecken die letzte Zeile** (Visual #17). Safe-Area-Padding am Inhaltsende statt am FAB. Klein genug für 16. · S · neutral · Verschönerung
18. **Wochenansicht am Handy: 3 Tage oder 1 Tag mit Wischen** (Spec-Frage §13). Heute Monatsraster mit abgeschnittenen Chips. · M · senkt · Verschönerung
19. **Kalender-Monat ruhiger** (Audit 2 #7: 264 Buttons, 124 Chips am Desktop). Punkte/Dichte statt Chips, Details im Agenda-Panel oder bei Tipp; Chips nur ab Wochenansicht. · M · senkt · Verschönerung
20. **Dichte Badge-Reihen in Personen und Merkliste** (Audit 2 #13). Badges nur mit Bedeutung (Geburtstag in 7 Tagen, Link kaputt), Rest in die Zeile; 57 Links am Desktop in `GroupedList` nach Domain/Tag. · S · senkt · Verschönerung

### D. Verschönerung und Gefühl (Quelle 4)
21. **Leerzustände mit Charakter.** Je Modul eine kleine SVG-Illustration in Markenfarben (Clownfisch-Motiv variiert), ein Satz, der sagt, was hier mal stehen wird, der vorhandene „Startdaten einrichten“-Knopf. Kein Text mit schlechtem Gewissen. · S–M · neutral · Verschönerung
22. **Mikro-Übergänge.** Abhaken (Haken zeichnet sich, Zeile gleitet weg), Toast-Einblendung, Tab-Wechsel – nur transform/opacity, alle unter der vorhandenen Bewegungs-Einstellung und `prefers-reduced-motion`. · S · neutral · Verschönerung
23. **Haptik und leise Rückmeldung.** Kurze Vibration beim Abhaken/Speichern auf Android (Vibration-API, 10 ms), optional ein leiser Klick-Sound beim Speichern; beides unter Darstellung, Sound standardmäßig aus. · S · neutral · Verschönerung
24. **Akzent nach Tageszeit oder Jahreszeit.** Sehr dezenter Hintergrund-Verlauf (morgens kühler, abends wärmer) als wählbare Option in Darstellung; die 4 Jahreszeiten als Akzent-Sets wären ein passendes Supporter-Goodie (kosmetisch, nichts dahinter). · S–M · neutral · Verschönerung
25. **Kleine Polituren bündeln** (Visual #16 Wortmarke abgeschnitten, #18 Statustext stößt an Chevron, Testdaten-Banner nimmt am Handy 200 px → kompakter). · S · neutral · Verschönerung
26. **Abend-Moment.** „Tag abschließen“ (gibt es ab 17:00 im ToDo-Widget) bekommt einen Anlass: eine einzige optionale Benachrichtigung zu wählbarer Uhrzeit „Tag abschließen?“ (standardmäßig aus, nie mehr als eine), die direkt den Abschluss öffnet: erledigt, verschoben, morgen zuerst. Antwort auf „abends kein Grund“. · S · neutral · Fokus

### E. Komfort und Automatisierung (Quelle 5 + Inventar)
27. **Komfort-Reste Paket 9.** Die kleinen Reste aus [00-known-open §3](00-known-open.md): Home-Widget-Zeilen für Unterlagen/Vorräte antippbar (K1), Filter-Chips Rechnungen/Vorräte (K8), Abo-Preis in der Zeile, Vorräte-Schnellaktionen (K7), Accounts Kopier-Icon (K9), Unterlagen „+1 Jahr“ (K10), Merkliste Zeile öffnet Link (K15), Timer-Vorgaben 5/10/25 (K16). Viele kleine Dateien, kein Hotspot. · M · senkt · Komfort
28. **Geld-Regeln.** Kleine Regel-Engine nur im Geld-Bereich: Buchung mit Zahlungsempfänger X → Abo Y (K4) und Kategorie Z (ROADMAP M3 „category auto-rules“), Rechnung „bezahlt“ erzeugt die Buchung, „Preis erhöht“ aus dem Preisverlauf als ruhiger Hinweis (K5). Regeln entstehen aus Vorschlägen („Netflix immer als Abo zuordnen?“), nie still. · M · senkt · Automatisierung
29. **Routinen und Vorlagen.** Listen-Vorlagen jederzeit (Wocheneinkauf, Packliste Wochenende), Chips mit zuletzt genutzten Einträgen (K13); Checklisten-Vorlagen für Wiederkehrendes (Putzplan light) ohne eigenes Modul. · S · senkt · Komfort
30. **Palette-Verben pro Modul.** „bezahlt Strom“, „timer 25“, „oma anrufen morgen“ – 3–4 Verben je Modul (Entscheidung `comfort/02-plan.md` §1: nicht mehr als das). · M · neutral · Komfort
31. **Kalender: Termin per Tipp in Tag/Slot, Kalendersuche** (K11). · M · neutral · Komfort
32. **ToDos: Massenverschieben + Prioritäts-Chips** (K12). Achtung: ToDo-Seite gehört gerade `feat/focus2-today`; erst danach. · M · neutral · Komfort
33. **Budgets: Drill-down und Übertrag** (K14/M3). · M · neutral · Komfort
34. **Verknüpfungen zwischen Modulen.** Person → Geburtstag im Kalender ist da; fehlend: Termin mit Ort → „Route“-Button (K3), Rechnung → Unterlage anhängen, Abo → Account im Tresor (nur Link, keine Daten). · S–M · neutral · Komfort

### F. Aufräumen und Reifegrad (Idee des Maintainers)
35. **„In Arbeit anzeigen“-Schalter.** Ein Feld `maturity: 'stable' | 'preview'` je Modul, Werkzeug, Home-Widget und Einstellungs-Abschnitt; alles mit `preview` ist in Bibliothek, Werkzeugkasten, Palette, Home und Einstellungen ausgeblendet, bis unter Einstellungen → Erweitert „In Arbeit anzeigen“ an ist (Hinweis-Badge „In Arbeit“ daneben). Kandidaten für `preview`: KI-Chat, lokale API, Lesehilfe, In-App-Erinnerungskarte, gestaffelte Vorwarnungen, Nachfass-Erinnerung, Google-Drive-Stub, einzelne Werkzeuge nach Wahl. Nichts wird gelöscht, Daten bleiben; die Entscheidung je Feature trifft der Maintainer in einer Liste. Berührt die Hotspots Manifest-Typen, Registry, Settings-Registry – gehört genau einem Chat. Abzustimmen mit #177 (Fokus-Einstellungen gefaltet). · M · senkt stark · Komfort
36. **Doppelte Konzepte zusammenlegen** (Fokusmodus-Ring neben Zeitleiste; drei „Heute“-Blöcke) – gehört `feat/focus2-today`, hier nur der Hinweis, dass 35 sich damit abstimmen muss.

### G. Qualität und Technik (Inventar + Recherche)
37. **Kaltstart und Bundle.** Messen (Lighthouse mobil, `vite-bundle-visualizer`), dann: schwere Teile lazy (PDF-/Bild-Werkzeug, Chat, Markdown, zxcvbn-Wörterbücher ~2,5 MB nur beim Tresor), Precache-Entscheidung aus STATUS, Manifest-Import entkoppeln (Tests laden ~1200 Module je Datei – gleiche Wurzel). Ziel messbar: Handy-Kaltstart bis Eingabe < 1,5 s, Erstladen < 1 MB. · M · senkt · Technik
38. **Test-Tempo.** `resetDb`-Helfer, Vitest-Projekt „logic“ ohne Isolation für reine Logiktests, jsdom-Tests gebündelt; Ziel 237 s → unter 90 s. Blocker bekannt (WebCrypto-Realm, Dexie-Singleton). · M · neutral · Technik
39. **E2E-Flakes** (`reminders.spec.ts:89`, `newmodules.spec.ts:42`) finden, `retries: 0`, Ladereihenfolge-Rätsel `TIME_RE` mit `madge --circular`. · S–M · neutral · Technik
40. **Stumme Fehler.** `logError(tag, e)` statt ~40 `.catch(() => undefined)`, ESLint-Regel dagegen, Fehler landen in der Diagnose-Vorschau (ohne Nutzerdaten, Negativliste bleibt). · M · neutral · Technik
41. **Backup robust.** Backup in selbst gewählten Ordner (F3), Import validiert Zeilen gegen das Collection-Schema, Größenlimit und Zähler ungültiger Zeilen in der Vorschau (Launch-Review V5). Datensicherheit, nicht Krypto. · M · neutral · Technik
42. **Große Dateien und Hooks** (`ScanView`, `OnboardingWizard`, `buildApp`, Hooks aus 6 Sektionen). Für Nutzer unsichtbar; nur, wenn ein anderer Punkt dort ohnehin arbeitet. · M · neutral · Technik
43. **Doku nachziehen.** STATUS, CHATS und Nutzerdoku auf den Stand nach den Oktober-Merges (Widersprüche in [00-known-open §6](00-known-open.md)); Vorräte und KI-Chat in `user/modules.md`. · S · neutral · Technik

### H. Sicherheit (nur eigener Chat, nie abschwächen)
44. **Kleine Sicherheits-Reste.** T2 (Android-Manifest in CI prüfen), V4 (`EXTRA_IS_SENSITIVE` bei der Android-Zwischenablage), V10 (CSV-Export ohne Formel-Neutralisierung), N11 (`setErrorHandler` im Server). Alles klein, in der Cloud prüfbar. · S–M · neutral · Sicherheit
45. **Paket 7 Passwort-Gesundheit** (zxcvbn + HIBP k-Anonymität, opt-in). Einziges offenes Modulplan-Paket; UI nur in `accounts`. · M · erhöht leicht (Hinweise) · Funktion
46. **X2/X4/V2** (Pipe-Erstinstanz, Overlay-Redress, Windows-Hello-Wrapping) – nur auf Windows-Hardware prüfbar, deshalb hier nicht empfohlen. · M–L · neutral · Sicherheit

## Bewertung (ehrlich)
- **Viel Nutzen, überschaubar:** 1, 2, 7, 8, 15, 16, 35, 37. Das sind die Kandidaten, die „installiert“ zu „genutzt“ machen.
- **Viel Nutzen, teuer:** 11 (Widget). Lohnt nur, wenn 7 und 15 nicht reichen, und braucht Hardware zum Testen.
- **Nett, aber nicht jetzt:** 4 (Google Tasks lesend; zweiter Sync-Pfad), 6 (CXP ist jung), 18/19 (Kalender-Umbau, M für wenig Alltagsgewinn), 24 (Akzente), 30 (Verben), 42.
- **Klein und sofort:** 17, 20, 25, 29, 39 – Füller für einen Chat, der früher fertig ist.
- **Nicht mit aufnehmen:** 36 (gehört Audit 2), 46 (nicht prüfbar).

## Quellen (Recherche-Subagent, Oktober 2026)
Obsidian Mobile 1.14 Changelog (Erfassen vom Sperrbildschirm) · TechCrunch zu Todoist Ramble (Sprechen → mehrere Aufgaben) · Joplin 3.7 Releases (KI nur lokal und auf Wunsch) · Actual Budget 26.8 und Import-Doku (Handy-Parität, OFX gegen Doppelte) · Loop Habit Tracker (Stärke statt Serie) · Obsidian-Forum „fast capture“ · Indie-Hackers-Bericht zum nativen Widget (Erfassen und Ordnen trennen, Offline-Warteschlange) · TasksBoard zum Google-Tasks-Export (nur Takeout, kein Re-Import) · Android Authority zu Notion offline · TechCrunch zu lokalen Modellen in iOS-26-Apps · `tauri-plugin-widgets` auf docs.rs · Bitwarden zu CXP · MagicBell zu PWA-Grenzen auf iOS · dev.to „no streaks“ (Herstellerblog, schwach belegt).
Links: obsidian.md/changelog/2026-10-05-mobile-v1.14.4 · techcrunch.com/2026/01/21/todoists-app-now-lets-you-add-tasks-to-your-to-do-list-by-speaking-to-its-ai · releasebot.io/updates/joplin/joplin · actualbudget.org/blog/release-26.8.0 · actualbudget.org/docs/transactions/importing · github.com/iSoron/uhabits · forum.obsidian.md/t/fast-capture-shortcut/94911 · indiehackers.com/post/built-a-home-screen-widget-because-my-own-app-was-too-slow-for-my-own-ideas-240a527d08 · tasksboard.com/blog/google-tasks-export-guide · androidauthority.com/notion-offline-mode-vs-obsidian-3590238 · techcrunch.com/2025/10/03/how-developers-are-using-apples-local-ai-models-with-ios-26 · docs.rs/tauri-plugin-widgets · bitwarden.com/resources/july-2026-spotlight-your-passkeys-can-now-move-freely-heres-how · magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · dev.to/nucleusos/adhd-support-app-no-streaks-why-gamification-hurts-more-than-it-helps-1ae0
