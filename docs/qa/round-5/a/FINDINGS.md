# Person A – Funde (Erstkontakt-Runde, Runde 5)

Persona: [PERSONA.md](PERSONA.md). Getestet mit `npm run dev:all` (Dev-Preview mit Testdaten, Port 5173) **und** separat mit dem stabilen Flavour ohne Testdaten (Port 5180, damit der Einrichtungsassistent erscheint), Android-UA, 412 × 900, hell und dunkel; Außendisplay 320 × 332 CSS-px bei 2,25. Vorher = `develop` @ `11a40042`, Nachher = `feat/demo-a`. Messskript (Playwright, dieselben Schritte für beide Stände) nicht im Repo; Klicks = Taps, Sekunden = Maschinenzeit inkl. Ladepausen, nicht Lesezeit.

**Schwere:** Abbrecher (er legt die App weg) · Stolperstein · Kosmetik. Bekannte Funde aus [CONSOLIDATED.md](../../CONSOLIDATED.md) stehen in Klammern; sie wurden nur gefixt, weil sie ihn treffen.

## Funde

| Id | Schritt | Erwartet / Ist (seine Worte) | Schwere | Datei:Zeile | Fix | Aufwand | Status |
|---|---|---|---|---|---|---|---|
| A01 | Aufgabe 1: Pause bei „Frage 2 von 3“, später „Einrichtung fortsetzen“ | „Ich war bei *Was passt zu dir?*. Die App bietet ‚Fortsetzen bei *Sync und Wiederherstellung*‘ an – das habe ich nie gesehen. Und mein Profil ist weg.“ | **Abbrecher** | `core/setup/state.ts:101` (`pauseSetup`), `layout/setup/SetupWizard.tsx` Start-Ansicht | Pause merkt Schritt + Fragemodus (`pausedAt`, `pausedQuick`, nur Ids); „Fortsetzen“ öffnet genau dort, in den Fragen | S | gefixt (`state.test.ts`, `SetupWizard.test.tsx` A01) |
| A02 | Fragen 1–3, danach Übersicht (B04) | „Da stand *Frage 3 von 3* und *Fertig*. Auf der Übersicht steht dann *2 von 10 Schritten erledigt* und *Einrichtung fortsetzen*. Was stimmt jetzt?“ | Stolperstein | `layout/setup/SetupWizard.tsx` (Kopf, letzter Knopf) | Aufklappbare Liste „Alle 4 Fragen und was danach kommt“ mit Stand je Frage und den freiwilligen Schritten danach (auf Frage 1 offen); letzter Knopf „Fragen abschließen“ | S | gefixt (A02-Test) |
| A03 | Frage 1 | „*Wie darfst du heißen?* – wer erlaubt das? Und *Name und Textgröße. Beides …* – da sind aber Sprache, Name, Textgröße und noch mehr.“ | Stolperstein | `strings.ts` `setup.quick.basics` | „Sprache, Name und Textgröße“; Text nennt jedes Feld und was unter „Weitere Einstellungen“ folgt | S | gefixt (`round5.test.tsx`) |
| A04 | Aufgabe 2: drei ToDos tippen | „Der Hinweis *ToDo hinzugefügt* mit *Rückgängig* war weg, während ich noch getippt und gelesen habe.“ | Stolperstein | `ui/Misc.tsx:117` (6 s fest) | Kein Toast verschwindet, solange Zeiger oder Fokus darin ist; neuer Schalter „Hinweise bleiben stehen“ (Barrierefreiheit, Fokus-Hilfen) | S | gefixt (`Toast.test.tsx` A04) |
| A05 | Aufgabe 2: „Rechnung zahlen heute“ (B12) | „Ich habe *Rechnung zahlen* geschrieben, da steht *Zahlen*.“ | Stolperstein | `modules/todos/quickAdd.ts:19`; Ursache `quickCapture/parser/index.ts:163` | ToDo-Zeile schützt Typwörter (Rechnung, Aufgabe, Geburtstag …) vor dem Parser, Datum wird weiter erkannt | S | gefixt (`quickAdd.test.ts` A05); Parser-Ursache: Board „für demo-c“ |
| A06 | Frage 2 (B06) | „Ich will Planung, Finanzen, Notizen. Jedes Profil schaltet etwas davon ab. Was mache ich jetzt?“ | Stolperstein | `strings.ts` `setup.quick.profiles` | Text sagt: nächstes Profil wählen, einzelne Module danach unter Mehr → Modul-Bibliothek; „Weiter“ ohne Auswahl lässt alles, wie es ist | S | gefixt (`round5.test.tsx`) |
| A07 | ToDos, leerer Tag | „*Alles für heute erledigt.* – ich habe nichts erledigt, da war nichts.“ | Kosmetik | `modules/todos/components/TodayCard.tsx:52` | „Für heute ist nichts eingetragen.“, außer heute wurde wirklich etwas erledigt | S | gefixt (`todosPage.test.tsx` A07) |
| A08 | ToDos, Eingang | „*3 Dinge warten auf einen Platz* – welcher Platz?“ | Kosmetik | `strings.ts` `todos.sort.hint` | „3 Aufgaben liegen im Eingang, noch in keiner Liste.“ | S | gefixt (`e2e/calm.spec.ts`) |
| A09 | Aufgabe 3: Notiz | „Es gibt keinen Speichern-Knopf. Wo ist die Notiz jetzt?“ | Kosmetik (Freude) | `modules/notes/components/NotePane.tsx:361` | „Gespeichert. Die Seite steht unter Notizen → Alle Seiten.“ (Schmierzettel bleibt kurz) | S | gefixt (`saveStatus.test.ts`) |
| A10 | Erster Start mit dem Dev-Preview-Link | Dev-Preview füllt eine leere App sofort mit Testdaten und setzt die Einrichtung auf erledigt: der Assistent erscheint **nie**, Aufgabe 1 geht nur über Einstellungen → Einrichtung | **Abbrecher** (für Aufgabe 1) | `core/seed/dev.ts:377` `autoFillIfEmpty` | Erster-Start-Frage „Mit Testdaten ansehen / Leer einrichten“ | M | Board für install-first-run |
| A11 | Übersicht am nächsten Tag | „Gestern *2 von 10*, heute *2 von 9* – an der Einrichtung habe ich nichts gemacht.“ (Schritt „Umzug“ fällt weg, sobald die erste eigene Notiz existiert) | Kosmetik | `core/setup/migrate.ts:225` `migrateStepApplies` | Einmal gezeigte Schritte in der Zählung lassen, oder ein Satz, warum einer wegfiel | S | Follow-up (FOLLOWUP.md) |
| A12 | Außendisplay 320 × 332 | App läuft, kein Querscrollen; sichtbar nur Kopf, Begrüßung, „Ruhig/Ausführlich“ und Leiste, der „+“-Knopf liegt über dem Umschalter; im Assistenten ist „Weiter“ erst nach Scrollen erreichbar | Stolperstein (dort) | – | Android-Widget „Heute“ statt App auf dem Außendisplay | L | Follow-up (FOLLOWUP.md) |
| A13 | Dev-Preview, Übersicht | Testdaten-Banner abgeschnitten („Testdaten geladen, entfe…“), Dev-Preview-Toast liegt bis „Schließen“ über dem Inhalt | Kosmetik | `layout/SeedBanner.tsx` | Text umbrechen statt abschneiden | S | Board für install-first-run |
| A14 | Fokus-Hilfen fehlen als Schritt | Bewegung, Hinweise, Zähler und Lesehilfe sind verstreut in Darstellung, Barrierefreiheit, Fokus, Ruhige Erinnerungen | Stolperstein | `core/setup/steps/index.ts` | Neuer Schritt „Fokus-Hilfen“ (für alle): 5 Schalter mit je einem vollständigen Satz, Vorauswahl „Ruhig“, schreibt erst bei „Weiter“ | M | gebaut (`focusAids.test.ts`, `round5.test.tsx`) |
| A15 | Fokus-Hilfen (Nachher-Lauf) | „Weiter“ zu früh getippt → Schritt als erledigt gemerkt, aber nichts gespeichert | Stolperstein | `layout/setup/steps/FocusStep.tsx` | „Weiter“ wartet, bis die Schalter da sind | S | gefixt (`round5.test.tsx`) |
| B05 | (von demo-b) Umzug-Kacheln | Bank-Kachel unter dem Falz, ToDo-Importe oben trotz abgeschalteter ToDos | Stolperstein | `layout/setup/steps/MigrateStep.tsx` | Kacheln aktiver Module zuerst, Reihenfolge fest, solange die Kacheln offen sind; „Papier“ bleibt letzte | S | gefixt (`migrate.test.ts` B05) |
| B08 | (von demo-b) Umzug Bank | „✓ Kontoauszug importiert“ nach „Konto mit Startsaldo“; offener Punkt liest sich wie erledigt | Stolperstein | `core/setup/migrate.ts` | Nur der Bank-Import zählt (`importerId`); offene Punkte als Ziel („Kontoauszug importieren“) | S | gefixt (`migrate.test.ts` B08, `round5.test.tsx`) |

Weitere Beobachtungen ohne Fix (geprüft, wörtlich korrekt oder schon bekannt): „Notizen → Neue Seite“ statt „Neue Notiz“ (Begriff Seite wird überall gleich benutzt), „Kalender einschalten“ an einem aktiven Modul in der Bibliothek (B32, bekannt), Planer-Modul ist in keinem Profil und standardmäßig aus – „Planen“ unten führt zu Kalender/ToDos (Entscheidung, siehe PR-Fragen).

## Persönliche Störungen – Protokoll

| Störung | Vorher | Nachher |
|---|---|---|
| Toast mit Zeitlimit während einer Eingabe | 6 s, auch beim Tippen/Lesen | wartet bei Zeiger/Fokus; mit „Ruhig“ bleibt er bis „Schließen“ (7-s-Messung: weg → steht) |
| Dialog verändert sich bei Fokuswechsel | nicht beobachtet | – |
| Element wechselt die Position | Umzug-Kacheln: neue Reihenfolge nur beim Öffnen, nie während der Ansicht (B05 bewusst so gebaut) | – |
| Wörtlich falsche Texte | A02, A03, A07, A08, B08 | gefixt |
| Erklärtexte nur angedeutet | Frage 1 („Beides“), Profilfrage (was tun, wenn keins passt), Notiz (wo gespeichert) | vollständig |

## Zahlen vorher / nachher

| Messung | Vorher | Nachher |
|---|---|---|
| Aufgabe 1: Fortsetzen genau an der Pause | nein („Sync und Wiederherstellung“) | ja („Was passt zu dir?“) |
| Aufgabe 1: Taps bis Einrichtung zu | 15, Assistent danach noch offen (volle Liste) | 11 (eine Frage mehr: Fokus-Hilfen) |
| Aufgabe 1: Sekunden (Maschine) | 23 | 23 (eine Frage mehr) |
| Aufgabe 2: Taps (3 ToDos + eins auf morgen) | 7 | 7 |
| Aufgabe 2: Titel „Rechnung zahlen“ erhalten | nein („Zahlen“) | ja |
| Aufgabe 2: Toast nach 7 s Tippen noch da | nein | ja („Ruhig“) |
| Aufgabe 3: Notizen nach der Einrichtung da | nein (Profil beim Fortsetzen verloren) | ja |
| Aufgabe 3: Taps bis Notiz geschrieben | 6 (Bibliothek suchen) | 2 |
| Aufgabe 3: am nächsten Tag gefunden | ja (1 Tap) | ja (1 Tap) |
| Sekunden bis zur ersten erledigten Aufgabe (Aufgabe 2, Maschine) | 4 | 4 |
| Außendisplay: Querscrollen | nein | nein |

Dev-Preview (Testdaten, Einrichtung schon „erledigt“): Weg über Einstellungen → Einrichtung → „Einrichtung starten“ zeigt die volle Liste (13 Schritte); Pause bei „Profil und Module“ → „Einrichtung fortsetzen“ → „Fortsetzen bei „Profil und Module““ – nachher geprüft, genau dort.

Bilder: `shots/before-*.jpg` und `shots/after-*.jpg` (gleiche Nummern = gleicher Moment; `after-06` ist der neue Schritt, `12` dunkel, `13` Außendisplay).

## Urteil in seinen Worten (nach 15 Minuten)

„Die Einrichtung hat mir vorher gesagt, was kommt, und ich konnte genau da weitermachen, wo ich aufgehört hatte. Die Texte stimmen jetzt, die Hinweise bleiben stehen, und nichts hat sich bewegt, ohne dass ich es wollte. Ich behalte sie für Termine, ToDos und Notizen und schaue mir die Finanzen an, wenn ich am Wochenende Zeit habe – das Außendisplay brauche ich dafür nicht.“
