# Unabhängiger Review – Teil 3 (R33–R46, Urteile)

Teil von [REVIEWER.md](REVIEWER.md).

| Id | Seite/Ansicht | Plattform/Theme | Beleg (Dateiname + was man sieht) | Regel (Dokument/Abschnitt) | Vorschlag | Schwere |
|---|---|---|---|---|---|---|
| R33 | Notizen | 1920 + 412 dunkel | `page-notes.png`: 6 Ordnerreiter brechen in 3 ungleich lange Reihen (2/2/1 + „+“) in 295 px. Unterhalb der dritten Reihe zieht sich die Grundlinie nur bis x=605 | §4b Struktur | Reiter als Select/scrollende Reihe oder Liste in der Seitenspalte | niedrig |
| R34 | Chat | 1920 dunkel | `page-chat.png`: Checkbox „Archivierte anzeigen“ ≈ 14 px. Das Suchfeld klebt 3 px unter der Hinweiskarte (500 → 503) | design-rules Touch (Inline-Checkbox 24 px); 4-px-Raster | `Checkbox` aus `@/ui`; 16 px Abstand | niedrig |
| R35 | Unterlagen | 1920 dunkel | `page-vault.png`: Daten brechen über die Zeile („Ende: 30. Aug. / 2026“). Der Hinweis „Dateien bleiben …“ steht 4 px über dem Label „Unterlagen durchsuchen“. Reiter „Sonstiges“ ohne Zahl, alle anderen mit | §4b; 4-px-Raster; Konsistenz | Datum als nicht umbrechende Einheit; Hinweis 12–16 px Abstand; Zahl auch bei „Sonstiges“ | niedrig |
| R36 | Merkliste vs. Unterlagen | 1920 dunkel | `page-bookmarks.png` und `page-vault.png`: beide indigo/violett, beide `regal`, beide „Zahl + Wort + Kacheln“ links unten. Die Pinnwand-Marke zeigt drei leere dunkle Kacheln. Merkliste gruppiert alle 31 Einträge unter „Heute 31“ | MODULE-IDENTITY Klarstellung (offen aus Audit), Signatur „children = the one line“ | Kopfvariante einer der beiden ändern (Paket-2-Entscheidung); Pinnwand mit einer Zeile füllen; Gruppierung nach Art statt Datum, wenn alle gleich alt sind | mittel |
| R37 | Einstellungen Überblick | 1920 dunkel | `page-settings.png`: Kachel „Benachrichtig / ungen“ ist mitten im Wort ohne Trennstrich umbrochen (180 px breite Karte). Die zweite Kartenreihe endet bei x=1147, die Statuskarte darüber bei 1537. „Nicht erlaubt“ unter „Benachrichtigungen“ in eigener Zeile, andere Zähler inline | Brief „Umbrüche in Wörtern“; Kantenflucht | Karten auf das 3-Spalten-Raster der Statuskarte; `hyphens:auto` oder Mindestbreite | hoch |
| R38 | Einstellungen Darstellung | 1920 dunkel | `page-settings-darstellung.png`: Bei den Reitern „Aussehen / Weitere“ ist kein Zustand aktiv markiert. „Schrift & Lesen: Normal · Normal · Normal“ sagt nichts. Sechs orange „Ändern“-Links | MODULE-IDENTITY Settings „rows = title + one line + control“; Zustand sichtbar | Aktiven Reiter markieren; Werte benennen („Text normal · Abstand normal …“) | mittel |
| R39 | Einstellungen | 412 dunkel | `412x915-dark/seed/page-settings.png`: 4 von 6 Statuskacheln sind gekürzt („Deine Daten bleiben a…“, „Noch kein Backup auf…“, „Gelöschtes endgültig…“, „Anbieter, Reihenfolge,…“) | MODULE-IDENTITY „Connect cards say the state first“; kein Abschneiden | Unterzeile am Telefon weglassen oder zweizeilig | niedrig |
| R40 | Bibliothek/Werkzeuge | 1920 dunkel | `page-tools.png`: In einer Reihe sind die Kartenköpfe ungleich hoch (Rechner ≈ 66 px, Timer & Stoppuhr ≈ 96 px), weil das Badge umbricht. `page-library.png`: Aktionszeilen nicht bodenbündig; „Wetter“, „Chat“, „Browser“ ohne „Importieren“ setzen „Details“ in die Schalterzeile, die anderen darüber | Brief „ungleiche Kartenhöhen in einer Reihe“ | Badges unter den Titel für alle; Aktionsleiste per `margin-top:auto` am Kartenboden, gleiche Struktur mit/ohne Import | niedrig |
| R41 | Setup | 1920 dunkel | `setup/step-02.png`: Die Fußleiste „Zurück/Weiter“ wird vom langen Inhalt aus dem Bild geschoben (nur 17 px sichtbar bei y=1063). Fünf erklärende Absätze und Schalter mit doppelter Verneinung („Keine Morgen-Übersicht …“ = An) | FOCUS-GUIDELINES Checkliste 1/4 (Reizlast, ruhige Sprache); Setup-Regel „clear next step“ | Fußleiste fixieren; Schalter positiv formulieren („Morgen-Übersicht“, Aus = Standard); Erklärung hinter ⓘ | hoch |
| R42 | Setup | 1920 dunkel | `setup/step-00.png`: „Weiter“ sitzt bei x=1854, die Inhaltsspalte endet bei 1320 (534 px Abstand). „Zurück“ ist auf Schritt 1 sichtbar, aber gedimmt | Fitts/klarer nächster Schritt (FOCUS 3) | Navigation an die Inhaltsspalte binden; „Zurück“ auf Schritt 1 ausblenden | niedrig |
| R43 | Setup | 412 dunkel | `412x915-dark/setup/step-02.png`: Unterhalb y=915 erscheint die Einstellungsseite („Werkzeugkasten · Öffnen“, „Auf der Übersicht“). Das Overlay deckt nur 100 vh, Fußleiste nicht sichtbar | MODULE-IDENTITY „nothing clipped“ | Overlay `min-height: 100dvh` + eigener Scrollcontainer (ggf. Screenshot-Artefakt prüfen) | mittel |
| R44 | Schnell hinzufügen | 1920 dunkel | `create-menu.png`: „Ziel: ToDos“ wiederholt den aktiven Chip „ToDo“. „Oder mit dem ganzen Formular“ hat keine Link-/Button-Gestalt und steht 72 px abgesetzt. Der Chip „Plan“ steht allein in einer dritten Reihe | Doppelte Texte; Affordanz | „Ziel“-Chip entfernen; Formular-Link als Ghost-Button neben „Satz eintragen“ | niedrig |
| R45 | Rechnungen leer | 1920 dunkel, leer | `empty/page-invoices.png`: Der leere Zustand „Keine offenen Rechnungen.“ hat keinen nächsten Schritt und folgt dem „Nicht“-Muster der Wording-Tabelle. `empty/page-finance.png`: Kennzahlen „0,00 €“ ohne Kontextzeile, Einnahmen 0,00 € in Grün | design-rules EmptyState „one sentence, at most one button“; FOCUS-WORDING „Empty, nothing yet“; §4a Kontextzeile | „Noch nichts offen. Zeit für etwas Schönes.“ bzw. „Rechnung anlegen“; 0-Werte neutral mit „noch keine Buchungen“ | niedrig |
| R46 | Rechnungen | 1920 dunkel | `page-invoices.png`: Der Kopf mit Fokusvariante ist 146 px statt 96 px hoch. Er trägt zusätzlich einen Rahmen-Knopf „Nächste bezahlen“, der dieselbe Aktion wie „Als bezahlt markieren“ in Zeile 1 ist | R01; Brief „doppelte Aktionen“ | Knopf aus dem Kopf nehmen oder Zeilenknopf der ersten Zeile weglassen | niedrig |

## Urteil pro Modul

| Modul | Urteil (wirkt fertig / fast / unruhig) | Ein Satz |
|---|---|---|
| Kalender | unruhig | Monatsansicht am Desktop solide, aber die Wochenansicht überlappt Ganztag und Zeitachse (R05) und am Telefon ist der Monat unlesbar (R06). |
| ToDos | fast | Liste klar gruppiert und ruhig formuliert; der Fokuskopf ist zu hoch und am Telefon gekürzt, das Board ordnet Vergangenes als „Demnächst“ ein. |
| Planer | fast | Die Tageskarten zeigen gut, was frei ist; nur die Titelkante springt je nach Checkbox und der Knopf „Eintragen“ ist ein zweites Akzentfeld. |
| Gewohnheiten | unruhig | Die Ringe sind lesbar, aber fünf orange Flächen auf einer Seite widersprechen „ein Akzent, eine Aufgabe“. |
| Zeiterfassung | fast | Klarer Start/Stopp-Kopf, Inhalt sehr dünn und h1 in Mono weicht von den anderen ab. |
| Wetter | unruhig | Mit Testdaten nur ein leerer Zustand ohne Ort, die Seite lässt sich so nicht beurteilen. |
| Karten & Orte | fast | Gute Liste mit Kacheln im Kopf; zwei gleich aussehende Chipreihen (Filter und Sortierung) und ein zu hoher Kopf. |
| Personen | fast | Kartenraster stimmig, Texte brechen aber mitten in Phrasen und der Telefon-Kopf zerfällt. |
| Finanzen | fast | Zahlen gut lesbar mit Kontext; Verlaufs-Kontokarten, grüner Endsaldo und ein Kurvenstart bei null stören. |
| Rechnungen | wirkt fertig | Rot nur für Überfälliges mit Text, klare Gruppen; Kopf etwas zu hoch und „Nächste bezahlen“ doppelt. |
| Abos | unruhig | Rote Kündigungsfristen ohne Ablauf, acht orange Schalter und eine springende Betragsspalte. |
| Budgets | fast | Inhalt verständlich, aber Zustandstönung der Karten, dreifach wiederholte Prozente und eine auseinandergezogene Monatsnavigation. |
| Listen | fast | Gruppen und Häkchen klar; zwei gefüllte Aktionen und Mono-Preise ohne Abstand zur Menge. |
| Vorräte | fast | Gute Ablaufsprache („MHD war Mo.“); Kartentitel liegen auf unterschiedlichen Höhen und die Werkzeugleiste ist überladen. |
| Fitness | wirkt fertig | Ruhige, gut gruppierte Liste; im Identity-Mapping fehlt das Modul allerdings. |
| Merkliste | fast | Saubere Liste, aber leere Pinnwand-Marke, alle 31 Einträge unter „Heute“ und zu ähnlich wie Unterlagen. |
| Notizen | fast | Editor ruhig und lesbar; Ordnerreiter brechen in drei ungleich lange Reihen um. |
| Chat | fast | Klarer Hinweis ohne KI; Mini-Checkbox und Abstand von 3 px zum Suchfeld. |
| Browser | unruhig | Die Kopfmarke sieht aus wie ein zweites Adressfeld, Kacheln sind gekürzt und die halbe Karte bleibt leer. |
| Feeds | fast | Serif-Masthead trägt die Identität; Gruppenköpfe in Serif weichen vom Rest ab, „Tagesbericht“ erscheint doppelt. |
| E-Mail | unruhig | Doppeltes Zahnrad, hart abgeschnittene Vorschauen und eine gequetschte Suchspalte. |
| Musik | unruhig | Höchster Kopf (352 px), doppelte Bibliotheksnavigation, am Telefon eine zerfallene Steuerreihe. |
| Unterlagen | fast | Fristen gut mit Wort und Farbe markiert; Datumsumbrüche und enge Abstände. |
| Passwörter | wirkt fertig | Gesperrter Zustand klar und ruhig, eine Aktion. |
| Dieser PC | wirkt fertig | Füllstände mit Text, Warnung nur bei „fast voll“; nur der Kopf ist etwas hoch. |
| Downloads | fast | Klare Zustände; Primärknopf links statt rechts und ein zweiter gefüllter Knopf im BitTorrent-Leerzustand. |
| Übersicht | unruhig | Die Mischung der Widgets trägt, aber die leere Installation zeigt Beispieldaten, leere Karten sind sehr hoch und Links in Widgets sind orange. |
| Bibliothek | fast | Gut sortiert nach Bereichen mit Miniaturen; Aktionszeilen sind nicht bodenbündig. |
| Werkzeuge | fast | Klar und neutral; Kartenköpfe einer Reihe sind wegen umbrechender Badges ungleich hoch. |
| Einstellungen | unruhig | Statuskarte gelungen, aber Wortbruch „Benachrichtig/ungen“, unbündige zweite Kartenreihe und Reiter ohne aktiven Zustand. |
| Einrichtung (Setup) | unruhig | Die Fragen sind gut, Schritt 3 ist aber textlastig, mit doppelter Verneinung, und schiebt die Navigation aus dem Bild. |

**Was die App gut macht:** Die Farbsemantik ist überwiegend diszipliniert: Überfälliges trägt Rot nur zusammen mit Wort und Symbol („war am 17. Sep. fällig“, „MHD war Mo.“), Gruppenköpfe sind ruhig, und die Formulierungen folgen fast überall dem freundlichen Ton von FOCUS-WORDING.
**Das größte systemische Problem:** Das Kopfband ist keine feste Form, sondern wächst mit dem Inhalt (114–352 px bei zwei vorgesehenen Höhen; dazu wechselnde h1-Größen und -Schriften und mehrere gefüllte Akzentflächen pro Seite). Dadurch beginnt jede Modulseite an einer anderen Stelle und mit einer anderen Hierarchie.
**Was sich aus Screenshots nicht beurteilen ließ:** Hover-, Fokus- und Disabled-Übergänge außer dem einen Fokusbild, Bewegung und Layoutverschiebung beim Laden, das Einklappen des Kopfs beim Scrollen am Telefon, die tatsächlichen Kontrastwerte (nur geschätzt) sowie der ganze Ordner `412x915-light`, der beim Lesen noch leer war.
