# Entwicklung: App lokal starten

## App (`web/`)

Voraussetzung: Node.js ≥ 22.

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

| Befehl | Zweck |
|---|---|
| `npm run build && npm run preview` | Produktionsbuild auf http://localhost:4173 |
| `npm run lint` / `npm run typecheck` | Statische Prüfungen |
| `npm test` | Unit- und Komponententests (Vitest) |
| `npm run e2e` | Alle Ende-zu-Ende-Tests (inkl. Barrierefreiheits-Prüfung mit axe-core) (Playwright, Desktop + „Pixel 7“, danach die Multi-Geräte-Sync-Tests mit echtem Server) |
| `npm run e2e:app` / `npm run e2e:sync` | Nur App-Tests / nur Sync-Tests |
| `npm run gen:module -- <id> "<Name>"` | Neues Modul aus dem Template erzeugen |

Für die E2E-Tests braucht Playwright einen Chromium (`npx playwright install chromium`, oder `PW_CHROMIUM_PATH` setzen).
Die Sync-Tests starten den Server aus `../server` selbst (Abhängigkeiten dort vorher mit `npm install` installieren).

Weiter: [`ARCHITECTURE-MAP.md`](../ARCHITECTURE-MAP.md), [`HOW-TO.md`](../HOW-TO.md), [`../CONTRIBUTING.md`](../../CONTRIBUTING.md).
