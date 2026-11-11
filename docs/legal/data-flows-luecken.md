# Datenflüsse – Lücken

Teil von [DATA-FLOWS](DATA-FLOWS.md) (kein Rechtsrat).

## Lücken, die beim Lesen auffielen (nicht geändert, keine Funktionsänderung)

- Schreib-Pipeline: Cloud-Fallback ist standardmäßig an, solange kein lokales Modell aktiv ist (`cloudAllowed`); wirksam erst mit eingerichtetem Anbieter.
- Chat-Modul sendet mehr als der Assistent und ist nicht von `privacy.test.ts` abgedeckt. Der Chat zeigt jetzt bei „Meine Anbieter“ einen Hinweis, dass der Text das Gerät verlässt, mit der Schaltfläche „KI abschalten …“ (führt zu Einstellungen → KI).
- Währungsrechner holt Kurse ohne Rückfrage.
- Google-Status „Testing“: die App erkennt ihn nicht, nur die Folge (`invalid_grant`/401 → „Abgelaufen“, kein Vorab-Ablaufdatum).
