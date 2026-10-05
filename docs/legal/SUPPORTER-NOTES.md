# Supporter mode – Checkliste für Sven (kein Rechtsrat)

Nur eine Gedächtnisstütze, keine Rechtsberatung. Bei Unsicherheit eine Steuer- oder Rechtsberatung fragen. Technik: [howto/supporter.md](../howto/supporter.md).

## 1. Zahlungsseite (Ko-fi / Buy Me a Coffee)
- [ ] Impressum bzw. Anbieterkennzeichnung und Kontakt auf der Zahlungsseite, nicht nur im Repo.
- [ ] Formulierung: „freiwillige Unterstützung, kosmetische Extras als Dankeschön“. Kein Kaufangebot, keine Funktion hinter der Zahlung, kein Anspruch auf Extras „für immer“.
- [ ] Prüfen: Ob eine Spende mit Gegenleistung (Extras) steuerlich oder verbraucherrechtlich wie ein Verkauf digitaler Inhalte behandelt wird (Widerruf, Gewährleistung). Im Zweifel klären lassen und den Text danach ausrichten.
- [ ] Link zur Datenschutzerklärung auf der Seite und im Mail-Fuß.

## 2. Steuern
- [ ] Einnahmen aus Spenden erfassen (Zahlungsanbieter-Auszug, Gebühren, Belege aufheben).
- [ ] Einordnung klären: Einkommensteuer, Umsatzsteuer bzw. Kleinunternehmerregelung (§ 19 UStG), Gewerbe ja/nein; Anmeldung beim Finanzamt, falls nötig.
- [ ] Beträge nur beim Anbieter und in deiner Buchhaltung, nie in der App (die App kennt nur die Stufe).

## 3. Datenschutz beim Mailversand
- [ ] **Zweck:** Zustellung des Supporter-Codes an die beim Anbieter hinterlegte Adresse. **Rechtsgrundlage** prüfen (z. B. Art. 6 Abs. 1 lit. b oder f DSGVO).
- [ ] **Speicherdauer:** die Mail-Adresse liegt nur kurz in der Mail-Warteschlange des Dienstes (Free-Plan: höchstens 24 Stunden), danach nirgends im Klartext. Dauerhaft nur Hashes (Transaktions-ID, Mail) und ein Zähler, laut Entwurf 400 Tage.
- [ ] **Empfänger / Auftragsverarbeiter:** Zahlungsanbieter, Cloudflare (Dienst), Resend (Mailversand). Auftragsverarbeitungsverträge und Drittlandübermittlung (Standardvertragsklauseln) prüfen und im Datenschutzhinweis nennen.
- [ ] **Namen:** nur mit Zustimmung (öffentliche Spende bei Ko-fi), höchstens 20 Zeichen, im Code selbst gespeichert, daher nicht widerrufbar: im Hinweis sagen, dass ein Name einen neuen Code braucht.
- [ ] **Löschkonzept:** Eintrag über die Transaktions-ID löschbar (Hash neu berechnen, KV-Eintrag entfernen); Betroffenenanfragen per Kontaktadresse beantworten. Auf Anfrage neuen Code ohne Namen ausstellen.
- [ ] Datenschutzhinweis (Zweck, Speicherdauer, Anbieter, Rechte) auf der Zahlungsseite, in der Mail und im Repo (`SECURITY.md`/README-Link) verlinken.
- [ ] In den Logs des Dienstes stehen keine Mail-Adressen, Namen oder Codes (abgesichert durch `test/logs.test.ts` im Dienst; Cloudflare und Resend führen eigene Logs, siehe deren Datenschutzangaben).

## 4. Textbausteine (anpassen)
- Zahlungsseite: „Nemo ist kostenlos. Wer mag, unterstützt die Entwicklung freiwillig und bekommt als Dankeschön einen Code für kosmetische Extras (Danke-Abzeichen, Farbthemen). Alle Funktionen bleiben für alle offen.“
- Mail: Dank, Code, Eingabe unter „Einstellungen → Über Nemo → Supporter“, Hinweis „alles freiwillig“, Kontakt bei Problemen.
