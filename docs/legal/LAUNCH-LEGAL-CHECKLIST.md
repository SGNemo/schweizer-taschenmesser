# Launch – rechtliche Checkliste für Sven (kein Rechtsrat)

Gedächtnisstütze vor dem Launch, keine Rechtsberatung. Bei Unsicherheit Rechts- oder Steuerberatung fragen. Daten und Flüsse: [DATA-FLOWS.md](DATA-FLOWS.md); Supporter/Ko-fi im Detail: [SUPPORTER-NOTES.md](SUPPORTER-NOTES.md). Offene Platzhalter anzeigen: `cd web && npm run check:legal` (`--strict` → Exit 1).

## 1. Platzhalter füllen

- [ ] Name und Anschrift stehen **nicht im Repo**: Cloudflare Pages → Settings → Environment variables: `IMPRESSUM_NAME`, `IMPRESSUM_STREET`, `IMPRESSUM_POSTCODE_CITY` (Production; optional `IMPRESSUM_COUNTRY`), danach neu deployen. Der Production-Build der Website bricht ohne sie ab. Neue Postanschrift = Variablen ändern + redeploy, kein Commit. Die App zeigt unter Einstellungen → Über Nemo → Rechtliches nur Kontakt-E-Mail und einen Link zum Website-Impressum (`web/src/core/legal/identity.ts`).
- [ ] `[[RECHTSGRUNDLAGE]]`-Spalte in [DATA-FLOWS.md](DATA-FLOWS.md) prüfen/füllen.
- [x] Im Release-Workflow (`prepare`) bricht `check-legal.mjs --strict` das **Veröffentlichen** ab (Tag oder Dispatch mit Version), solange Platzhalter offen sind oder eine Rechtsseite die Angaben nicht aus dem Build (`site/src/legal.js`) liest; Probeläufe warnen nur. Ob die Variablen in Cloudflare gesetzt sind, prüft der Production-Build der Website, nicht dieser Schritt.

## 2. Impressum

- [ ] Ob und wie eine Anbieterkennzeichnung nötig ist (§ 5 DDG, privat/nicht kommerziell vs. Einnahmen über Ko-fi) klären; danach Website, App und Ko-fi-Seite gleichziehen.
- [ ] Erreichbarkeit: E-Mail-Adresse, die du wirklich liest.

## 3. Datenschutz

- [x] Website-Datenschutzerklärung (DE/EN) und README nennen die optionalen App-Flüsse; prüfen und freigeben.
- [ ] Verarbeitungen, die du selbst betreibst: Website (Cloudflare Pages) und Supporter-Dienst (Cloudflare Worker/KV/Queue, Resend). Auftragsverarbeitung, Drittlandübermittlung, Löschkonzept: siehe SUPPORTER-NOTES §3.
- [ ] In-App-Texte lesen (`legal` in `web/src/strings.ts`) und freigeben oder anpassen.

## 4. Ko-fi und Steuern

- [ ] Angaben auf der Ko-fi-Seite (Impressum/Kontakt, Datenschutz-Link, Formulierung „freiwillig, kosmetische Extras als Dankeschön“), siehe SUPPORTER-NOTES §1.
- [ ] Steuerhinweis: Einnahmen erfassen, Einordnung (Einkommensteuer, Kleinunternehmerregelung § 19 UStG, Gewerbe) klären, ggf. beim Finanzamt melden. Beträge nie in der App.

## 5. Google-OAuth-Status

- [x] Entschieden: jede Person bringt ihren eigenen Client mit (Variante a, [STATUS](../STATUS.md)). Dann gilt „Testing“ für das Projekt der Person: Anmeldung läuft nach 7 Tagen ab, höchstens 100 Testnutzer. Die App zeigt „Abgelaufen“ + „Neu anmelden“ und erklärt es an der Karte und beim ersten Verbinden.
- [ ] Wer „In Produktion“ ohne Verifizierung nutzt, bekommt Warnungen („nicht verifizierte App“); Gmail ist ein eingeschränkter Scope (Prüfung durch Google nötig, wenn du einen eigenen App-Client ausliefern willst). Nichts davon ausliefern, ohne es mit Google geprüft zu haben.

## 6. Lizenzen

- [ ] `cd web && npm run check:licenses` ist grün (läuft in `build` und CI). Neue Lizenz → Policy `web/scripts/lib/licensePolicy.ts` bewusst erweitern, nie die Prüfung abschalten.
- [ ] Gradle-Bibliotheken (`web/scripts/licenses.manual.json`) beim ersten Android-Release gegen das erzeugte Projekt (`src-tauri/gen/android`, `./gradlew app:dependencies`) abgleichen: die Liste kommt aus den Plugin-Dateien und der Tauri-Vorlage, nicht aus einem Werkzeug.
- [ ] Lizenztexte/Namensnennung für Schriften (OFL: Inter, Nunito) und Modelle (Apache-2.0 u. a.) liegen in der App unter Rechtliches → Lizenzen.
- [ ] Bei eingebautem Modell im Release: Lizenz des Basismodells erneut lesen.

## 7. Markenname „Nemo“

- [ ] Hinweis, nur als Anstoß: „Nemo“ ist ein verbreiteter Name (Film/Marke, Software). Vor dem Launch Markenrecherche (DPMA/EUIPO/WIPO, Klassen 9/42) selbst oder per Beratung prüfen, auch für Domain, App-Store-Namen und Logo. Hier wird nichts bewertet.
