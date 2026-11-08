# Person B – Erstkontakt allein (Runde 5)

Zusammengesetzte Persona, keine Beschreibung einer bestimmten Person. Grundlage: wenige Stichworte (Bürokaufmann, Samsung-Handy, viel PC, Excel, Sparkasse, Interesse an Abos/Rechnungen/Budget, „grobe Übersicht reicht“). Alles mit **(A)** ist eine Annahme dieses Chats, nicht Teil der Vorgabe.

## Wer er ist
- Mitte 30 **(A)**, Bürokaufmann in einem mittelständischen Betrieb; tippt den ganzen Tag in Excel, DATEV-Masken und Outlook. Tabellen, Spalten, Summen sind sein Handwerk.
- Geräte: Windows-PC zu Hause (1920 × 1080, Chrome/Edge, hell) als Hauptweg; Samsung Galaxy (412 px, Dunkelmodus **(A)**) zum Nachschauen unterwegs.
- Private Finanzen heute **(A)**: eine Excel-Datei „Haushalt.xlsx“ mit einem Blatt pro Jahr, in die er alle paar Wochen die Sparkassen-Umsätze kopiert und grob einfärbt; Abos und Rechnungen stehen in einer Spalte „fix“. Er pflegt sie unregelmäßig, weil das Kopieren nervt.
- Geduld: mittel. Er gibt einer App eine Viertelstunde. Er liest Hinweistexte nur, wenn er feststeckt.

## Was ihn an Software nervt (A, aus seinem Beruf abgeleitet)
- Wenn eine Datei nicht so aus dem Programm kommt, wie Excel sie braucht (Umlaute kaputt, Beträge als Text, Punkt statt Komma).
- Sackgassen: „Lege zuerst X an“ nach drei Schritten, und dann von vorn.
- Zahlen, die nicht mit der Bank übereinstimmen – dann traut er dem Rest auch nicht.
- Details, nach denen er nicht gefragt hat (Diagramme, Prozente, „Trends“).

## Ziel der ersten 15 Minuten allein
„Ich will sehen, ob mir das die Excel-Datei erspart: Umsätze rein, und ich sehe auf einen Blick, was diesen Monat noch weggeht und was übrig bleibt.“

## Drei Aufgaben, die er ohne Hilfe schaffen muss
1. Die Sparkassen-CSV (Fixture [`sparkasse-demo.csv`](sparkasse-demo.csv), CSV-CAMT, Windows-1252, `1.234,56`, frei erfunden) importieren und danach sehen, was diesen Monat noch kommt.
2. Zwei Abos (Netflix 12,99 €, Fitnessstudio 29,90 €) und eine Rechnung (Zahnarzt 84,50 €) anlegen und auf der Übersicht wiederfinden.
3. Ein Budget „Essen“ (bei Nemo: Kategorie „Lebensmittel“) mit 400 € anlegen und den Stand nach dem Import sehen.

## Persönliche Störung
Dieselbe CSV zweimal; Datei mit `-0,01`, `1e3`, `31.02.26` ([`sparkasse-stoerung.csv`](sparkasse-stoerung.csv)); Monatswechsel (Oktober/November in einer Datei); Export in Excel öffnen; Druckansicht der Buchungsliste.
