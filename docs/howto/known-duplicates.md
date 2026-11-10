# Known duplicates – helpers and components

The list behind the rule "No copies of helpers or components" ([RULES.md](../RULES.md)). Found by the repo cleanup of 2026-10-03 (jscpd: 3 clones at 12 lines, 0.08 %), re-checked with grep on 2026-11-10. Before you add a helper, look here and in `core/` and `@/ui`. If you merge copies, delete the row in the same PR. If you find a new copy, add a row.

**P** = protected area (sync, vault, crypto, backup, localapi). Merge it only with the maintainer and a heads-up row in [CHATS.md](../CHATS.md); the byte output must stay identical.

| # | What | Copies (under `web/src/`) | Target | Note |
| --- | --- | --- | --- | --- |
| B1 | hex digest encoding | `core/ai/cache.ts`, `core/platform/fakeLocalApi.ts`, `core/localapi/config.ts` (P), `core/backup/encrypted.ts` (P), `tools/dev/hash.ts` | one `toHex` in `core/` | merge the non-P copies first |
| B2 | base64 / base64url | `core/sync/crypto.ts` (P), `core/localapi/config.ts` (P), `tools/dev/base64.ts`, `modules/accounts/bridge/control.ts` (P) | shared helper in `core/` | ROADMAP cleanup item 9 |
| B3 | byte-size formatters (different rounding) | `modules/disk/format.ts`, `modules/vault/logic.ts` (P), `tools/image/logic.ts`, `modules/downloads/lib/format.ts`, `modules/maps/own/format.ts`, `core/settings/storageInfo.ts` | one formatter via `core/i18n/format` | tests pin the outputs; decide one rounding first |
| B4 | two-digit pad / `HH:mm` built inline (`padStart(2, '0')`) | about 48 files (`grep -rl "padStart(2, '0')" web/src`) | `pad2` in `core/time/now.ts`, an `hhmm` helper next to it | grew since 2026-10-03; replace when you touch a file |
| B5 | quick-capture date math on `{y,m,d}` triples | `quickCapture/parser/util.ts` | wrap the string helpers of `core/time/dates.ts` | deliberate; medium risk |
| B6 | own time regex | `modules/calendar/settings.ts` (`TIME`) | `TIME_RE` from `core/time/dates.ts` | swapping it broke the pantry hand-over e2e in CI only (load order?); find the cause first (ROADMAP cleanup) |
| B7 | editor footer Save / Cancel / Delete | about 9 module editors | `EditorActions` in `@/ui` | ROADMAP cleanup item 3; `NoteEditor` has a scratch variant |

Merged by the cleanup (no action): the backup stamp (`stampOf` in `core/backup/safety.ts`), B6 in `pantry/schema.ts` (`DATE_RE`), B8 fixed `de-DE` number formats (now `core/i18n/format`). No parallel libraries for dates, icons or fetch.
