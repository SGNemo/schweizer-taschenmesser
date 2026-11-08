# Work routing – Claude Code or agents?

One page for chats, agents and Sven (2026-11-08). Agent budget: 200 USD/month; one lead session with 9 delegations cost 82 USD. **Claude Code chats (subscription) build everything; the Managed Agents team only takes clearly bounded, cheap coordination and review jobs and declines the rest.** Agents: [agents-v3/README.md](agents-v3/README.md).

## Who does what

| Task                                                                    | Who               | Class      |
| ----------------------------------------------------------------------- | ----------------- | ---------- |
| Features, new modules, refactorings, design rounds, concepts, debugging | Claude Code       | –          |
| Contract/schema changes (manifest, Dexie, sync, LWW fixtures)           | Claude Code       | –          |
| Check and merge ready PRs; tidy CHATS.md/board; one review or check     | Lead              | S ≤ 5 USD  |
| Bounded fix on an open PR (review finding, red check, format, licences) | Lead → builder    | S ≤ 5 USD  |
| Dependency patch/minor bump, one CI measurement, one perf number        | Lead → ops        | S ≤ 5 USD  |
| Consolidate several reports; small docs fixes bundled                   | Lead              | M ≤ 10 USD |
| Independent audit of one PR, branch or report                           | Auditor           | M ≤ 10 USD |
| Round with up to 4 delegations (night/unattended only)                  | Lead              | L ≤ 15 USD |
| Anything above 15 USD or more than 4 delegations                        | nobody – split it | –          |
| Secrets, signing, keystore, releases, tags, rulesets, `ant apply`, PAT  | Sven himself      | –          |

## Agents decline (one line, pointing here)

Feature work, new modules, refactorings, design rounds, concepts; trial-and-error debugging; anything that will need questions back; a task without "done means …"; more than 4 delegations; a class above the session budget; secrets/signing/release (Sven himself); lead ↔ auditor directly.

Wording: `blocked – out of routing: <reason> · docs/meta/WORK-ROUTING.md · next: <Claude Code prompt head | split into …>`.

## Decision tree (30 seconds)

1. Does it write or change product code, tests or contracts? → yes: **Claude Code**.
2. Will it need questions back to Sven before it can finish? → yes: **Claude Code**.
3. Can you say "done means …" in one sentence? → no: **Claude Code** (or write the sentence first).
4. Does it fit in ≤ 4 delegations (one per agent, bundled)? → no: split it.
5. Which class – S, M or L (table above)? Above L: split it.

Result line, first line of the prompt:

```
Routing: Claude Code · <title> · <model suggestion>
Routing: Lead, S (5 USD) · <title> · done means <…>
Routing: Auditor, M (10 USD) · PR #<n>
```

## Session rules

- One session = one task = one budget (`session.mjs --class S|M|L`). Never raise it to keep going; start a new session (the lead's last report says where it stopped).
- The session ends with the report; a new topic is a new session.
- Status questions cost a full turn of the lead: read `docs/CHATS.md`, the PR list or the board instead.
- Check before a run: `node scripts/agents/session.mjs --routing-check` (prints the five questions, starts nothing).
