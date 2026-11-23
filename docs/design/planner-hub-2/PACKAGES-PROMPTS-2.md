# Planner hub 2 – prompts, packages 4b to 2

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 4b: paying and cancelling in the row (`feat/plan-panel-money`)

```
# Aufgabe: Planer-Zentrale 2, Paket 4b – Rechnung bezahlen und Kündigungsfrist entscheiden, ohne den Planer zu verlassen
Routing: Claude Code · Planer-Zentrale 2 Paket 4b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-panel-money` von frischem `develop`, nach dem Merge von 4a. Darf parallel zu 4c laufen (eigene Module; gemeinsam nur `strings.ts` in getrennten Blöcken und das Mess-Skript – wer später mergt, misst neu).

## Ausgangslage
CONCEPT-ROWS.md „Idea 4“ (Tabelle: Rechnungen, Abos); handoff/04-expand.md; COPY.md X9–X11, X16. docs/decisions/plan-links.md L7: der Planer bezahlt nie – das bleibt: das Panel ist Code des Rechnungen-Moduls, über `PlanPanelHost` eingehängt.

## Pflichtliste
- Rechnungen-Panel nach der Übergabe: Mahnzeile falls vorhanden, der vorhandene `PayStep` als eine Zeile (Tag, Summe, Teilzahlung, Undo-Toast), Aktionen im Fuß; `compact`: eine Zeile mit „Bezahlt“ in einem Tipp (heute, volle offene Summe – was die Rechnungsliste heute tut). `?open=&do=pay&from=plan` bleibt als Weg von „Ganz öffnen“ und schreibt weiter nichts.
- Abos: erster eigener Kündigungsschritt im Modul, genau nach CONCEPT-ROWS (Zeile Abos) und der Übergabe – „Gekündigt am …“ (zeigt `DateChips`, Standard heute, dann „Vermerken“; schreibt das Kündigungsdatum) und „Läuft weiter“ (diese eine Frist gilt als entschieden; die Frist der nächsten Laufzeit kommt wie gewohnt); Schema additiv, `manifest.version` + Migration, Quelle listet ein entschiedenes Abo nicht mehr; dasselbe als Panel und auf der Abo-Seite (`?do=cancel` öffnet ihn jetzt wirklich, schreibt aber erst beim Tipp).
- Tests: Bezahlen im Panel schreibt, was `PayStep` auf der Seite schreibt, und nichts im Planer (Schreib-Spion); „Werte ausblenden“ gilt in Panel und Toast.

## Nicht in diesem Paket
Stapel (2), Budgets, Mahnketten-Änderungen, ein neuer Zahlungsweg.

## Abnahme
Mess-Skript Ablauf B neu gemessen (Weg: Mail → Budgets → Planer, damit der Navigations-Tipp des Budgets nicht auf `/planner` liegt): Desktop `moduleSwitches` 5 → 3 (Budgets und Mail bleiben bis Paket 2 je ein Weg – weniger geht nicht), `doneInPlanner` 1 → 5, `rowsAfter` 1 → 0 („Läuft weiter“ nimmt die zweite Frist aus der Quelle), `rowsBefore` 5; `taps` 27 → 28, `perThing` 17 → 21 – im Skript-Kopf benannter Preis (`PRICE`) bis Paket 2, nicht darüber. Handy: `moduleSwitches` 5 → 3, `doneInPlanner` 1 → 5, `rowsAfter` 0, `taps` 14 → 16, `perThing` 9 → 13 (Preis bis 2). Seed-Spec `dunning-chain` grün.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 4c: answering mail in the row, desktop (`feat/plan-panel-mail`)

```
# Aufgabe: Planer-Zentrale 2, Paket 4c – eine geplante Mail im Planer lesen und beantworten (Desktop)
Routing: Claude Code · Planer-Zentrale 2 Paket 4c · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-panel-mail` von frischem `develop`, nach dem Merge von 4a; parallel zu 4b erlaubt. Vorher im Notiz-Repo nachsehen, was `feat/mail-find-overview` am Thread-Kopf und am Verfassen geändert hat.

## Ausgangslage
CONCEPT-ROWS.md „Idea 4“ (Zeile E-Mail, Risiko-Absatz); handoff/04-expand.md; COPY.md X5, X6, X12. Die Zeile im Plan ist ein ToDo mit Link auf den Thread (`mail/planMail.ts`); das Panel gehört dem Mail-Modul und wird für ToDos gezeigt, deren erster `origin`-Link ein Thread ist (Regel in `PlanPanelHost`: ein Träger-ToDo zeigt das Panel seines Ziels, darunter die eigene Checkliste).

## Pflichtliste
- Mail-Panel: Absender · Tag, Betreff, erste 6 Zeilen der neuesten Nachricht als reiner Text aus dem Geräte-Cache (kein HTML, keine Bilder, kein Nachladen); „Antworten“ öffnet den vorhandenen Verfassen-Dialog des Mail-Moduls über dem Planer (`ComposeDialog`, wie auf der Mail-Seite: Prüfschritt, „Senden“, „Entwurf speichern“ unverändert – ohne seinen Tipp dort wird nichts gesendet und nichts gespeichert, auch kein Entwurf auf dem Server); der Text „Beantwortet?“ mit dem Knopf „Erledigt“ wie in der Mail-Zeile (`todo.doneRequested`).
- Das 10-Sekunden-Fenster: `PendingSendBar` („Zurückziehen“) hängt heute nur in `MailPage.tsx`. Mail liefert sie zusätzlich als `planPageFoot` (Vertrag aus 4a), die Planer-Seite hängt sie einmal über den Kern ein – kein Import von `mail` im Planer. Test: aus dem Planer gesendet → „Zurückziehen“ sichtbar und wirksam, auch nach Zuklappen der Zeile.
- Handy / Mail aus: X5 bzw. X6, kein Knopf.
- Kein Mail-Inhalt in Planer-Strings, Suche, Kopiertext, Diagnose, Logs; Test dafür. `privacy.test.ts` und `exclusion.test.ts` bleiben grün und wachsen um den Fall.

## Nicht in diesem Paket
Die Warteschlange (gehört `feat/mail-find-overview`), der Mail-Stapel samt Ein-Zeilen-Panel der Warteschlange mit „In den Plan ({n})“ (2), Entwürfe aus dem Plan, Anhänge im Fach.

## Abnahme
Keine eigene Zahl; Voraussetzung für Paket 2. Mess-Skript Ablauf B neu gemessen und unverändert (Desktop `taps` 28, `perThing` 21, `moduleSwitches` 3, `doneInPlanner` 5, `rowsAfter` 0): die Mails kommen bis Paket 2 über das Mail-Modul in den Plan, und „Erledigt“ im Mail-Panel kostet so viel wie ⋯ + „Erledigt“.

## Skills
`council` (Mail-Inhalt auf einer neuen Fläche: Guardian), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 2: collective rows (`feat/plan-piles`)

```
# Aufgabe: Planer-Zentrale 2, Paket 2 – Sammel-Dinge: „Finanzen checken“ und „E-Mails durchgehen“ als je eine Zeile
Routing: Claude Code · Planer-Zentrale 2 Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-piles` von frischem `develop`, nach dem Merge von 4b und 4c. Hotspots ansagen: `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 2“; handoff/02-pile.md; COPY.md P1–P15.

## Pflichtliste
- Vertrag `contributions.pile` (`PileSource`, `Pile`) in `core/modules/types.ts`; Sammler in `core/modules/contributions.ts` (ein fehlschlagender Teil fehlt, der Rest bleibt).
- **Neu und ausdrücklich Teil dieses Pakets:** der Planer wird Planquelle seiner selbst – `planner/plannable.ts`, im Manifest eingetragen, listet die Stapel als Dinge der Art `pile` (Schlüssel `planner:pile-money`, `planner:pile-mail`), ohne Rückschreib-Schritte; sie laufen durch Sammler, Eingabe-Hash und Zuweisungen wie jedes Ding (Paket 5b hängt dort die Bündel an).
- Quellen: Rechnungen, Abos, Unterlagen (mit `members`), Budgets (Zahl + Weg; die Zeilen im Panel zeichnet das Budgets-Modul selbst als `compact`-Panel, Betrag über `SensitiveValue` – durch Planer-Code läuft nie ein Betrag; reine Lese-Zeilen, nie als „im Planer erledigt“ gezählt; solange ein Budget über dem Rahmen ist, zählt der Teil 1 und der Geld-Stapel bleibt eine Zeile, gelegt oder nicht – „nichts wartet“ heißt: jeder Teil auf 0). E-Mail nur, wenn `develop` die Warteschlange hat (eine reine Zählfunktion und ein Weg dorthin): sonst Geld allein bauen und im PR „Noch offen: Mail-Stapel“ nennen – nichts Eigenes zählen.
- Mail-Teil: die Warteschlange ist das eigene Ein-Zeilen-Panel des Mail-Moduls (Code von Mail, `compact`): die Zahl, der Knopf P15 „In den Plan ({n})“ (die vorhandene Mail-Aktion „Alle in den Plan …“, im Planer ausgeführt – kein Weg ins Mail-Modul) und der Sprung. Danach sind die Mails ToDos und stehen als Mitglieder mit Haken im Stapel. Zahl des Mail-Stapels = Fäden der Warteschlange ohne Plan-ToDo + Mitglieds-ToDos (eine Mail im Plan zählt nicht doppelt; Test). Der Vertrag des Mail-Chats (Zahl + Weg, kein Inhalt) bleibt unverändert.
- Mitglieder prüft der Kern: ein Schlüssel bleibt nur, wenn er zum Modul des Stapels gehört oder – bei Mail – ein `todos:`-Schlüssel ist, dessen `origin`-Link auf einen Mail-Faden zeigt (`linkEntries`); nie `accounts`. Test in `pile.test.ts`.
- Falten nur für Mitglieder ohne Tag und ohne „fest“; gefaltete Mitglieder werden von „Woche vorschlagen“ / „Rest verteilen“ nicht einzeln vorgeschlagen (der Stapel ist das Ding, das die Vorschläge sehen); E-Mail nennt die ToDos, die es aus Mails angelegt hat, über `linkEntries` (Kern), nie durch einen Import von `todos`; „Frist vorbei“ wird bei eingeschaltetem Schalter nicht mehr als eigene Gruppe gezeichnet, der Kopfsatz bleibt.
- `PilePanel` (Teile, Mitglied klappt eine Ebene tiefer auf, Sprung P8), das Angebot P5 (einmal, ✕ gerätelokal), Schalter P10 in den Planer-Einstellungen: zwei flache optionale Booleans `pileMoney`, `pileMail` (synchronisiert; flach, weil Einstellungen je oberstem Feld zusammengeführt werden; undefined = nie gefragt). „Rückgängig“ im Toast P6 setzt den Schalter ausdrücklich zurück (das Undo-Journal kennt keine Einstellungen).
- Wege `?view=open|notice|over` in Rechnungen, Abos, Budgets: Erlaubt-Liste, null Schreibvorgänge, Parameter verlässt die URL (Muster `invoices/returnTo.ts`, `payRoute.test.tsx`).
- Schreib-Spion: eine Zahl, die sich ändert – auch auf 0 („nichts wartet“ ist abgeleitet) –, schreibt nichts im Planer. „Werte ausblenden“ gilt im Stapel; `copyInput` enthält nie Stapel-Inhalt. Kein Abzeichen, keine Farbe, nichts auf Widget oder Übersicht.

## Nicht in diesem Paket
Stapel für ToDos, Listen, Routinen; Benachrichtigungen; ein automatischer Tag.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-pile.seed.spec.ts`; Mess-Skript B neu gemessen – Desktop: `rowsBefore` 5 → 2, `moduleSwitches` 3 → 0, `taps` 28 → 16, `perThing` 21 → 12, `doneInPlanner` 5 → 9 (das Budget zählt nie), `rowsAfter` 0 → 1 (das Budget über dem Rahmen hält den Geld-Stapel; im Skript-Kopf nicht als Preis benannt – vor dem Start mit dem Maintainer klären), `mails` 4. Handy: `rowsBefore` 1, `moduleSwitches` 0, `taps` 10, `perThing` 8, `doneInPlanner` 5, `rowsAfter` 1. Damit enden die B-Preise (`rowsBefore` liest nicht mehr 5). Lesart des Skripts ändern: die Stapel-Schalter werden gesetzt, bevor `rowsBefore` gelesen wird (Seed oder ein ungezählter Tipp); Aufklappen eines Stapels ist kein `touch`. Fehlt die Warteschlange (Geld allein), steht die Abweichung von `TARGET` im PR und unter „as built“; `TARGET` bleibt. kopf-leer-Skript grün (weniger Zeilen, nie mehr).

## Skills
`council` (Manifest-Vertrag), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
