# Datenflüsse – Website und README

Teil von [DATA-FLOWS](DATA-FLOWS.md) (kein Rechtsrat).

## Website und README (nachgezogen)

Erledigt in diesem PR (DE + EN): [datenschutz.astro](../../site/src/pages/datenschutz.astro), [en/privacy.astro](../../site/src/pages/en/privacy.astro), [README](../../README.md) / [README.de](../../README.de.md) (ein Aufzählungspunkt). Bei jeder Änderung an der Tabelle erneut abgleichen:

- **Website Datenschutz:** Abschnitt „Die App Nemo“ nennt jetzt die optionalen Flüsse (Sync, Update, KI, Google, Kalender-Abo, Modell-Download, Währung, Supporter) und verweist auf die In-App-Seite. Offen bleibt der Satz „speichert keine Namen“ beim Supporter-Dienst stimmt nur mit Einschränkung: ein öffentlicher Name steckt (≤ 20 Zeichen) im Code selbst ([SUPPORTER-NOTES](SUPPORTER-NOTES.md) §3).
- **Website Impressum/Datenschutz:** Platzhalter `[PLATZHALTER: …]` und die In-App-`[[…]]` müssen dieselben Angaben tragen (Name, Anschrift, E-Mail). Die E-Mail der Website steht schon im Repo; in der App bewusst Platzhalter, bis du sie freigibst.
- **README:** neuer Punkt „Nur, was du einrichtest, verlässt das Gerät“ unter „Datenschutz in Kürze“.
- **docs/user/security.md, ai-assistant.md** (+ `.de.md`): gegen die Zeilen `ai-cloud` und `google` prüfen.
