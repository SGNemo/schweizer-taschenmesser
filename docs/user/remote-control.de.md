[English](remote-control.md) | **Deutsch**

# Fernbedienung: den PC vom Handy steuern

Mit der Android-App steuerst du deinen Windows-PC vom Sofa aus: Wiedergabe und Lautstärke, auf Wunsch auch Mauszeiger und Tastatur. Das geht nur bei dir zu Hause im selben WLAN, und nur für ein Handy, dem du es am PC erlaubt hast.

Die Fernbedienung ist noch in Arbeit. Damit du sie siehst, schalte **am PC und am Handy** _Einstellungen → Darstellung → In Arbeit anzeigen_ ein.

## Was du brauchst

- Nemo auf einem Windows-PC und auf einem Android-Handy.
- Beide sind im Heimnetz gekoppelt: [Synchronisation → Im Heimnetz mit deinem PC](sync.de.md#im-heimnetz-mit-deinem-pc-ohne-server).
- Nemo läuft am PC, und Handy und PC sind im selben WLAN.

## Einschalten

1. **PC:** _Einstellungen → Verbindungen → Fernsteuerung → Fernsteuerung erlauben_ einschalten.
2. **PC:** Beim Handy unter _Gekoppelte Geräte_ wählen, was es darf (siehe unten). Windows fragt in einem eigenen Fenster noch einmal nach.
3. **Handy:** In der Modul-Bibliothek die _Fernbedienung_ einschalten und öffnen.

Ohne Schritt 1 und 2 kann kein Gerät deinen PC steuern. Die Kopplung allein reicht nicht.

## Was das Handy darf

| Am PC gewählt             | Das geht am Handy                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Nichts                    | nichts                                                                                                                          |
| Medien und Lautstärke     | Wiedergabe / Pause, nächster und vorheriger Titel, lauter, leiser, Ton aus, PC sperren                                          |
| Medien, Maus und Tastatur | zusätzlich die Ansichten _Touchpad_ (Mauszeiger, Klicks, Scrollen) und _Tastatur_ (Text und einzelne Tasten wie Enter oder Esc) |

Am PC lässt sich beim Gerät einstellen, dass das Handy vor Maus und Tastatur nach Fingerabdruck, Gesicht oder PIN fragt.

Solange der PC gesperrt ist, gehen nur Medien und Lautstärke. Das Handy sieht nie deinen Bildschirm, deine Zwischenablage oder deine Dateien.

## Am Handy

- **Medien:** große Tasten für Wiedergabe und Lautstärke. Wenn du magst, steuern auch die Lautstärketasten des Handys den PC (Einstellung im Modul).
- **Touchpad:** wischen bewegt den Zeiger, tippen klickt, mit zwei Fingern scrollen.
- **Tastatur:** Text am Handy tippen, lesen und dann senden. Der Text wird nirgends gespeichert.
- **Auf der Übersicht:** Die Karte _Fernbedienung_ hat eine Taste _Wiedergabe / Pause_. Ein Tipp verbindet und sendet. Dauert das Verbinden länger, sagt die Karte das; steht die Verbindung danach, tippe noch einmal. Die Karte verbindet sich nie von selbst.

## PC ausschalten

- **Am PC erlauben:** unter _Einstellungen → Verbindungen → Fernsteuerung_ beim Gerät _Darf den PC ausschalten_ (ab Werk aus, der PC fragt noch einmal nach).
- **Am Handy:** Menü _⋯ → PC ausschalten …_, dann _Ausschalten_, _Neu starten_ oder _Energie sparen_ (darunter, leiser: _Ruhezustand_, wo der PC ihn hat, und _Abmelden_). Die eigene Abfrage des Handys (Fingerabdruck, Gesicht oder PIN) ist die Bestätigung.
- **10 Sekunden am PC:** Der PC zeigt einen Countdown mit _Abbrechen_; auch das Handy kann abbrechen. Nichts wird erzwungen: Fragt ein Programm noch nach dem Speichern, bleibt der PC an.
- Geht nur, solange der PC entsperrt ist. Ist Nemo am PC noch beschäftigt (Abgleich, Download, Sicherung), sagt das Handy das vorher: _Trotzdem ausschalten_ oder _Warten_.
- Zweimal innerhalb einer Stunde am PC abgebrochen, ist das Ausschalten für dieses Handy wieder aus.
- _Monitor aus_ (im selben Menü) schaltet nur den Bildschirm aus, ohne Countdown.

## Beenden und wieder einschalten

- Am PC zeigt Nemo immer an, wenn ein Gerät steuert: im Fenster oben und am Symbol neben der Uhr.
- **Sofort beenden:** dort _Fernsteuerung beenden_. Das Handy ist danach pausiert und kann nichts mehr steuern.
- **Wieder einschalten:** am PC unter _Einstellungen → Verbindungen → Fernsteuerung_ beim Gerät _Wieder einschalten_.
- **Ganz aus:** _Fernsteuerung erlauben_ ausschalten. Der Abgleich im Heimnetz läuft unverändert weiter.

## Gut zu wissen

- Unterwegs oder in einem fremden WLAN geht die Fernbedienung nicht. Das ist Absicht.
- Programme, die mit Administratorrechten laufen, nehmen von der Fernbedienung keine Eingaben an. Das verhindert Windows.
- Wenn das Handy „Dein PC ist gerade nicht erreichbar“ zeigt: Läuft Nemo am PC, und sind beide Geräte im selben WLAN?
- Die Tastatur deines Handys lernt getippte Wörter. Für ein Passwort nutze ihren Inkognito-Modus.
