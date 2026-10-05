# Suche, KI-Assistent und KI-Import

## Suche und KI-Assistent

Strg+K (Handy: das Suchfeld oben) öffnet die Befehlspalette: springen, in allen Modulen suchen und Fragen stellen.

- **Lokal, ohne Kosten:** einfache Fragen versteht die App selbst – „Was steht heute an?“, „Termine morgen“, „offene Rechnungen“,
  „überfällige Aufgaben“, „Kontostand“, „Was kosten meine Abos?“, „Wie viel muss ich noch bezahlen?“, „suche Zahnarzt“.
  Kurze Stichworte starten die Volltextsuche.
- **Mit KI (optional):** komplexere Fragen („Wie viel habe ich im September für Lebensmittel ausgegeben?“) und Sätze wie
  „Erinnere mich jeden 1. an Miete“ kann die App an KI-Anbieter geben. _Einstellungen → KI-Assistent_: Anbieter hinzufügen –
  **Claude**, **OpenAI**, **Google Gemini**, **Groq**, **OpenRouter** (auch kostenlose Modelle), **Mistral**, **Ollama** (lokal) oder ein
  eigener OpenAI-kompatibler Server. Mehrere Anbieter werden **der Reihe nach** gefragt (lokal → kostenlos → bezahlt, per Pfeiltasten
  änderbar); ist einer erschöpft, gestört oder abgelehnt, springt der nächste ein. Pro Anbieter lassen sich Limits (Anfragen pro Tag, Kosten
  pro Monat) und Preise einstellen; die Einstellungen zeigen Anfragen, Fehler, Ersatz-Einsätze und geschätzte Kosten. „Verbindung testen“
  prüft einen Anbieter mit einer Minimal-Anfrage. Kostenlose Anbieter nutzen Eingaben teils für Training – die App weist darauf hin.
  In der installierten App (Windows/Android) gibt es keine CORS-Einschränkung; im Browser hängt die Erreichbarkeit vom Anbieter ab.
- **Datenschutz:** an die Anbieter gehen nur deine Frage, das heutige Datum und eine kurze Beschreibung der aktiven Module – **niemals deine
  Daten** (und nie der Passwort-Tresor „Accounts“). Das Modell wählt nur eine strukturierte Abfrage; sie wird lokal geprüft und ausgeführt.
  API-Schlüssel bleiben verschlüsselt in der Datenbank dieses Geräts (nicht synchronisiert, nicht im Backup).
- **Kosten im Blick:** identische Fragen am selben Tag kommen aus dem Cache (0 Token); Verbrauch pro Antwort und insgesamt steht in der Antwort
  bzw. den Einstellungen.
- **Anlegen nur mit Bestätigung:** schlägt die KI einen neuen Eintrag vor, zeigt die App ihn erst an; gespeichert wird nach „Anlegen“.

## Eintragen per KI

Schreibe einfach in die Leiste, was du eintragen willst – zum Beispiel „Rechnung Stadtwerke 89,90 € fällig 15.10.“, „Abo Netflix 12,99 monatlich ab 1.11.“, „Lösche das Abo Spotify“ oder „Markiere die Stadtwerke-Rechnung als bezahlt“. Mehrere Einträge trennst du mit Zeilenumbruch oder Semikolon.

- **Immer erst eine Vorschau:** Felder lassen sich ändern, bei Änderungen und Löschungen siehst du Vorher/Nachher, fehlende Angaben fragt die Vorschau ab. Gespeichert wird erst mit „Eintragen“ (Enter), „Rückgängig“ im Hinweis macht alles wieder rückgängig.
- **Kostet fast nichts:** Zuerst versuchen feste Regeln den Satz zu verstehen (0 Token, nichts verlässt das Gerät). Nur wenn das nicht reicht und du es erlaubst, wird ein KI-Anbieter gefragt – mit dem Satz, dem Datum und den Feldnamen der Module, nie mit deinen Einträgen. Die Statistik unter _Einstellungen → KI_ zeigt, woher jede Antwort kam.
- **Steuerbar:** unter _Einstellungen → KI → Eintragen per KI_ global und pro Modul ausschaltbar. Im Modul gibt es oben „Mit KI eintragen“. Der Passwort-Tresor ist nie dabei.
- **Dein Claude-Abo:** Anthropic erlaubt Abo-Zugänge nur in Claude Code und claude.ai, nicht in anderen Apps. Wenn du dein Abo nutzen willst, lass Claude Code auf deinem PC Nemo befüllen (siehe unten).

## Daten per KI importieren

Vorhandene Daten muss man nicht abtippen: Eine KI (Claude Code, ChatGPT …) liefert sie im Format der App, du bestätigst eine
Vorschau. In der Windows-App über eine lokale, abgesicherte Schnittstelle (_Einstellungen → KI-Zugriff_, standardmäßig aus),
überall sonst per „JSON einfügen“ im Startdaten-Assistenten. Anleitung, Beispiele und fertiger Prompt:
[`docs/AI-IMPORT.md`](../AI-IMPORT.md).

## Chat

Das Modul **Chat** (in der Modulbibliothek aktivieren) ist ein einfacher Chat mit mehreren Gesprächen. Jeder Chat antwortet entweder mit dem **eingebauten lokalen Modell** (nur Windows, offline, kostenlos) oder mit **deinen Anbietern** aus Einstellungen → KI.

- Standardmäßig sieht der Chat **keine Daten aus der App**. Im Chat-Zahnrad kannst du Module auswählen, aus denen er Fragen beantworten darf. Beim Senden mit „Daten anhängen“ siehst du vorher genau den Text, der mitgeschickt wird. Der Tresor ist nie dabei.
- Antworten kannst du kopieren, neu erzeugen lassen; eigene Fragen lassen sich ändern. Chats lassen sich umbenennen, anheften, archivieren, als Markdown exportieren und endgültig löschen.
- Einstellungen → Module → Chat: Standard-Antwortweg und „Alte Chats löschen nach“.
