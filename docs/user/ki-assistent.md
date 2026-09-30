# Suche, KI-Assistent und KI-Import

## Suche und KI-Assistent

Strg+K (Handy: das Suchfeld oben) öffnet die Befehlspalette: springen, in allen Modulen suchen und Fragen stellen.

- **Lokal, ohne Kosten:** einfache Fragen versteht die App selbst – „Was steht heute an?“, „Termine morgen“, „offene Rechnungen“,
  „überfällige Aufgaben“, „Kontostand“, „Was kosten meine Abos?“, „Wie viel muss ich noch bezahlen?“, „suche Zahnarzt“.
  Kurze Stichworte starten die Volltextsuche.
- **Mit KI (optional):** komplexere Fragen („Wie viel habe ich im September für Lebensmittel ausgegeben?“) und Sätze wie
  „Erinnere mich jeden 1. an Miete“ kann die App an KI-Anbieter geben. *Einstellungen → KI-Assistent*: Anbieter hinzufügen –
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

## Daten per KI importieren

Vorhandene Daten muss man nicht abtippen: Eine KI (Claude Code, ChatGPT …) liefert sie im Format der App, du bestätigst eine
Vorschau. In der Windows-App über eine lokale, abgesicherte Schnittstelle (*Einstellungen → KI-Zugriff*, standardmäßig aus),
überall sonst per „JSON einfügen“ im Startdaten-Assistenten. Anleitung, Beispiele und fertiger Prompt:
[`docs/AI-IMPORT.md`](../AI-IMPORT.md).
