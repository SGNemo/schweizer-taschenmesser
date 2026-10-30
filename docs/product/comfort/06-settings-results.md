# 06 – Ergebnis Paket A (Einstellungen + Übergreifend)

Stand 2026-10-11, Branch `feat/comfort-settings`. Messung: Klicks/Taps ab „App offen“, abgeleitet aus den Schritten der E2E-Tests (`web/e2e/comfort-settings.spec.ts`, Desktop und Pixel 7 = 412×915), nicht mit Stoppuhr. Vorher-Werte aus `04-settings-friction.md` (Branch `docs/comfort-settings-review`). Screenshots: [screens-settings/](screens-settings/).

| Handlung | vorher D / A | jetzt D / A | Ziel | Weg jetzt |
|---|---|---|---|---|
| Theme wechseln | 3 / 4 | 2 / 3 (Palette: 0 Klicks, `Strg+K` „dunkel“ `Enter`) | 1–2 | Einstellungen → Schnellleiste (Rückgängig im Toast) |
| Dichte wechseln | 3+ / 4+ | 2 / 3 | 2 | Schnellleiste / Palette „Dichte: Kompakt“ |
| Lesehilfe an/aus | 0–3 / 4 | 0–2 / 3 | 1 | `Alt+L`, Schnellleiste, Palette |
| Einstellungen eines Moduls | 2+scroll / 3+scroll | 1 / 1 | 1 | Zahnrad im Widget oder Modul-Kopf |
| Einstellung aus Kontext | 3–4 / 4–5 | 1 / 1 | 1 | `SettingsLink` (Abschnitt wird markiert) |
| Einstellung per Alltagswort finden | nur Titel/Stichwörter | „nicht stören“, „Sicherung“ … | – | Palette ohne Präfix, Synonyme in 5 Sprachen |
| Modul (aus) in der Palette finden | nicht möglich | Name oder Zweck → Bibliothek-Karte markiert | – | `/library#module-<id>` |
| Abschnitt zurücksetzen | nicht möglich | 1 Klick + Rückgängig | – | Darstellung, Lesen, Fokus, Ruhige Erinnerungen |
| Zuletzt benutzte Abschnitte | nicht möglich | 1 (ab 2. Besuch) | – | „Häufig genutzt“ oben in der Liste |
| Suche auf dem Handy in der Kategorie | nicht sichtbar | sticky | – | |

Nicht erreicht/nicht umgesetzt (Ziel offen): **Stumm** (1–2 Klicks) – braucht Änderung der Benachrichtigungs-Pipeline, eigene Entscheidung; Backup/Update-Prüfen bleiben 3 Klicks (Palette-Treffer 0 Klicks, „Häufig genutzt“ 1–2); Kontext-Zahnrad in Dialogen (nur Widget und Modul-Kopf); „Zurücksetzen“ nur für 4 Abschnitte.

Tests: Unit 2507 grün (Suche/Synonyme, Quick-Allow-Liste, Häufig-genutzt lokal und löschbar, Deep-Links, Reset inkl. Undo und Sicherheits-Ausschluss, Palette), E2E Desktop + Pixel 7 für die genannten Wege; gesamte Suite Desktop + Pixel 7 vor den letzten Korrekturen: 758 grün, 10 rot (alle durch dieses Paket verursacht und behoben, danach die betroffenen Specs 443 grün).

Manuelle Tests offen: eine Woche Nutzung (Reizlast des Zahnrads/der Schnellleiste, „Häufig genutzt“), Gear-Sichtbarkeit auf echtem Touchgerät, Android-Zurückgeste (E2E prüft Browser-Zurück).

## Nachtrag: Stumm, Bibliothek, Werkzeugkasten (2026-10-13)
Gleiche Methode (aus den E2E-Schritten abgeleitet, keine Stoppuhr), Specs `comfort-settings`, `comfort-library`, `comfort-toolbox`.

| Handlung | vorher D / A | jetzt D / A | Weg jetzt |
|---|---|---|---|
| Erinnerungen stumm (1 Stunde / bis morgen) | 4+ / 5+ (nur Ruhezeit umstellen) | 2 / 3 (Palette „Stumm: 1 Stunde“: 0 Klicks) | Einstellungen → Schnellleiste „Stumm“ (#150) |
| Modul über Zweck finden („Abo“) | Seite durchblättern | Suchfeld in der Bibliothek, 0 Klicks | #151 |
| Startdaten eines aktivierten Moduls | 3+scroll / 4+scroll | 2 / 3 | Knopf auf der Karte (#151) |
| Timer starten | 2 / 3 | 0 Klicks (`Strg+K`, „timer 10m“, Enter) / 3 | Palette-Ausdruck (#153) |
| Einheit umrechnen und kopieren | 3 / 4 | 0 Klicks („umrechnen 5 km“, Enter kopiert) | Palette-Ausdruck (#153) |
| Zuletzt genutztes Werkzeug | 2 / 3 | 2 / 3 (Zeile oberhalb der Kacheln, ab 5 aktiven Werkzeugen) | #153 |
| Werkzeug in der Bibliothek finden | scrollen | Suchfeld, 0 Klicks | #153 |

Nicht erreicht: Modul an/aus als Schalter, Drag-and-drop-Reihenfolge, Vorschau-Widget, lösbare Tool-Fenster, Timer als Android-Benachrichtigung (Gründe: `docs/decisions/ui-shell.md`). Zusätzlich offen sind die Handtests M1–M4 (Stumm) in [MANUAL-TESTS.md](../../MANUAL-TESTS.md).

