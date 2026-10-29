# QA-Bericht: Tom, Sysadmin (misstrauisch)

## Kopf

- **Persona:** Tom, 27, Systemadministrator. Misstraut jeder App, will Netzwerk, Dateiablage, KI-Payload, Backup-Inhalt und Tresor-Sperre selbst nachprüfen. Probiert absichtlich kaputte Eingaben, manipulierte Backups, Offline, falsche Uhr, zwei Geräte.
- **Plattformen:** Browser/PWA auf Desktop (Chromium, 1280×800) und Handy-Viewport 412×915 sowie 320×640; lokaler Sync-Server (Node). Nicht getestet: Windows-exe, Android-APK (Download von GitHub über den Sandbox-Proxy mit 401 abgelehnt), Browser-Erweiterung, lokale Schnittstelle, Biometrie, Web-Push. Das gilt es vor einer Gesamtaussage nachzuholen.
- **Build:** Nemo 1.0.0, `develop` @ `4af432d`. Drei Zustände: (1) Vite-Dev-Server im Stable-Flavour, frische Datenbank; (2) Dev-Preview-Flavour mit Testdaten `medium`; (3) Produktions-Build (`vite build` + `preview`) mit Service Worker.
- **Datum:** 2026-10-29. **Dauer:** rund 1 Stunde 10 Minuten reine Testzeit.
- **Methode:** Playwright mit Netzwerklog, IndexedDB-/localStorage-Dumps, ein Mock-KI-Server auf `localhost:9999`, der jede Anfrage mitschreibt, ein lokaler Sync-Server, `curl` gegen dessen API. Alle Daten sind erfunden.

**Ergebnis in einem Satz:** Die Kernversprechen (nichts verlässt das Gerät ohne Zutun, KI sieht keine Daten, Tresor ist verschlüsselt) haben im Test gehalten. Ich habe keinen Blocker und keinen hohen Fund. Gefunden habe ich 5 mittlere Fehler, 12 niedrige und 10 Verbesserungen. Der wichtigste Widerspruch: der Einrichtungsassistent tastet ungefragt `localhost:11434` ab, obwohl der Datenschutztext „nichts ohne deinen Klick“ sagt.

Kritische Funde („vertraulich, zuerst Sven“) gibt es keine. F-05 ist ein Verfügbarkeitsproblem im Sync-Server und als Sicherheitsthema markiert; es erlaubt keinen Datenzugriff.

---

## Fehler

Zähler: blocker 0 · hoch 0 · mittel 5 · niedrig 12.

### F-01 · mittel · Setup-Schritt „KI-Anbieter“ fragt ungefragt `localhost:11434` ab
- **Reproduktion:** 1. Frische Installation öffnen. 2. Netzwerklog mitschreiben. 3. „Einrichtung starten“, bis Schritt 5 „KI-Anbieter“ mit „Weiter“ gehen, nichts anklicken.
- **Erwartet:** Der Text unter Über Nemo → Rechtliches sagt: „nichts davon passiert ohne dein Einrichten oder deinen Klick, außer der Update-Abfrage und dem Währungsrechner“. Ein Eintrag zu lokalen Ports fehlt.
- **Tatsächlich:** Beim Betreten des Schritts gehen zwei `GET http://localhost:11434/api/tags` raus (Suche nach Ollama). In der Konsole steht `ERR_CONNECTION_REFUSED`. Das bleibt auf dem eigenen Rechner, ist aber unangekündigt. Im Produktions-Build habe ich den Assistenten nicht erneut durchlaufen.
- **Häufigkeit:** immer. **Plattform:** Web. **Screenshot:** `screenshots/setup-step4.png`

### F-02 · mittel · Kalender-Abo hängt auf „Wird geprüft …“
- **Reproduktion:** 1. Einstellungen → Verbindungen. 2. `https://example.invalid/cal.ics` eintragen, „Kalender hinzufügen“. 3. 25 Sekunden warten, mit und ohne verbundenem Sync-Server.
- **Erwartet:** Fehler oder Timeout; ohne Sync-Server der Hinweis, dass der Browser einen Proxy braucht.
- **Tatsächlich:** Dauerhaft „Wird geprüft …“, im Netzwerklog keine einzige Anfrage. Außerdem lässt die Prüfung `http://127.0.0.1:8788/v1/health` und `http://169.254.169.254/…` durch, obwohl die Fehlermeldung nur `https://` oder `webcal://` nennt. Ob der Sync-Server-Proxy solche Ziele abweist, konnte ich so nicht prüfen, weil nie eine Anfrage entstand.
- **Häufigkeit:** immer. **Plattform:** Web. **Screenshot:** `screenshots/ics-haengt.png`

### F-03 · mittel · „Zuletzt benutzt“ speichert Fragen im Klartext, nicht löschbar
- **Reproduktion:** 1. Suche öffnen, `mein passwort ist hunter2-geheim` eingeben, Enter. 2. Suche erneut öffnen: Der Satz steht unter „Zuletzt benutzt“. 3. `localStorage` → `tm-recent-search` enthält ihn im Klartext. 4. Einstellungen → KI → „KI abschalten“ bestätigen.
- **Erwartet:** Verlauf abschaltbar oder löschbar; „KI abschalten“ räumt KI-Fragen weg.
- **Tatsächlich:** Der Verlauf bleibt, eine Löschfunktion habe ich nirgends gefunden. Er ist nicht im Backup. Nur „Gerät zurücksetzen“ entfernt ihn (geprüft). Nutzer tippen Geheimnisse in solche Felder.
- **Häufigkeit:** immer. **Plattform:** Web (Dev-Preview). **Screenshot:** `screenshots/suche-verlauf.png`

### F-04 · mittel · Klartext-Backup: Manipulation wird nicht erkannt
- **Reproduktion:** 1. Sync & Backup → „Backup herunterladen“. 2. In der Datei (a) einen Tresor-Eintrag auf `v1.AAAA.BBBB` setzen, (b) eine Modul-ID durch `<img src=x onerror=…>` ersetzen, (c) `createdAt` auf `1e999` setzen. 3. Datei wählen → „Backup prüfen“ → „Importieren“.
- **Erwartet:** Warnung oder Prüfsumme.
- **Tatsächlich:** Alle drei: „Das Backup ist in Ordnung“, „Prüfsumme (SHA-256): –“. Der Import läuft durch, kein Absturz, kein Skript wird ausgeführt. Ein kaputter Tresor-Eintrag wird als gesund gemeldet (nach dem Import wäre er beim Entsperren unlesbar). Das verschlüsselte Backup erkennt dieselbe Manipulation („Die Prüfsumme stimmt nicht“), das ist gut.
- **Häufigkeit:** immer. **Plattform:** Web. **Screenshots:** `screenshots/tamper-08-corrupt-vault-entry.png`, `tamper-09-html-module-id.png`, `tamper-10-bad-timestamps.png`

### F-05 · mittel · Sync-Server: Rate-Limit pro IP sperrt auch das gültige Token — vertraulich, zuerst Sven
- **Reproduktion:** 1. Server mit Token starten. 2. 30 Anfragen mit falschem Bearer-Token an `/v1/status` (ab der 14. kommt 429). 3. Sofort danach mit dem richtigen Token anfragen.
- **Erwartet:** Brute-Force gebremst, der Eigentümer nicht ausgesperrt.
- **Tatsächlich:** Auch das gültige Token bekommt 429 (`retry-after` ca. 36 s, nach etwa 60 s wieder frei). Hinter einem Reverse-Proxy teilen sich alle Clients eine IP; im LAN kann jeder Gast den Sync für alle anhalten. Daten sind dabei nicht erreichbar. Außerdem: `/v1/health` ist ohne Token offen (ok), jede Antwort trägt `access-control-allow-origin: *` (ok bei Bearer-Token, aber auffällig), 404-Seiten verraten Fastify-Routen.
- **Häufigkeit:** immer. **Plattform:** Server. **Screenshot:** keiner (curl).

### F-06 · niedrig · Einstellungs-Navigation: „Benachrichtigungen“ überlappt „Nicht erlaubt“
- 1. Einstellungen öffnen, 1280×800. Beide Texte liegen übereinander. Immer. Web. `screenshots/import-10-bad-timestamps.png` (links im Bild).

### F-07 · niedrig · Tresor-Detailspalte schneidet lange Werte rechts ab
- 1. Zugang mit langem Benutzernamen und 200 Zeichen Notiz anlegen. 2. Öffnen, 1280 px. Text läuft aus der Karte, abgeschnitten. Immer. Web. `screenshots/tresor-detail.png`

### F-08 · niedrig · Gesperrtes Sync-Gerät zeigt zusätzlich „Dieser Server kennt keine Geräteverwaltung (ältere V…)“
- 1. Zwei Geräte am Server. 2. Auf A Gerät B „Sperren“. 3. Auf B „Jetzt synchronisieren“. Erwartet: nur „Dieses Gerät wurde gesperrt“. Tatsächlich zusätzlich der irreführende Satz über eine alte Server-Version. Immer. Web. `screenshots/sync-gesperrtes-geraet.png`

### F-09 · niedrig · Schreiben per KI ist aus: Fehlermeldung hilft nicht
- 1. Anbieter einrichten, „Einträge per KI vorschlagen“ auf Aus lassen. 2. Suche: „Lösche bitte alle Aufgaben mit Recherche und lege eine Notiz an“. Erwartet: Hinweis, dass Schreiben aus ist. Tatsächlich: „Diese Frage konnte ich nicht sicher zuordnen. Bitte anders formulieren.“ Umformulieren hilft nie. Immer. Web. `screenshots/ki-schreiben-aus.png`

### F-10 · niedrig · Regelparser macht aus dem Satz einen verstümmelten Titel
- 1. Schreiben einschalten. 2. „Räum bitte die Aufgabe Recherche weg und notiere dir etwas Neues, danke“. Vorschlag „Aufgabe anlegen“ mit Titel „Räum bitte die Recherche weg und dir etwas danke“ (0 Token, lokal). Es braucht „Eintragen“, nichts geht verloren. Immer. Web. `screenshots/ki-schreiben-an.png`

### F-11 · niedrig · Modul „Beispiel“ (Tag „Entwickler“) im Stable-Build sichtbar
- 1. Frische Installation, Modul-Bibliothek oder Setup-Schritt 3. Der Eintrag „Referenzmodul aus dem Generator … Testträger“ steht neben echten Modulen. Immer. Web. `screenshots/modul-bibliothek.png`

### F-12 · niedrig · Spotify-Hinweis wiederholt den Kalender-Satz
- Setup-Schritt 6 oder Verbindungen: Unter Spotify steht „…kommen die Termine über die Synchronisierung oder über ein Kalender-Abo (ICS)“. Passt nicht zu Spotify. Immer. Web. `screenshots/settings-verbindungen.png`

### F-13 · niedrig · Vorab-Sicherheitskopie ist ein stiller Download
- 1. Backup einspielen. Der Text sagt „legt die App automatisch eine Sicherheitskopie an“. Im Browser startet ein Download `pre-restore-20261029-011631.json` in den Downloads-Ordner. Ob er verschlüsselt ist, steht nirgends. Immer. Web. `screenshots/restore-Zusammenführen.png`

### F-14 · niedrig · Steuerzeichen U+202E (Rechts-nach-links) in Titeln erlaubt
- 1. ToDo „U+202E evil-rtl.txt“ anlegen. Der Titel erscheint gespiegelt. Spoofing-Möglichkeit, gering. Immer. Web. `screenshots/todos-sonderzeichen.png`

### F-15 · niedrig · Einmal erschien ein Zugang doppelt (nicht reproduzierbar)
- 1. Zugang „Router <img …>“ mit 200-Zeichen-Notiz und `javascript:`-Website einmal speichern. 2. Liste: zwei Zeilen, zwei Datenbankeinträge. Spätere Einzelspeicherungen (auch mit gleichen Feldern) erzeugten keine Duplikate. Einmal. Web. `screenshots/tresor-detail.png`

### F-16 · niedrig · „Änderungen dieser Version“ ist leer
- Über Nemo → Updates und Änderungen: Überschrift ohne Inhalt. Immer. Web. `screenshots/settings-ueber.png`

### F-17 · niedrig · Konsolenwarnung „No routes matched location“
- Beim ersten Laden und beim Neuladen von `/settings/ueber` zwei Warnungen. Nur im Dev-Server gesehen, optisch ohne Folgen.

---

## Verbesserungen

| ID | Nutzen | Titel |
|---|---|---|
| V-01 | hoch | Verbindungsprotokoll in der App |
| V-02 | hoch | Schwache Master-Passwörter nicht stillschweigend akzeptieren |
| V-03 | hoch | Klartext-Backup abgrenzen, Verschlüsselt als Standard |
| V-04 | mittel | Warnung bei `http://` an nicht-lokale Sync-Adressen |
| V-05 | mittel | Suchverlauf abschalten und löschen |
| V-06 | mittel | Sync-Server: Limit pro Token statt nur pro IP |
| V-07 | mittel | Experten-Weg durch die Einrichtung |
| V-08 | mittel | Zusammenfassung der Tresor-Sicherheit lesbar |
| V-09 | niedrig | Sicherheitskopie vor Wiederherstellung ankündigen |
| V-10 | niedrig | Diagnose-Vorschau und Datei in derselben Sprache |

**V-01 · hoch · Verbindungsprotokoll in der App.** *Situation:* Tom will prüfen, ob die Datenschutzversprechen stimmen, ohne Wireshark. *Heute:* Die Aussage steht nur als Text; der unbemerkte Ollama-Zugriff (F-01) zeigt, dass Text und Verhalten auseinanderlaufen können. *Vorschlag:* Unter Einstellungen → Verbindungen eine lokale Liste mit Zeitpunkt, Ziel-Host, Anlass („Währungsrechner geöffnet“) und Datenmenge, nie Inhalt. Dazu ein Schalter „Netzwerk komplett sperren“. *Nutzen:* hoch. Bleibt lokal, nichts wird gesendet, passt zu Local-First. *Anregung:* Little Snitch, Datenschutzbericht in iOS.

**V-02 · hoch · Schwache Master-Passwörter.** *Situation:* Tom tippt beim Anlegen aus Bequemlichkeit `1234567890`. *Heute:* Nur 10 Zeichen sind Pflicht; „Stärke: Sehr schwach · Offline-Knackzeit ca. weniger als eine Sekunde“ erscheint, „Tresor erstellen“ geht trotzdem. *Vorschlag:* Bei „schwach“ eine zusätzliche Bestätigung („in Sekunden knackbar, trotzdem verwenden?“) und ein Vorschlag aus mehreren Wörtern. Kein Zwang. *Nutzen:* hoch, der Tresor ist nur so stark wie dieses Passwort. *Anregung:* Bitwarden.

**V-03 · hoch · Klartext-Backup abgrenzen.** *Situation:* Backup auf den NAS. *Heute:* Zwei Knöpfe nebeneinander; die Klartextvariante hat keine Prüfsumme (F-04). *Vorschlag:* „Verschlüsselt exportieren“ als Standard, Klartext als „Ohne Schutz speichern“ mit Prüfsumme und dem Hinweis, dass Manipulation nicht erkennbar ist. *Nutzen:* hoch.

**V-04 · mittel · `http://`-Warnung beim Sync.** *Situation:* `http://192.168.x.y:8787` eingetragen. *Heute:* Keine Warnung in der App (geprüft: weder bei localhost noch bei LAN-IP), nur die Doku sagt „nutze HTTPS“. *Vorschlag:* Hinweis unter dem Adressfeld: „Das Token geht unverschlüsselt über das Netz. Nutze HTTPS (z. B. Tailscale)“, nicht bei localhost. *Nutzen:* mittel.

**V-05 · mittel · Suchverlauf löschbar.** *Heute:* Klartext in localStorage, kein Löschen (F-03). *Vorschlag:* „Verlauf löschen“ in der Suche, Einstellung „Verlauf nicht speichern“, KI-Fragen nie in den Verlauf. *Nutzen:* mittel.

**V-06 · mittel · Limit pro Token.** *Situation:* Server hinter Traefik. *Heute:* Fehlversuche sperren alle (F-05). *Vorschlag:* Gültige Tokens vom Limit ausnehmen oder Limit pro Token, `X-Forwarded-For` nur per Option, Doku-Satz. *Nutzen:* mittel (hoch für Selbsthoster).

**V-07 · mittel · Experten-Weg durch die Einrichtung.** *Situation:* Tom will in zwei Minuten fertig sein. *Heute:* 12 Schritte, auf jedem „Überspringen“ oder „Weiter“ (11 Klicks). *Vorschlag:* Auf jedem Schritt „Rest später, zur Übersicht“. Die Checkliste bleibt. *Nutzen:* mittel, ohne die Fokus-Richtlinien zu berühren.

**V-08 · mittel · Tresor-Sicherheitszeile lesbar.** *Heute:* Einstellungen → Sicherheit zeigt „Accounts: Felder: 5 Minuten · Sofort · Dieselbe Domain (login.beispiel.de passt zu beispiel.de) · + 2“. Erst nach „Ändern“ sieht man „Tresor sperren nach Inaktivität: 1/5/15/30 Minuten“. *Vorschlag:* Ausgeschrieben: „Sperrt nach 5 Min Inaktivität, im Hintergrund sofort“. *Nutzen:* mittel.

**V-09 · niedrig · Sicherheitskopie ankündigen.** Im Vorschau-Text nennen, dass `pre-restore-….json` in Downloads landet, und eine verschlüsselte Variante anbieten (F-13).

**V-10 · niedrig · Diagnose-Sprache.** Der Rahmen der Vorschau ist Deutsch, die Datei komplett Englisch. Beides gleich oder ein Hinweis.

*Widerspricht Grundsatz:* nichts, was ich vorschlage, verlangt Cloud, Tracking oder Druck. V-01 sendet selbst nichts.

---

## Was gut ist (bitte nicht wegoptimieren)

1. **Wirklich offline-fähig.** Produktions-Build: nach dem ersten Laden und Service-Worker-Aktivierung null externe Anfragen (5 s Beobachtung, Netzwerklog leer). Offline neu geladen: App läuft, ToDos und Einstellungen öffnen.
2. **KI-Versprechen hält.** Mit Mock-Anbieter gemessen: Die Anfrage enthält nur Datum, Frage, Modul-/Feldschema und Werkzeugdefinitionen. Kein ToDo-Titel, keine Person, kein Termin, kein Tresor. Ergebnisse lokaler Abfragen werden nicht zurückgeschickt (nur eine Anfrage, keine Folge-Runde). Der Tresor kommt im Schema nicht vor.
3. **Einwilligung vor der ersten KI-Anfrage.** Der Dialog „Dein KI-Anbieter erhält gleich eine Anfrage“ nennt, was gesendet wird, und warnt vor Geheimnissen im Freitext. Der Testaufruf („ping“) sendet keine Nutzerdaten.
4. **Tresor.** IndexedDB zeigt nur `v1.…`-Chiffretext, Argon2id (64 MiB, t=3). Nach Neuladen gesperrt; „Sperren“ entfernt Inhalte aus dem DOM; Suche und Befehlspalette finden Tresor-Einträge nicht. Falsche Passwörter werden gedrosselt. HTML in Name/Benutzer/Notiz wird escaped, `javascript:`-Website lässt sich nicht öffnen. Auto-Sperre (1 bis 30 Min, Hintergrund sofort/30 s) existiert und ist über die Einstellungssuche auffindbar.
5. **Alle Eingaben escaped.** `<img onerror>`, `<script>`, `{{…}}`, `${…}`, SQL-Muster, Nullbyte, 100.000 Zeichen, 300 Emojis in ToDos, Tresor, KI-Antwort und Modul-ID: kein Skript lief, kein Layout-Überlauf, Seite blieb benutzbar (328 ToDos, Neuladen 0,8 s).
6. **Backup-Prüfung mit Probe-Restore und Vorschau** („9 kommen dazu, 0 werden ersetzt, 0 gelöscht“). Verschlüsselt: Argon2id, Prüfsumme, manipulierte Datei und Argon2-Parameter-Bomben (4 GiB, t=99) werden abgelehnt, ohne zu hängen. Kaputte Dateien: verständliche Meldungen („keine gültige JSON-Datei“, „neuere App-Version“). Ersetzen warnt: „auch auf anderen Geräten gelöscht“.
7. **Sync.** Ende-zu-Ende ist standardmäßig an; auf dem Server liegen nur `enc:v1:…`-Werte, Sammlungs- und Feldnamen sowie IDs (so dokumentiert). Falsche Passphrase und zu kurze Passphrase werden verständlich abgelehnt. Eine um 3 Jahre vorgestellte Uhr wird klar gemeldet („Die Uhr dieses Geräts geht mehr als eine Stunde vor“) und der Server lehnt die Stempel ab. Gerät sperren funktioniert.
8. **Gerät zurücksetzen** ist zweistufig bestätigt und gründlich: Datenbank, localStorage (inkl. Suchverlauf), Service Worker weg.
9. **Diagnose-Export** zeigt vorher den kompletten Dateiinhalt und enthält nachweislich weder Server-Adresse, Token, Gerätenamen noch Titel.
10. **Regex-Tester bricht `(a+)+$` auf 40 Zeichen nach 1 Sekunde ab** („Muster zu aufwendig“), die Seite bleibt bedienbar.
11. **Oberfläche:** Handy-Layout ohne Seitenüberlauf bis 320 px, Sprachwechsel auf Englisch ohne deutsche UI-Reste (nur Nutzerdaten bleiben Deutsch), Quick-Capture parst „morgen 09:00“ korrekt zu 2026-10-30 09:00.

---

## Verständnis

| Wo | Was Tom nicht verstand | Vorschlag |
|---|---|---|
| Erinnerungsglocke | „Weitere Erinnerungen · 3“ ohne Namen; „Noch offen: Medikament nehmen“ (offen seit gestern?); Knopf „Zufällige Erinnerung“ | Beschriftung „3 weitere heute“ mit Aufklappen; für „Zufällige Erinnerung“ einen Satz Erklärung |
| Setup Schritt 9 „Benachrichtigungen“ | Steht „Abgelehnt. Der Schritt bleibt in der Checkliste.“, ohne dass er etwas abgelehnt hätte, und ohne Knopf zum Erlauben (im Headless-Browser) | Zustand „Nicht erlaubt“ neutral nennen und Erlauben anbieten |
| Sicherheit | Zeile „Felder: 5 Minuten · Sofort …“ (siehe V-08) | ausschreiben |
| Tresor | „Import, Export & Sicherheit“ enthält Master-Passwort ändern, Biometrie, CSV-Export. „Sicherheit“ klingt nach Einstellungen | „Mehr“ oder zwei Knöpfe: „Import/Export“, „Master-Passwort“ |
| Sync-Seite | „Konflikte: der überschriebene Wert steht hier und lässt sich wiederherstellen“: verständlich, aber ohne Beispiel; ich konnte keinen Konflikt erzeugen | Beispiel in einem Satz |
| Backup | „Backup-Datei“ ist ein nacktes Dateifeld; „Ersetzen“ vs. „Zusammenführen“ klar, aber „Das Backup wird zum Stand“ ist schwer zu lesen | „Danach ist alles genau wie im Backup“ |
| Einstellungen | „Stumm“ (1 Stunde/Bis morgen) steht ganz oben neben Farbschema, wirkt wie Lautstärke | „Benachrichtigungen pausieren“ |
| Wizard Schritt 6 „Konten verknüpfen“ | Text „Hole Termine und Vorschläge aus Diensten ein“ (ungewöhnliches Deutsch) | „Hol dir Termine aus Diensten, die du schon nutzt“ |
| Diagnose | Vorschau Deutsch, Datei Englisch | siehe V-10 |

---

## Tagesurteil

**Ein Tag mit Nemo (Dev-Preview, Testdaten `medium`):** Morgens Übersicht („Jetzt wichtig“, „Heute“, 3 Dinge) → 1 Blick. Drei Erfassungen über „Neu“: je 3 Klicks plus Tippen (Neu → Art → Text → Speichern; ToDo, Notiz „Switch-Port 12 hat CRC-Fehler“, Erinnerung „Zertifikat verlängern morgen 09:00“), jede mit „Rückgängig“-Toast. Die Erinnerung landete korrekt am 30.10. um 09:00. Abends Übersicht erneut. Tom würde die App **etwa 3-mal am Tag** öffnen, nicht öfter: Sie ist für ihn ein Fristen- und Notizbuch, kein Dauerbegleiter. Die Glocke mit orangener „12“ (seeded) wirkt wie ein ungelesener Zähler; bei echter Nutzung ist das vermutlich ruhiger. Zu den Fokus-Richtlinien: keine Schuldtexte oder Streaks gesehen.

**Würde Tom weiter nutzen?** Ja, im Browser/als PWA zum Testen, mit der Einschränkung, dass er Tresor und KI vorerst nicht für echte Daten nutzt, bis die exe und die APK von ihm selbst geprüft sind (Signatur, Berechtigungen, Netzwerk der exe). Dafür sprechen: Die messbaren Versprechen halten, Fehlermeldungen sind gut, Backup-Vorschau und Diagnose-Vorschau sind vorbildlich.

**Der eine Grund zum Deinstallieren:** Ein weiteres Verhalten, das dem eigenen Datenschutztext widerspricht, ohne dass er es im Text findet. F-01 ist bereits so ein Fall (klein, lokal). Passiert das noch einmal mit einer externen Adresse, ist die App für ihn weg. V-01 (Verbindungsprotokoll) würde ihm das Vertrauen geben, das er sonst nur mit Wireshark bekommt.

## Nicht getestet

Windows-exe (SmartScreen, `%LOCALAPPDATA%`, Updates mit Signaturprüfung, lokale Schnittstelle, Disk-Modul, Tray, Hotkeys), Android-APK (Berechtigungen, Screenshot-Schutz, Biometrie, Teilen-Menü), Browser-Erweiterung (Native Messaging), Web-Push, Docker-Image des Servers inkl. ausgelieferter PWA und deren Header, zwei gleichzeitige Instanzen auf demselben Profil, Abbruch mitten im Backup-Import, Konflikt-Wiederherstellung im Sync (kein Konflikt erzeugt), Google/Spotify-Verbindung, Wetter-Abfrage, Währungsrechner-Netzwerkverkehr.
