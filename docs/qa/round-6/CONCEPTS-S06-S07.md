# UI schärfen, Runde 6 – Konzeptvorschläge zu S06/S07

Teil von [FINDINGS.md](FINDINGS.md). Eigene Pakete nach dieser Runde; nichts davon ist UI-Kosmetik.

**S06 – mehr in Haushalt, Wissen, Tresor** (Ideen aus [ROADMAP](../../ROADMAP.md) „Module“ + Lücken, die die Tour zeigt). Je Modul: Manifest-Identität, Widget, Seed, Onboarding wie in [howto/new-module.md](../../howto/new-module.md).

| Bereich | Vorschlag | Warum | Verbindet | Aufwand |
| --- | --- | --- | --- | --- |
| Haushalt | **Zählerstände** (Strom, Wasser, Gas, Heizung; Verbrauch je Monat, Erinnerung zum Ablesen) | Seed hat schon „Zählerstand ablesen“ als Erinnerung; echter Alltagsfall, lokal, keine Netzpflicht | Kalender (Erinnerung), Finanzen (Abschlag), Widget `kennzahl` | M |
| Haushalt | **Mahlzeiten & Rezepte** (Wochenplan, Rezept → Zutaten auf die Einkaufsliste, Vorräte abhaken) | Schnellerfassung kennt „Mahlzeit“ bereits, Vorräte + Einkauf warten auf den Verbinder | Listen, Vorräte, Fitness (Essen) über Event-Bus | L |
| Haushalt | **Putzplan / wiederkehrende Hausarbeit** (Rotation, Raum, Intervall; ruhig: kein Rückstand-Zähler) | häufigster Wunsch in Familien-Personas (Mia), ToDo-Wiederholung reicht nicht (Räume, Wechsel) | ToDos (Quelle), Planer | M |
| Haushalt | **Fahrzeug** (Tanken, Verbrauch, TÜV/Service, Kilometer) | ROADMAP-Idee; Schnellerfassung „Tanken 62,40“ landet heute nur in Finanzen | Finanzen (Buchung), Kalender (TÜV), Unterlagen (Papiere) | M |
| Wissen | **Journal / Tagebuch** (ein Eintrag je Tag, Stimmung optional, Rückblick-Ansicht aus) | ROADMAP-Idee; Notizen sind Seiten, kein Tagesrhythmus | Notizen-Editor wiederverwenden, Gewohnheiten (ruhig) | M |
| Wissen | **Snippets & Zwischenablage** (Textbausteine, Verlauf ohne Passwörter, Desktop) | ROADMAP-Idee; Werkzeug „Text“ hat keinen Speicher | Werkzeugkasten, `accounts` ausgeschlossen (Exclusion-Test) | M |
| Wissen | **Lernkarten** (Spaced Repetition, Deck aus Notizen) | einziges „Lernen“-Angebot fehlt im Bereich Wissen | Notizen (Quelle), Kalender (Wiederholung) | M |
| Tresor | **Sichere Notizen** (verschlüsselte Notizen im Passwort-Tresor: PINs, Lizenzen, Antworten auf Sicherheitsfragen) | Standard in Passwort-Managern; heute nur Zugangsdaten + TOTP | `accounts` (gleiche Krypto, kein neuer Vertrag) | S–M |
| Tresor | **Notfallzugang** (verschlüsselter Export mit zweiter Passphrase, ROADMAP S4) + **Passwort-Gesundheit** sichtbar (S1 gebaut, HIBP offen) | Familienfall, Vertrauensthema | Backup-Format unverändert | M |
| Tresor | **Dokumenten-Fristen aus Unterlagen in „Jetzt wichtig“** (bereits teils da) + Ausweis-Ablauf mit Foto-Vorschau | Unterlagen hat 34 Einträge, aber die Fristen sind nur Badges | Unterlagen, Kalender | S |

Empfehlung: zuerst Zählerstände (Haushalt), Journal (Wissen), Sichere Notizen (Tresor) – klein, lokal, ohne neuen Vertrag; Mahlzeiten als Paket mit Stopp danach.

**S07 – Dieser PC** (Rust-Anteil: Crates `disk-scan`, `system-info`; Guard `guard.rs` und zweite Bestätigung bleiben unangetastet).

| Paket | Inhalt | UI | Rust |
| --- | --- | --- | --- |
| D1 Aufräumen-Vorschläge | Karte „Aufräumen“ auf der Laufwerke-Seite: Papierkorb, Downloads älter als 30 Tage, Temp/Caches (Windows Temp, Browser-Caches, Thumbnails), alte Installer (`*.exe/*.msi` > 100 MB, > 90 Tage), Dubletten (vorhanden) – je Kategorie Größe, „Ansehen“, Löschen nur über den bestehenden Plan (Papierkorb, Blockliste) | neue Sektion `components/CleanupCard`, Progress-Widget-Variante | Kategorie-Scanner als Command (nur Lesen), Löschen über den bestehenden Plan |
| D2 Systeminfo | Reiter „System“ ausbauen: CPU/GPU/RAM-Modell, Platten-Modell + SMART-Zustand (wenn lesbar), OS-Version, Betriebszeit, Akku-Gesundheit, Netzwerkname (nur Anzeige), Autostart-Liste (nur Anzeige, ROADMAP) | `SystemTab` mit `KennzahlBody`/`GaugeList`, Kopf-Figur „38 GB frei · 12 GB aufräumbar“ | `system-info` erweitern (statische Infos einmal lesen) |
| D3 Scan-Verlauf & Übersicht | Scan-Ergebnis je Laufwerk merken (nur Größen je Top-Ordner, keine Pfade unter Nutzerverzeichnis im Sync): „Seit letztem Scan +8 GB in Downloads“; größte Dateien global; Ordner beobachten; Liste exportieren (CSV) | Verlauf-Zeile je Laufwerkskarte, Delta im Treemap | Snapshot-Datei im App-Datenordner |

Empfehlung: D1 zuerst (Svens „mehr Optionen zum Bereinigen“), dann D2; D3 nur, wenn D1 gut ankommt.
