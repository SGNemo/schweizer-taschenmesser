# Planner hub – links today and contract constraints (chat A)

As of `develop` `6ef3a2cb4`, 2026-11-15. Paths relative to `web/src/`. Second half of [ANALYSIS-SOURCES.md](ANALYSIS-SOURCES.md) (its §2 and §3); P-numbers refer to the friction table there. Read in the code unless marked _(inferred)_.

## 2 Links today

### 2.1 Five mechanisms, no shared one

| Mechanism | Shape | Stored | Synced | Rendered |
| --- | --- | --- | --- | --- |
| ToDo `links[]` | `{ kind: 'note' \| 'mail' \| 'invoice' \| 'event', id, label }` (`modules/todos/schema.ts:23-28`, `:71`) | on the task | yes; not `internal`, so also import format / data API _(inferred from `core/dataapi/format.ts:91`)_ | ToDo editor list, `linkPath` → `/<module>?open=<id>` (`todos/components/TaskEditor.tsx:44-47`, `:301-321`) |
| `PlannableItem.link` | the same shape, one only (`core/modules/types.ts:608`) | nowhere: read from the source at each run | – | planner row menu: `note` (`planner/routes/PlannerPage.tsx:584`), `mail` only while mail is on (`:595`) |
| mail `link` row | `{ accountKey, threadId, messageId, type, moduleId, collection, entryId }` (`mail/schema.ts:75-83`) | `mail_link` | **no**: `local: true`, `dataApi: false` (`mail/manifest.ts:48-53`) | thread view „Angelegt“ → module page (`mail/links.ts:67`, `LinkedEntries.tsx:30`); row hint „im Plan“ (`mail/planMail.ts:87`) |
| `planMark` | `{ date, order, prior? }`, `internal` (`todos/schema.ts:37-41`, `:63`) | on the task | yes | not a link: marks `plannedFor` as planner-owned (`types.ts:620`) |
| planner item | `source: { module, id }`, key `<module>:<id>` (`planner/schema.ts:47`) | `planner_item`, `dataApi: false` | yes | the only planner → source pointer; nothing reads it from the source side (P47) |

Besides these: the mail's web URL as text in `note` (ToDo `planMail.ts:69`, invoice `mail/invoiceRow.ts:355`), and finance bookings with the id convention `inv-<invoiceId>`.

Who writes a link: quick capture `todo` / `plan` targets (`quickCapture/targets/adapters.ts:54`), `todo.requested` → `todos/services.ts:33`, `plan.requested` → `planner/actions.ts:121`. No other target keeps `f.link`.

### 2.2 How a mail is referenced

- ToDo link: the provider **thread id** + the cleaned subject as label (`planMail.ts:76`). Invoice: no link; its id is `mail-<hash(messageId, 'invoice')>` (`invoiceRow.ts:55`), "never an address or the device-local account key" (`:11-14`).
- Stored URL: `mailWebUrl(…, { forStorage: true })` drops `?authuser=<address>` (`core/mail/service.ts:69-78`). Without the mail module the editor opens `mailThreadUrl(id)` (`:84`).
- `/mail?open=` treats the value as untrusted: a plain id that is in this account's cache, else the toast `notHere` (`mail/routes/MailPage.tsx:298-311`).
- Cache: threads and bodies "device-local, never synced, never in a backup", sealed with the device key (`mail/schema.ts:27-30`). `docs/legal/DATA-FLOWS.md:16`: „`gmail.readonly`: nur auf Klick Absender/Betreff/Datum/… nie Inhalt“. `docs/legal/data-flows-hinweise.md:5`: „ein Mail-Link (Thread-Id, Betreff) … nie Mail-Adresse, Kontoschlüssel oder Mailtext. Mail-Cache und `link`-Tabelle bleiben `local: true`, `dataApi: false`“.
- Mail is `platforms: ['desktop']` (`mail/manifest.ts:64`): on Android no in-app target exists.

### 2.3 Trace: Mail → invoice → dunning → planner

1. **Invoice mail, „Anlegen“** (`invoiceRow.ts`): `saveCapture('invoice')` under the message-derived id. The invoice target builds payee, amount, due date, note (`adapters.ts:160-176`) and has no link field to fill. A local link row mail → invoice is saved (`:326-336`). **Break A (P40):** the synced invoice knows its mail only as URL text.
2. **Invoice page:** the note is a plain fact row (`invoices/components/InvoiceDetail.tsx:52`); nothing says "from a mail" or "in the plan". **Break B (P56, P47).**
3. **Dunning mail, „Mahnung vermerken“:** `findOpenInvoice` (`quickCapture/targets/lookup.ts:69`) → `amendCapture('invoice', …)` writes exactly `dunningLevel`, `dunnedAt` and one note line (`adapters.ts:194-220`). `reminderFields` carries no note or link (`invoiceRow.ts:269-276`), so the dunning mail survives only as a local link row (`:419-421`). **Break C (P41):** no synced trace of which mail was the reminder.
4. **Planner:** the invoice is offered under the same item id as before, title „… bezahlen“, `detail` „Mahnung · …“ parsed back out of the note line (`invoices/plannable.ts:24-35`), `to` = the invoice, no `link` (`:51-61`), priority fixed at 2 (`:16`), hard due = the old `dueDate` (`:59`). **Break D (P42, P49):** no way to either mail; the reminder's deadline is text only. The menu code itself is source-agnostic (`PlannerPage.tsx:595`): a `link` from invoices would show today.
5. **Back in the mail:** both threads list „Rechnung: <payee>“, linking to `/invoices` without `?open=` (`mail/links.ts:67`), on this device only. **Break E (P44, P45).**
6. **Paid:** `invoice.paid` → finance; the invoice leaves the plan list. The mail keeps its row; nothing closes a ToDo that was planned from the same mail _(inferred: `todos/services.ts:65-66` listens only to `todo.requested` / `todo.doneRequested`)_.

So of the six arrows in "planner ↔ mail, planner ↔ invoice, invoice ↔ mail" two exist as data (planner → invoice by `to`; mail → invoice, device-local, page-level) and one as text (invoice → mail).

## 3 Constraints for a shared link contract

- **Module imports:** no module imports another (`modules/CLAUDE.md`). Today's cross reads go through core: the event bus, `contributions`, and the generic `createCollectionRepo(manifest, collection)` (`mail/links.ts:58`, `lookup.ts:76`). A link type, resolver and reverse lookup therefore belong in `core/`; routes must come from the target module (a contribution), not from a table like `linkPath`.
- **Closed union ×5** (P50): a new kind today means editing `types.ts`, `events.ts` twice, the capture parser type and the Zod enum of todos (a stored-shape change → `manifest.version`).
- **`dataApi`:** ToDo links already leave through data API / MCP / backup. `mail`, `planner` are `dataApi: false`. A link holds an id and a label only; a label copied from a mail subject is the one piece of mail content that syncs, and only after a tap.
- **AI privacy:** `aiSchema` is structure only; link fields on new modules need `internal` or a deliberate entry. Mail has no `aiSchema` (`mail/manifest.ts:9`, `core/mail/isolation.test.ts`).
- **`accounts`:** never a link source or target; even a label would be an entry leaving the vault (`docs/RULES.md:17`).
- **Sync / LWW:** merge is per field by greatest HLC (root rule "Sync"); an array is one field, so concurrent appends lose one _(inferred)_. `planMark` shows the pattern for a cross-module mark that must survive mixed merges (`types.ts:615-621`). A new collection needs `db:bump` + schema history.
- **Device-local halves:** anything that points into the mail cache resolves only on the desktop that has the thread; deterministic ids (`invoiceMailId`, `captureId`) are the existing way to make two devices agree without syncing the link.
- **Deleted targets today:** `useOpenParam` drops an unknown id silently (`ui/useOpenParam.ts:9-10`); mail says `notHere`; mail link rows to dead entries are removed when the thread is shown (`mail/components/LinkedEntries.tsx:12-18`); ToDo `links` are never cleaned and keep the label of the time (`todos/schema.ts:22`). Deletes are soft (`deletedAt`), so a resolver can tell "gone" from "never here".
- **Platform:** only `core/platform/**` knows Tauri; a link to a `platforms`-limited module needs a stated fallback (web URL, or hidden), today decided twice (P57).
- **Focus rules:** more links mean more row furniture; each addition passes `docs/design/FOCUS-GUIDELINES.md` (one clear next step per row).
