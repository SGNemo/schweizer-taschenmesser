# Einrichtung des Agenten-Teams v3 – Schritt für Schritt (für Sven)

Alles hier wurde gegen die Doku vom 2026-11-08 geschrieben ([REVIEW.md](REVIEW.md) hat die Links). Befehle, die die Sandbox nicht ausführen konnte, sind mit **„nicht hier geprüft“** markiert. Die Sandbox hat geprüft: `validate.mjs`, `to-ant.mjs`, `session.mjs --dry-run`, das SDK-Paket `@anthropic-ai/sdk@1.6.0` (Methoden `beta.sessions.create/update`, `events.stream/send`, `threads.list/archive`).

Voraussetzungen: Node ≥ 20, ein Konto auf `platform.claude.com` mit Workspace, GitHub-Zugriff auf `SGNemo/schweizer-taschenmesser`.

## 1 Console (`platform.claude.com`) – nur zum Nachsehen

1. **API-Key:** `platform.claude.com/settings/keys` → „Create Key“ → Name `nemo-agents` → Wert einmal kopieren, lokal als `ANTHROPIC_API_KEY` setzen (Shell-Profil oder Passwort-Manager; nie ins Repo). _Screenshot-Hinweis: die Seite zeigt den Key nur einmal._
2. **Agent-Builder** (`platform.claude.com/workspaces/default/agent-quickstart`): einstellbar laut Doku: Modell, System-Prompt (Volltext-Editor), MCP-Server per URL + Anmeldung, Tools (vorgefertigtes Toolset + MCP-Tools), Skills aus der Workspace-Bibliothek, Test-Session mit Event-Stream; die Console zeigt daneben den äquivalenten API-Aufruf. **Nicht** in der Console (laut Doku nur API/CLI): `multiagent`-Block, `effort`/`speed`, Repo-Mount, Session-Budget, Environment-Netzwerk-Details, Vault-Zuordnung je Session. Deshalb Weg 2 für alle 20 Agenten. Wichtig: in der Console angelegte Agenten kann `ant apply` **nicht übernehmen** (es legt Duplikate an) – also nichts von Hand anlegen, nur ansehen.
3. **Sessions nachsehen:** Console → Agents → Sessions: Event-Stream, Threads je Subagent, Budget-Stand (`session.usage`), offene Tool-Bestätigungen.

## 2 `ant` CLI – alle 20 Agenten + Environment

1. **Installieren** (nicht hier geprüft):
   ```bash
   brew install anthropics/tap/ant
   ```
   Linux/WSL: `VERSION=2.7.1` und das Tar von `https://github.com/anthropics/anthropic-cli/releases/download/v${VERSION}/ant_${VERSION}_<os>_<arch>.tar.gz` nach `/usr/local/bin`. Mindestens **1.40.0** (Pfad-Verweise in `multiagent`). Prüfen: `ant --version`.
2. **Anmelden:** `ant auth login` (Browser-Flow) – danach nutzen CLI und SDK dieselben Credentials; alternativ `export ANTHROPIC_API_KEY=…`.
3. **Prüfen, was angelegt wird** (im Repo-Root, Branch `develop` nach dem Merge dieses PRs):
   ```bash
   node scripts/agents/validate.mjs
   node scripts/agents/to-ant.mjs --check
   ant apply --dry-run docs/meta/agents-v3/environment.yaml docs/meta/agents-v3/nemo-*.md
   ```
   Der Dry-Run zeigt den Plan: 1 Environment, 20 Agenten; `nemo-lead.md` verweist mit `./nemo-po.md` usw. auf die 19 – `ant apply` legt sie **in Abhängigkeitsreihenfolge** an (erst die 19, dann der Lead mit den echten IDs). Eine Reihenfolge von Hand ist nicht nötig.
4. **Anwenden** (nicht hier geprüft):
   ```bash
   ant apply docs/meta/agents-v3/environment.yaml docs/meta/agents-v3/nemo-*.md
   ```
   Ergebnis: `claude-lock.json` im Repo-Root mit je Datei `kind`, `id` (`agent_…`, `env_…`), `version`, `hash`. **Committen** (Branch + PR wie immer; keine Secrets darin). `session.mjs` liest Lead- und Environment-ID aus dieser Datei.
5. **Aktualisieren bei Prompt-Änderung:** JSON ändern → `node scripts/agents/to-ant.mjs` → `node scripts/agents/validate.mjs` → `ant apply …` für die geänderten Dateien. Der Lead pinnt die Versionen der 19 (Snapshot beim Anlegen/Ändern); nach einer Änderung an einem Subagenten deshalb **`ant apply` auch für `nemo-lead.md`** ausführen, sonst delegiert er an die alte Version. Laufende Sessions behalten ihre Konfiguration; Änderungen gelten für neue Sessions. `SHARED.md` dagegen wirkt sofort für jede neue Thread-Lesung – ohne `ant apply`.
6. Aufräumen: `ant apply --prune` entfernt Ressourcen, die im Lockfile stehen, aber keine Datei mehr haben (z. B. nach dem Umbenennen des Ordners beim Umstieg).

## 3 Vault und GitHub

1. **Fine-grained PAT** (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Generate): Resource owner SGNemo, nur Repository `schweizer-taschenmesser`, Laufzeit ≤ 90 Tage. Rechte: **Contents: Read and write**, **Pull requests: Read and write**, **Issues: Read and write** (Labels, Kommentare), **Actions: Read and write** (Runs lesen, fehlgeschlagene Jobs neu starten), **Metadata: Read** (automatisch). **Workflows: Read and write** nur, wenn devops `.github/workflows/**` pushen soll. **Kein** `Administration`, kein `Secrets`, kein `Environments`. Wert einmal kopieren → lokal `GITHUB_TOKEN` (für `session.mjs`).
2. **Ruleset auf `main`** (Repo → Settings → Rules → Rulesets → New branch ruleset): Target `main`; Rules: Restrict deletions, Block force pushes, Require a pull request before merging, Require status checks (die CI-Jobs), **Bypass list leer**. Für `develop` ein zweites Ruleset ohne Review-Pflicht (sonst kann `nemo-merge` nicht mergen: Approvals vom Token-Inhaber zählen auf eigenen PRs nicht), aber mit Required checks + Block force pushes.
3. **Vault anlegen** (Console → Vaults, oder API; nicht hier geprüft):
   ```bash
   # Vault
   curl https://api.anthropic.com/v1/vaults -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2026-10-21" -H "anthropic-beta: managed-agents-2026-04-01" \
     -d '{"display_name":"nemo-github"}'
   # Credential 1: GitHub MCP (Bearer = PAT), gematcht über die Server-URL
   curl https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2026-10-21" -H "anthropic-beta: managed-agents-2026-04-01" \
     -d '{"display_name":"github-mcp","auth":{"type":"static_bearer","mcp_server_url":"https://api.githubcopilot.com/mcp/","token":"'"$GITHUB_TOKEN"'"}}'
   # Credential 2: $GITHUB_TOKEN in der Sandbox (Platzhalter, am Ausgang nur im Header ersetzt, nur für api.github.com)
   curl https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2026-10-21" -H "anthropic-beta: managed-agents-2026-04-01" \
     -d '{"display_name":"github-rest","auth":{"type":"environment_variable","secret_name":"GITHUB_TOKEN","secret_value":"'"$GITHUB_TOKEN"'","networking":{"type":"limited","allowed_hosts":["api.github.com"]},"injection_location":{"header":true}}}'
   ```
   Die Vault-ID (`vlt_…`) lokal als `NEMO_VAULT_ID` setzen. Ein Eintrag für beides gibt es nicht (ein Credential = ein `auth.type`). Rotation: Credential aktualisieren (Wert änderbar, Schlüssel nicht) – wirkt auch in laufenden Sessions.
4. **Repo-Ressource:** macht `session.mjs` bei jedem Start (`url`, `mount_path: /workspace/schweizer-taschenmesser`, `checkout: develop`, `authorization_token` = `$GITHUB_TOKEN`). Das ist die dritte Stelle desselben PAT; sie allein regelt `git clone/push`.
5. **Test** (erste Session, Budget 2 USD): Auftrag „Lege Branch `test/agents-v3-smoke` von `origin/develop` an, committe eine Zeile in `scribble/BOARD.md`, pushe, versuche danach `git push origin HEAD:main` und melde beide Ergebnisse. Nichts mergen.“ Erwartet: Push auf den Branch geht, Push auf `main` scheitert am Ruleset. Branch danach löschen (nicht hier geprüft).

## 4 Session starten – Svens Alltags-UI

```bash
cd scripts/agents && npm i && cd ../..          # einmalig: @anthropic-ai/sdk
export ANTHROPIC_API_KEY=… GITHUB_TOKEN=… NEMO_VAULT_ID=vlt_…   # oder `ant auth login` statt API-Key
node scripts/agents/session.mjs --budget 15 "Starte Paket 2 Website"
node scripts/agents/session.mjs --budget 15 --title "Paket 2" --file auftrag.md
```

Was passiert: Session mit Lead-Agent + Environment (IDs aus `claude-lock.json`), Repo-Mount auf `develop`, Vault, **Budget in USD** (Pflicht – nachträglich nicht setzbar; intern Cent, `15` → `"1500"`), Titel; dann wird die Nachricht gesendet und der Event-Stream in die Konsole geschrieben: Lead-Texte, Tool-Aufrufe (kurz), Delegationen (`→ nemo-frontend: …`), Berichte (`← nemo-frontend: …`), Nutzung (`list cost` in Cent). Ende, wenn die Session `idle` wird:

- `end_turn`: der Lead ist fertig – Antwort steht in der Konsole (3 Punkte + PR-Links).
- `requires_action`: ein Tool wartet auf Freigabe (sollte mit `always_allow` nicht vorkommen) → erneut mit `--auto-approve` starten oder in der Console freigeben.
- `budget_reached`: Session pausiert mit Stand; siehe 5.
  Flags: `--agent/--env/--vault` überschreiben die IDs, `--checkout` den Branch, `--verbose` zeigt Tool-Ergebnisse, `--dry-run` zeigt nur den Request (Token maskiert). Konsole: zum Nachsehen `platform.claude.com` → Sessions.

## 5 Wiederanlauf

- **Fortsetzen / Nachfrage:** `node scripts/agents/session.mjs --session sess_… "Bitte Paket 2b starten"` – Verlauf und Sandbox bleiben (Sandbox-Zustand 30 Tage ab Erstellung).
- **Budget erhöhen:** `node scripts/agents/session.mjs budget sess_… 30` – muss über dem verbrauchten Betrag liegen; eine pausierte Session läuft von selbst weiter. Entfernen (einmalig, nicht rückgängig) nur per API (`budget: null`).
- **Unterbrechen:** `node scripts/agents/session.mjs interrupt sess_…`, dann neue Nachricht.
- **Threads:** `node scripts/agents/session.mjs threads sess_…` zeigt Primär- und Kind-Threads (Grenze 25 gleichzeitig); `--archive-idle` archiviert fertige Kind-Threads (gibt Plätze frei, der Lead kann sie dann nicht mehr nachfragen).
- **Agenten aktualisieren:** Schritt 2.5; danach neue Session (laufende behalten die alte Konfiguration).
- **Repo wechseln oder Token rotieren:** Repo = neue Session; Token = `ant beta:sessions:resources update` bzw. Vault-Credential aktualisieren.
- **Archivieren:** Console oder API (`POST /v1/sessions/{id}/archive`) – beendet den Container; Löschen entfernt auch den Verlauf.
