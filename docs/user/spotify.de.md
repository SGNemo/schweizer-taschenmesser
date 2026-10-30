# Spotify: „Läuft gerade“ auf der Übersicht

Nemo kann auf der Übersicht in einer ruhigen Zeile zeigen, was in Spotify läuft, und Pause/Weiter und Nächster anbieten. Nemo spielt selbst keine Musik ab. Vorerst nur in der Windows-App.

Du brauchst eine eigene, kostenlose Spotify-„App“ – einmalig ein paar Minuten:

1. Öffne das [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) und melde dich mit deinem Spotify-Konto an (Entwicklerbedingungen annehmen).
2. **Create app.** Name und Beschreibung sind frei. Bei *Redirect URIs* genau `http://127.0.0.1:38417/callback` eintragen (nicht `localhost`, kein Schrägstrich am Ende). Bei *APIs used* **Web API** ankreuzen. Speichern.
3. App öffnen → *Settings* → **User management**: dein eigenes Spotify-Konto hinzufügen (Name und E-Mail-Adresse dieses Kontos). Apps im Entwicklungsmodus funktionieren nur für dort eingetragene Konten.
4. **Client ID** kopieren (nicht das Secret – das braucht Nemo nicht).
5. In Nemo: *Einstellungen → Verbindungen → Spotify*, Client ID einfügen, speichern. **Anzeigen** (was läuft) wählen und, wenn du magst, **Steuern** (Pause, Weiter, Nächster).
6. **Verbinden** klicken. Der Browser öffnet Spotify; Zugriff erlauben. Danach zeigt Nemo auf der Übersicht „Läuft gerade: …“, sobald etwas läuft.

Gut zu wissen:
- Steuern braucht Spotify **Premium**. Ohne Premium blendet Nemo die Knöpfe einmal mit einem kurzen Hinweis aus; die Anzeige funktioniert weiter.
- „Port belegt“: ein anderes Programm nutzt Port 38417. Schließe es und klicke erneut auf Verbinden – Nemo weicht nie auf einen anderen Port aus, weil Spotify die Adresse genau prüft.
- Optional: **Musik in der Fokus-Runde** (Einstellungen → Fokus & Aufmerksamkeit → Weitere Einstellungen, standardmäßig aus; braucht *Steuern*). Nemo kann beim Start weiterspielen oder eine deiner Playlists starten (beim Verbinden *Playlists* ankreuzen) und am Ende pausieren. Spotify wird nur zu Beginn und am Ende einer Runde angesprochen; klappt das nicht, läuft die Runde ganz normal weiter.
- Nemo fragt etwa alle 30 Sekunden bei Spotify nach, nur solange die App offen und sichtbar ist. Titel und Interpret bleiben auf diesem Gerät: kein Sync, keine KI, keine Fehlerberichte.
- Trennen jederzeit unter *Verbindungen → Spotify*; den Zugriff der App kannst du auch in deinem Spotify-Konto entziehen.
- Spotify kann die Regeln für Entwickler-Apps ändern; wenn die Verbindung nicht mehr geht, schau zuerst ins Dashboard.
