# Taschenmesser

Modulare, local-first Alltags-App (PWA) – Kalender, ToDos, Finanzen & mehr als aktivierbare Module.
Daten bleiben lokal in IndexedDB; Sync über einen eigenen Server ist optional (Phase 4).

Architektur, Konventionen und der Ablauf „neues Modul anlegen“: siehe [CLAUDE.md](CLAUDE.md).

## Setup: App (`web/`)

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
| `npm run e2e` | Ende-zu-Ende-Tests (Playwright, Desktop + „Pixel 7“) |
| `npm run gen:module -- <id> "<Name>"` | Neues Modul aus dem Template erzeugen |

Für E2E-Tests muss einmalig ein Chromium vorhanden sein (`npx playwright install chromium`), oder `PW_CHROMIUM_PATH` setzen.

### Als PWA installieren
Chrome/Edge (Windows) bzw. Chrome (Android) öffnen → „App installieren“. Service Worker und Installation
brauchen HTTPS (oder `localhost`).

## Setup: Sync-Server (`server/`)
Folgt in Phase 4 (Fastify + SQLite, Dockerfile, docker-compose, Token-Auth, Betrieb im LAN/Tailscale).

## Sicherheit
Keine Secrets im Repository. API-Keys (z. B. für die KI-Suche) und Sync-Tokens werden nur lokal im Browser
gespeichert und nie synchronisiert oder exportiert.
