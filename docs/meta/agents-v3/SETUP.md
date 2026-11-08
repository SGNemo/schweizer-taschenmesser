# Einrichtung des Agenten-Teams v3 – Schritt für Schritt (für Sven)

Alles hier wurde gegen die Doku vom 2026-11-08 geschrieben ([REVIEW.md](REVIEW.md) hat die Links). Befehle, die die Sandbox nicht ausführen konnte, sind mit **„nicht hier geprüft“** markiert. Die Sandbox hat geprüft: `validate.mjs`, `to-ant.mjs`, `session.mjs --dry-run`, das SDK-Paket `@anthropic-ai/sdk@1.6.0` (Methoden `beta.sessions.create/update`, `events.stream/send`, `threads.list/archive`).

Voraussetzungen: Node ≥ 20, `jq`, `gh` (angemeldet), ein Konto auf `platform.claude.com` mit Workspace, GitHub-Zugriff auf `SGNemo/schweizer-taschenmesser`. **Reihenfolge:** (1) diesen PR mergen, (2) diese Anleitung mit den Pfaden `docs/meta/agents-v3/…` durchführen und das Team ausprobieren, (3) erst danach die Umstellung aus README „Switch-over“ (Ordner → `docs/meta/agents/`; dann Pfade in den 20 Prompts, in `session.mjs` und hier ändern und erneut `ant apply`). Alle `ant`-Befehle: **nicht hier geprüft** (kein `ant` in der Sandbox).

## 0 Windows (Git Bash / MinTTY)

Einmalig in PowerShell oder Git Bash (nicht hier geprüft), danach **das Fenster neu öffnen**, damit `jq` und `ant` im `PATH` stehen:

```bash
winget install jqlang.jq
```

```bash
winget install --id Anthropic.Ant --exact
```

Zeilenenden: `.gitattributes` hält `docs/meta/agents-v3/**` und `scripts/agents/**` auf LF, sonst meldet `to-ant.mjs --check` bei `core.autocrlf=true` jede Datei als „stale“ (so gesehen am 2026-11-08: 20× stale bei identischem Inhalt). Bestehender Checkout nach dem Merge einmal, bei sauberem Arbeitsbaum (nicht hier geprüft): `git ls-files -z docs/meta/agents-v3 scripts/agents | xargs -0 rm && git checkout -- docs/meta/agents-v3 scripts/agents` – schreibt die Dateien mit LF neu.

## 1 Console (`platform.claude.com`) – API-Key anlegen, sonst nur zum Nachsehen

1. **API-Key:** `platform.claude.com/settings/keys` → „Create Key“ → Name `nemo-agents` → Wert einmal kopieren (die Seite zeigt ihn nur einmal), lokal als `ANTHROPIC_API_KEY` setzen (Shell-Profil oder Passwort-Manager; nie ins Repo). Der Key ist der eine Pfad für CLI, SDK und die curl-Aufrufe unten.
2. **Agent-Builder** (`platform.claude.com/workspaces/default/agent-quickstart`): einstellbar laut Doku: Modell, System-Prompt (Volltext-Editor), MCP-Server per URL + Anmeldung, Tools (vorgefertigtes Toolset + MCP-Tools), Skills aus der Workspace-Bibliothek, Test-Session mit Event-Stream; die Console zeigt daneben den äquivalenten API-Aufruf. **Nicht** in der Console (laut Doku nur API/CLI): `multiagent`-Block, `effort`/`speed`, Repo-Mount, Session-Budget, Environment-Netzwerk-Details, Vault-Zuordnung je Session. Deshalb Weg 2 für alle 21 Agenten. Wichtig: in der Console angelegte Agenten kann `ant apply` **nicht übernehmen** (es legt Duplikate an) – also nichts von Hand anlegen, nur ansehen.
3. **Sessions nachsehen:** Console → Agents → Sessions: Event-Stream, Threads je Subagent, Budget-Stand (`session.usage`), offene Tool-Bestätigungen.

## 2 `ant` CLI – alle 21 Agenten + Environment

**Git Bash/MinTTY:** `gh auth login` nur mit `winpty gh auth login` (sonst hängt die Eingabe), `ant apply` immer mit `--yes` (die Rückfrage kann MinTTY nicht beantworten).

1. **Installieren** (nicht hier geprüft):
   ```bash
   brew install anthropics/tap/ant
   ```
   Linux/WSL (x86_64):
   ```bash
   VERSION=2.7.1; curl -L "https://github.com/anthropics/anthropic-cli/releases/download/v${VERSION}/ant_${VERSION}_linux_amd64.tar.gz" | sudo tar -xz -C /usr/local/bin ant
   ```
   Mindestens **1.40.0** (Pfad-Verweise in `multiagent`). Prüfen: `ant --version`.
2. **Anmelden:** `export ANTHROPIC_API_KEY=…` genügt (CLI und SDK lesen die Variable). Alternative `ant auth login` (Browser-Flow; nicht hier geprüft, deckt die curl-Aufrufe in §3 nicht ab).
3. **Prüfen, was angelegt wird** (im Repo-Root, Branch `develop` nach dem Merge dieses PRs):
   ```bash
   node scripts/agents/validate.mjs
   node scripts/agents/to-ant.mjs --check
   ant apply --dry-run docs/meta/agents-v3/environment.yaml docs/meta/agents-v3/nemo-*.md   # nicht hier geprüft
   ```
   Der Dry-Run zeigt den Plan: 1 Environment, 21 Agenten; `nemo-lead.md` verweist mit `./nemo-po.md` usw. auf die 19, `nemo-auditor.md` auf dieselben ohne `nemo-merge` (18; ein Audit mergt nie) – `ant apply` legt sie **in Abhängigkeitsreihenfolge** an (erst die 19, dann Lead und Auditor mit den echten IDs). Eine Reihenfolge von Hand ist nicht nötig. Lead und Auditor stehen in **keiner** Liste: ein Agent mit `multiagent`-Block kann laut Doku kein Subagent sein (Tiefe eine Ebene, sonst 400).
4. **Anwenden** (nicht hier geprüft):
   ```bash
   ant apply docs/meta/agents-v3/environment.yaml docs/meta/agents-v3/nemo-*.md
   ```
   Ergebnis: `claude-lock.json` im Repo-Root mit je Datei `kind`, `id` (`agent_…`, `env_…`), `version`, `hash`. **Committen** (Branch + PR wie immer; keine Secrets darin). `session.mjs` sucht darin die Einträge, deren Schlüssel auf `docs/meta/agents-v3/nemo-lead.md` bzw. `environment.yaml` enden (`cat claude-lock.json` zeigt die Schlüssel; beide Schreibweisen, mit und ohne `./`, werden erkannt – geprüft mit einer nachgebauten Lock-Datei, nicht mit einer echten). Findet es sie nicht: IDs als `NEMO_LEAD_AGENT_ID` und `NEMO_ENV_ID` setzen oder `--agent`/`--env` übergeben.
5. **Aktualisieren bei Prompt-Änderung:** JSON ändern → `node scripts/agents/to-ant.mjs` → `node scripts/agents/validate.mjs` → `ant apply …` für die geänderten Dateien. Lead und Auditor pinnen die Versionen ihrer Subagenten (Lead 19, Auditor 18 ohne `nemo-merge`; Snapshot beim Anlegen/Ändern); nach einer Änderung an einem Subagenten deshalb **`ant apply` auch für `nemo-lead.md` und `nemo-auditor.md`** ausführen, sonst delegieren sie an die alte Version. Eine Änderung nur am Auditor betrifft den Lead nicht. Laufende Sessions behalten ihre Konfiguration; Änderungen gelten für neue Sessions. `SHARED.md` dagegen wirkt ohne `ant apply`, sobald sie in `develop` gemergt ist (das Mount liest `develop`) – darum mergt diese PRs nur Sven selbst.
6. Aufräumen: `ant apply --prune` entfernt Ressourcen, die im Lockfile stehen, aber keine Datei mehr haben (z. B. nach dem Umbenennen des Ordners beim Umstieg).

## 3 Vault und GitHub

1. **Fine-grained PAT** (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Generate): Resource owner SGNemo, nur Repository `schweizer-taschenmesser`, Laufzeit ≤ 90 Tage. Rechte: **Contents: Read and write**, **Pull requests: Read and write**, **Issues: Read and write** (Labels, Kommentare), **Actions: Read** (Runs und Logs lesen), **Metadata: Read** (automatisch). **Kein** `Administration`, kein `Secrets`, kein `Environments`, **kein `Workflows`** und **kein Actions: write** – beides erst, wenn die Signier-Secrets (`TAURI_SIGNING_PRIVATE_KEY*`, `ANDROID_KEYSTORE_*`) aus den Repo-Secrets in ein GitHub-Environment mit Sven als Required reviewer gewandert sind (heute liest `release.yml` sie direkt; mit `Workflows: write` könnte jeder Agent einen Branch mit einem `on: push`-Workflow pushen, der sie ausliest; mit `Actions: write` ließe sich `release.yml`/`dev-preview.yml` per `workflow_dispatch` starten). Folgen: devops legt Workflow-Änderungen als Patch in den PR-Text, Sven pusht sie; flakige Jobs startet Sven neu (nemo-merge meldet die Run-ID). Ehrlich dazu: Contents: write kann trotzdem bestehende Release-Objekte und Assets ändern (`latest.json`, exe/APK, Dev-Preview) – Releases schützt heute nur der Prompt; Abhilfe später: Immutable releases (sobald die Dev-Preview nicht mehr rollend ist) oder ein eigener Publish-Token. Wert einmal kopieren → `export GITHUB_TOKEN=…` (für `session.mjs` und die `jq`-Aufrufe in §3.3, die ihn aus der Umgebung lesen).
2. **Rulesets** (Repo → Settings → Rules → Rulesets; Bypass list überall **leer** – auch Sven hebt ein Ruleset zum Release kurz auf, statt sich einzutragen, denn der PAT handelt als Sven):
   - `main`: Restrict deletions, Block force pushes, Require a pull request before merging **mit 1 Required approval** (der PAT handelt als Sven und kann die eigene PR nicht approven – so kann kein Agent eine develop→main-PR selbst durchmergen; Release-PRs approvest du von einem zweiten Login aus oder hebst die Regel kurz auf), Require status checks (CI-Jobs).
   - `develop`: Require a pull request before merging mit **0 required approvals** (sperrt direkte Pushes, der API-Merge von `nemo-merge` geht weiter; Approvals vom Token-Inhaber zählen auf eigenen PRs ohnehin nicht), Require status checks, Block force pushes.
   - **Tag-Ruleset nur `refs/tags/v*`**: Restrict creations, updates, deletions – `release.yml` läuft auf jedem `v*.*.*`-Tag; ohne diese Sperre könnte jeder Agent mit Contents: write ein Release auslösen. **Nicht** `dev-preview*`: `dev-preview.yml` verschiebt diesen Tag bei jedem grünen `develop`-Push selbst (`PATCH git/refs/tags/dev-preview`, `force=true`) und ersetzt die Assets (`--clobber`); eine Sperre dort bricht die Dev-Preview. Auf `dev-preview` löst kein Workflow aus, das Risiko ist klein.
   - **Immutable releases vorerst aus lassen:** sie würden auch das rollende Pre-Release `dev-preview` einfrieren (Asset-Austausch scheitert). Erst sinnvoll, wenn die Dev-Preview als Draft veröffentlicht oder anders gelöst ist – Punkt für `nemo-devops`.
   - Folge für dich: mit dem `develop`-Ruleset pushen auch deine normalen Claude-Code-Chats nicht mehr direkt nach `develop`; Notizen liegen deshalb nicht mehr in `scribble/` im Repo, sondern im Session-Ordner `/workspace/scribble/` und im privaten Repo SGNemo/nemo-scribble (SHARED.md „Scribble“; entschieden 2026-11-08, `docs/decisions/meta.md`).
3. **Vault anlegen** (Console → Vaults, oder API; nicht hier geprüft):
   ```bash
   H=(-H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2026-10-21" -H "anthropic-beta: managed-agents-2026-04-01" -H "content-type: application/json")
   # Vault – die ID (vlt_…) landet in VAULT_ID
   VAULT_ID=$(curl -s https://api.anthropic.com/v1/vaults "${H[@]}" -d '{"display_name":"nemo-github"}' | jq -r .id); [ "$VAULT_ID" != null ] && echo "$VAULT_ID" || echo "Fehler: keine Vault-ID (Antwort prüfen)"
   # Credential 1: GitHub MCP (Bearer = PAT), gematcht über die Server-URL – jq liest den Token aus der Umgebung und reicht ihn per stdin an curl: nie in argv (ps), kein Heredoc
   jq -n '{display_name:"github-mcp",auth:{type:"static_bearer",mcp_server_url:"https://api.githubcopilot.com/mcp/",token:env.GITHUB_TOKEN}}' \
     | curl https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials "${H[@]}" --data @-
   # Credential 2: $GITHUB_TOKEN in der Sandbox (Platzhalter, am Ausgang nur im Header ersetzt, nur für api.github.com)
   jq -n '{display_name:"github-rest",auth:{type:"environment_variable",secret_name:"GITHUB_TOKEN",secret_value:env.GITHUB_TOKEN,networking:{type:"limited",allowed_hosts:["api.github.com"]},injection_location:{header:true}}}' \
     | curl https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials "${H[@]}" --data @-
   ```
   `export NEMO_VAULT_ID=$VAULT_ID` (dauerhaft ins Shell-Profil). Ein Eintrag für beides gibt es nicht (ein Credential = ein `auth.type`). Rotation: Credential aktualisieren (Wert änderbar, Schlüssel nicht) – wirkt auch in laufenden Sessions.
4. **Repo-Ressource:** macht `session.mjs` bei jedem Start (`url`, `mount_path: /workspace/schweizer-taschenmesser`, `checkout: develop`, `authorization_token` = `$GITHUB_TOKEN`). Das ist die dritte Stelle desselben PAT; sie allein regelt `git clone/push`.

## 4 Session starten – Svens Alltags-UI

```bash
cd scripts/agents && npm i && cd ../..          # einmalig: @anthropic-ai/sdk
 export ANTHROPIC_API_KEY=… GITHUB_TOKEN=… NEMO_VAULT_ID=vlt_…   # führendes Leerzeichen + HISTCONTROL=ignorespace hält die Werte aus der History; besser aus dem Passwort-Manager laden
node scripts/agents/session.mjs --budget 15 "Starte Paket 2 Website"
node scripts/agents/session.mjs --budget 15 --title "Paket 2" --file auftrag.md
```

Was passiert: Session mit Lead-Agent + Environment (IDs aus `claude-lock.json`), Repo-Mount auf `develop`, Vault, **Budget in USD** (Pflicht – nachträglich nicht setzbar; intern Cent, `15` → `"1500"`), Titel; dann wird die Nachricht gesendet und der Event-Stream in die Konsole geschrieben: Lead-Texte, Tool-Aufrufe (kurz), Delegationen (`→ nemo-frontend: …`), Berichte (`← nemo-frontend: …`), Nutzung (`list cost` in Cent). Ende, wenn die Session `idle` wird:

- `end_turn`: der Lead ist fertig – Antwort steht in der Konsole (3 Punkte + PR-Links). Laufen dann noch Kind-Threads, wartet das Skript weiter (Zeile „wartet auf 2 Kind-Threads (docs, deps)“, alle 30 s neu geprüft) und endet erst, wenn der Lead nach dem letzten Kind-Bericht erneut `end_turn` meldet – oder wenn alle Kinder fertig sind und die Session zwei Prüfungen lang still bleibt. `--no-wait`: Ende beim ersten `end_turn` (altes Verhalten).
- `requires_action`: ein Tool wartet auf Freigabe (sollte mit `always_allow` nicht vorkommen) → `node scripts/agents/session.mjs --session sess_… --auto-approve` (ohne Nachricht: gibt die wartenden Aufrufe frei und streamt weiter) oder in der Console freigeben.
- `budget_reached`: Session pausiert mit Stand; siehe 5.

Schlägt schon das Anlegen mit `model_not_budgetable` fehl, hat `claude-fable-5-1` (creativity, auditor) keinen Listenpreis: in `nemo-creativity.json` `claude-opus-5-5` eintragen, `to-ant.mjs`, `ant apply` für creativity, lead **und** auditor, neu starten. Betrifft es eine Auditor-Session, zusätzlich zum creativity-Wechsel oben in `nemo-auditor.json` ebenso `claude-opus-5-5` eintragen und `nemo-auditor.md` neu anwenden (der Lead braucht dafür kein neues `apply`).

Flags: `--agent lead|auditor|agent_…` (Standard `lead`; Kurzformen über `claude-lock.json`), `--env/--vault` überschreiben die IDs, `--no-wait` siehe oben, `--checkout` den Branch, `--verbose` zeigt Tool-Ergebnisse, `--dry-run` zeigt nur den Request (Token maskiert). Konsole: zum Nachsehen `platform.claude.com` → Sessions.

### Auditor starten

Einmalig anlegen (nur diese Datei; der Lead bleibt unberührt, nicht hier geprüft): `ant apply --yes docs/meta/agents-v3/nemo-auditor.md`, dann `claude-lock.json` committen (PR). Löst `ant` die Pfad-Verweise auf die 18 so nicht auf, `ant apply --yes docs/meta/agents-v3/nemo-*.md` (unveränderte Agenten bleiben gleich).

```bash
node scripts/agents/session.mjs --agent auditor --budget 5 "Prüfe PR #535"
```

Eigene Session, Auditor als Primär-Agent; er fragt die 18 (alle außer `nemo-merge`) nur zum Nachprüfen, ändert nichts, mergt nicht und kommentiert auf GitHub nur, wenn du es in der Nachricht ausdrücklich sagst. Ergebnis: `AUDIT-pr535.md` in den Session-Outputs + Berichtsblock in der Konsole. Nachfragen: `--session sess_… --agent auditor "…"` (`--agent` setzt dabei nur die Konsolen-Beschriftung). Zwischen Lead und Auditor trägst du die Berichte selbst.

### Erster Testlauf (Budget 2 USD)

```bash
node scripts/agents/session.mjs --budget 2 --title "agents-v3 smoke" "Lege Branch test/agents-v3-smoke von origin/develop an, committe eine neue Datei smoke.txt, pushe den Branch; prüfe als ausdrücklich erlaubte Ausnahme der SHARED-Regel nur mit git config --get-regexp 'remote|credential' | grep -cE 'gh[pousr]_|github_pat_|x-access-token:' || true, ob ein Klartext-Token in der Git-Konfiguration steht, und melde nur die Zahl. Nichts mergen, keine PR."
```

Die Rulesets prüfst du **nur lesend** – ein Push-Versuch mit echten Rechten würde bei einem fehlenden Ruleset wirklich `main`/`develop` bewegen, und ein Tag `v…` startet `release.yml`:

```bash
# nicht hier geprüft (kein gh-Login in der Sandbox); Feldnamen aus der GitHub-REST-Referenz
gh api repos/SGNemo/schweizer-taschenmesser/rules/branches/main      # erwartet: pull_request (required_approving_review_count 1), required_status_checks, non_fast_forward, deletion
gh api repos/SGNemo/schweizer-taschenmesser/rules/branches/develop   # erwartet: pull_request (0), required_status_checks, non_fast_forward
gh api repos/SGNemo/schweizer-taschenmesser/rulesets --jq '.[].id'   # dann je ID:
gh api repos/SGNemo/schweizer-taschenmesser/rulesets/<id> --jq '{name,target,conditions,bypass_actors}'   # Tag-Ruleset: target tag, refs/tags/v*; bypass_actors überall leer
```

Erwartet: der Agent-Push auf den Branch geht; die drei Abfragen zeigen die aktiven Regeln ohne Bypass-Einträge; Zahl 0 bei der Token-Prüfung (sonst gilt der Platzhalter-Schutz für git nicht – dann in SHARED.md die Regel „nie Remote-/Credential-Konfiguration ausgeben“ zusätzlich einschärfen). Branch danach löschen: `gh api -X DELETE repos/SGNemo/schweizer-taschenmesser/git/refs/heads/test/agents-v3-smoke` (nicht hier geprüft).

## 5 Wiederanlauf

- **Fortsetzen / Nachfrage:** `node scripts/agents/session.mjs --session sess_… "Bitte Paket 2b starten"` – Verlauf und Sandbox bleiben (Sandbox-Zustand 30 Tage ab Erstellung).
- **Budget erhöhen:** `node scripts/agents/session.mjs budget sess_… 30` – muss über dem verbrauchten Betrag liegen; eine pausierte Session läuft von selbst weiter. Entfernen (einmalig, nicht rückgängig) nur per API (`budget: null`).
- **Unterbrechen:** `node scripts/agents/session.mjs interrupt sess_…`, dann neue Nachricht.
- **Threads:** `node scripts/agents/session.mjs threads sess_…` zeigt Primär- und Kind-Threads (Grenze 25 gleichzeitig); `--archive-idle` archiviert fertige Kind-Threads (gibt Plätze frei, der Lead kann sie dann nicht mehr nachfragen).
- **Agenten aktualisieren:** Schritt 2.5; danach neue Session (laufende behalten die alte Konfiguration).
- **Repo wechseln oder Token rotieren:** Repo = neue Session. Neuer PAT: lokal `export GITHUB_TOKEN=…` (gilt für neue Sessions) und die beiden Vault-Credentials aktualisieren (Console → Vaults, oder `POST /v1/vaults/$VAULT_ID/credentials/<id>` mit neuem `token`/`secret_value` – wirkt auch in laufenden Sessions); das Repo-Mount einer laufenden Session: Console → Session → Resources, oder `ant beta:sessions:resources update <session> <resource> --authorization-token …` (nicht hier geprüft).
- **Archivieren:** Console oder API (`POST /v1/sessions/{id}/archive`) – beendet den Container; Löschen entfernt auch den Verlauf.
