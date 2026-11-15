# Mail – "Tiefe & Politur" (round 2026-11)

Maintainer's ask: "E-Mail braucht mehr Funktionalität von Gmail." Scopes stay `gmail.readonly`, `gmail.modify`, `gmail.send`; desktop only; mail content never reaches a cloud model (`core/mail/isolation.test.ts`).

## Is (develop, 2026-11-15)

Read, search (Gmail syntax passed through, last five searches), folder column with unread counts, thread view, attachments save, reply/reply all/forward (plain text, own attachments), drafts, three-stop send with a 10 s window. Per thread: read/unread, archive, trash, add one label (with undo). Per row: read/unread, archive. Kopf-leer features (In den Plan, invoice row, Persönlich) exist and are not touched.

## Gaps against Gmail

No multi-select, no star/important, no spam, labels can be added but not seen or removed, no search shortcuts or saved searches, no keyboard shortcuts, forward drops the original attachments, no text snippets, no unsubscribe link, no attachment preview.

## Packages (one branch and PR each, merged in order; each stands on its own)

1. **`feat/mail-gmail-deep-p1` – sort in batches.** Select mode in the list (checkbox, Shift range, Esc) with read/unread, star, archive, spam, trash for all selected; star, important, spam per thread; the thread's labels as chips, a label can be removed. Every change has an undo; trash and spam ask first (batch: always). Council (deletes).
2. **`-p2` – find.** Filter chips that write Gmail operators into the search (unread, attachment, starred, older than a year), saved searches (device-local, in the folder column), keyboard shortcuts close to Gmail's (j/k, o, u, e, #, s, r, a, f, c, /, x, ?), off switch in the mail settings.
3. **`-p3` – reply and newsletters.** Forward with the original attachments (opt-out per file), text snippets in compose (device-local), unsubscribe link from `List-Unsubscribe` (https only, opens the browser after a confirmation, never automatic), attachment preview (images, PDF) inside the sandboxed frame. Council (send).

"Später erinnern" stays the existing "In den Plan" (Gmail's API has no snooze); decided in p1, see its PR.
