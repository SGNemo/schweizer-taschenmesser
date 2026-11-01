[English](modules.md) | **Deutsch**

# Module und Werkzeuge

## Übersicht

In der **Modul-Bibliothek** schaltest du Module ein und aus (beim Ausschalten: Daten behalten oder löschen).

| Standardmäßig an | Optional (aus, in der Bibliothek aktivieren) |
|---|---|
| Kalender (mit Erinnerungen und Benachrichtigung vor Terminen), ToDos (auch wiederkehrend, mit „Irgendwann“), Finanzen, Rechnungen, Abos | **Merkliste** (Links, Lesen, Ansehen, Orte, Ideen mit Tags; auf dem Handy per „Teilen“), **Notizen** (mit festem **Zettel** oben für Zwischendurch), **Listen** (Einkauf mit „2 Milch“, Packlisten mit Fortschritt und Vorlagen, Checklisten), **Personen** (Geburtstage jährlich im Kalender, mit Alter, Erinnerung und WhatsApp-Gruß; Geschenkideen je Person mit Preis, Link und Stand), **Budgets & Sparziele** (Monatslimits je Finanz-Kategorie, Sparziele mit Einzahlungen), **Unterlagen** (Ausweise, Verträge, Versicherungen, Garantien mit Ende, Kündigungsfrist im Kalender + Erinnerung und Datei), **Lesezeichen** (Ansicht der Merkliste: Kacheln nach erstem Tag gruppiert, z. B. Paketverfolgung, Bahn, Karten …), **Karten & Orte** (gespeicherte Orte und Routen, Karte mit Ortssuche, Öffnen in deiner Karten-App; die Karte lädt nur, wenn du sie öffnest), **Accounts** (Passwort-Tresor) |

- **Unterlagen:** Titel, Kategorie, Anbieter, Beginn, Ende, Kündigungsfrist und Notiz werden wie alles andere synchronisiert; die **Dateien bleiben nur auf dem
  Gerät**, auf dem sie hinzugefügt wurden (nicht synchronisiert, nicht im Backup, max. 10 MB je Datei).
- **Teilen (Android, als PWA installiert):** „Nemo“ erscheint im Teilen-Menü; die Seite „Teilen“ fragt, wohin der Inhalt soll
  (Merkliste, Notiz oder ToDo – nur eingeschaltete Module werden angeboten). In der nativen Android-App (APK) gibt es das Teilen-Ziel noch nicht.
- **Schnell erfassen:** Eine Zeile = ein Eintrag, so landen mehrere Dinge auf einmal (je mit einer Vorschau-Zeile). In der Android-App lange auf das App-Symbol drücken für „Erfassen“, „Suchen“ und „Heute“, oder die Schnelleinstellungs-Kachel „Nemo: Erfassen“ hinzufügen.
- **Werkzeuge:** Der Knopf „Werkzeuge“ oben (oder **Strg+.**) öffnet Rechner (mit den Modi Prozent/MwSt und Teilen), Währung, Timer und QR-Code;
  weitere (Einheiten, Datumsrechner, Zeitzonen, Würfel, Text, Bilder, PDF und **Entwickler** mit Base64/URL, JSON, UUID, Hash) schaltest du
  unter „Werkzeuge verwalten“ ein. In der Suche (Strg+K) wird eine Rechnung wie „240 + 19 %“ sofort gerechnet, „Werkzeug: …“ öffnet ein
  Werkzeug. Den früheren Notizzettel findest du jetzt als **Zettel** oben in den Notizen (dein alter Text wird einmal übernommen).
- **Import in Notizen:** „Importieren“ auf der Karte der Notizen (Modul-Bibliothek) liest Markdown-Dateien (z. B. aus einem Obsidian-Ordner, auch mehrere auf einmal, oder eingefügten Text) und Google-Keep-Exporte (die `.json`-Dateien aus dem Google-Takeout). Du siehst zuerst eine Vorschau und nimmst Häkchen weg, was du nicht willst; schon vorhandene Notizen sind markiert. Titel kommen aus dem Kopfbereich, der ersten Überschrift oder dem Dateinamen; Tags bleiben als `#Tags` im Text, Keep-Checklisten werden zu Aufgabenlisten, Keep-Notizen im Papierkorb oder Archiv bleiben draußen. ZIP-Dateien bitte vorher entpacken.
- **Dieser PC** (nur Windows-App): Laufwerke analysieren und aufräumen, im Tab „System“ Prozessor, Speicher, Akku, Grafik und Netzwerk.
- **Stillgelegt (0.4.0):** Nachrichten, Habit-Tracker und Zeiterfassung sind nicht mehr sichtbar. Ihre Daten bleiben gespeichert und stecken weiter in jedem Backup.
- **Karte & WhatsApp:** Termine mit Ort haben „Auf der Karte zeigen“; bei Personen mit Geburtstag öffnet der Knopf WhatsApp mit einem Glückwunsch
  (den Kontakt wählst du in WhatsApp).

## Kontoauszug importieren
In **Finanzen** (Einstellungen → Module → Finanzen → Startdaten einrichten → *Kontoauszug importieren*) wählst du die Datei, die du im Online-Banking exportiert hast: **OFX**, **QIF**, **CAMT** oder **CSV**. Es wird nichts hochgeladen und kein Login gebraucht; du siehst erst eine Vorschau und kannst den Import rückgängig machen. Bekannte Banken (Sparkasse, ING, DKB, N26, comdirect, Volksbank/GLS) werden an der Datei erkannt und in der Vorschau genannt („Erkannt: DKB“). Bei einer CSV, die die App nicht kennt, ordnest du die Spalten Datum / Betrag / Empfänger / Verwendungszweck einmal zu; die App merkt es sich für den nächsten Export dieser Art. Eine Datei, die du zweimal importierst, bringt nichts Neues, und eine Datei in einer anderen Währung wird nur auf ein Konto dieser Währung gebucht.

Nach einem Import schlägt die Vorschau eventuell **Regeln** vor („Netflix immer in der Kategorie Abos buchen?“). Nichts ist angehakt: eine Regel entsteht nur, wenn du sie ankreuzt und den Import bestätigst, sie sortiert dann spätere Importe, und du entfernst sie unter Finanzen → Kategorien. Eine bezahlte Rechnung wird in Finanzen als Ausgabe gebucht (unter Rechnungen → Einstellungen abschaltbar), und eine Preiserhöhung bei einem Abo erscheint einmal unter *Jetzt wichtig* (unter Abos → Einstellungen abschaltbar).

## Aufgaben aus Todoist oder Google Tasks mitnehmen
Öffne **ToDos → Importieren → Aus Todoist oder Google Tasks** (sobald das Modul Aufgaben enthält: Einstellungen → Module → ToDos → Startdaten einrichten) und wähle eine Datei, die du selbst exportiert hast. Es wird nichts hochgeladen und kein Konto gebraucht; du siehst erst eine Vorschau und kannst den Import rückgängig machen.

- **Todoist:** Projektmenü (⋯) → *Als CSV exportieren*. Eine Datei pro Projekt; daraus wird eine Liste mit dem Namen der Datei.
- **Google Tasks:** [Google Takeout](https://takeout.google.com) → nur *Tasks* → `Tasks.json`. Mit *Je Quell-Liste eine eigene Liste* bleiben deine Listen getrennt.

Titel, Notizen, Priorität (Todoist), Fälligkeitstage und Unteraufgaben kommen mit. Erledigte Aufgaben bleiben draußen, solange du sie nicht einschaltest. Wiederkehrende Aufgaben werden **nicht** zu wiederkehrenden Aufgaben: die Wiederholung steht nur als Zeile in der Notiz, damit nichts von selbst zurückkommt. Aufgaben, die du schon hast (gleiche Liste und gleicher Titel), sind als *Schon vorhanden* markiert.
