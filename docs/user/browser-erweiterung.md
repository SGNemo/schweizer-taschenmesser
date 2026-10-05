# Browser-Erweiterung (Brave)

Die Erweiterung hilft dir beim Anlegen und Anmelden auf Websites. Sie hat **keinen eigenen Tresor**: Alles kommt live aus dem Tresor der Nemo-Desktop-App und wird dort gespeichert (und von dort per Sync aufs Handy gebracht). Ist Nemo nicht gestartet oder der Tresor gesperrt, zeigt sie das an und tut nichts.

## Einrichten

1. `nemo-extension-….zip` entpacken (aus den Build-Artefakten bzw. vom Entwickler).
2. In Brave `brave://extensions` öffnen, **Entwicklermodus** einschalten, **Entpackte Erweiterung laden**, den Ordner wählen.
3. In Nemo: **Tresor → Browser-Erweiterung** → Verbindung aktivieren. (Nur für dein Windows-Konto, ohne Administratorrechte.)
4. Auf das Erweiterungs-Symbol klicken. Der angezeigte 6-stellige Code muss mit dem Dialog in Nemo übereinstimmen – dann **Verbinden**. Das ist nur einmal nötig.

## Benutzen

- **Neues Konto:** Beim Klick in das Passwortfeld eines Registrierungsformulars schlägt die Erweiterung ein Passwort vor (neu würfeln, Länge und Zeichen einstellbar, Passphrase möglich). „Verwenden“ trägt es in alle Passwortfelder ein; danach fragt sie, ob sie das Konto im Tresor speichern soll.
- **Anmelden:** Das Schlüssel-Symbol im Feld zeigt passende Einträge; ein Klick füllt aus. Einmalcodes lassen sich einfügen oder im Popup kopieren (die Zwischenablage wird nach 30 Sekunden geleert).
- Nichts wird automatisch ausgefüllt oder gespeichert – immer erst nach deinem Klick. Einträge werden nur für die passende Website angeboten (einstellbar: gleiche Domain oder genau derselbe Host).

## Probleme

- „Nemo wurde nicht gefunden“: App starten, in **Tresor → Browser-Erweiterung** prüfen, dass die Verbindung an ist.
- Portable-Ordner verschoben: Nemo trägt den neuen Pfad beim Start selbst ein; sonst im selben Dialog **Neu eintragen**.
- Brave Shields: Die Erweiterung wird dadurch nicht blockiert. Falls eine Seite nichts anzeigt, Shields kurz ausschalten und prüfen.
