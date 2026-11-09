# Money group: Rechnungen (package 2)

Binding rules: [MODULE-IDENTITY](../design/MODULE-IDENTITY.md). Index: [HOW-TO](../HOW-TO.md). Code: `web/src/modules/invoices/`.

## Data (manifest version 4, all new fields optional, no index change)
`payments[]` (`{id, date, amountMinor}`), `dunningLevel` 0–3 + `dunnedAt`, `iban`, `bic`, `attachment` (`{name, mime, size}`: the note; the file is in the device-local blob store under `invoices:<id>`, not synced, not in the JSON backup; the UI says so).

## Rest, state, part payments
- `status` stays `open | paid`. `remainingMinor` = amount − part payments (never negative). `invoiceState(invoice, day)` derives `paid > overdue > partial > open` (`partial` also on an overdue partly paid one); an invoice is overdue the day *after* its due date.
- Totals, widget, attention, calendar, reminders and `public.listOpenInvoices` all use the **rest**, so finance's "available" never subtracts a part twice.
- `addPayment` (capped at the rest) emits `invoice.payment`; the payment that covers the rest calls `markPaid`. `removePayment` emits `invoice.paymentRemoved` and reopens a paid invoice. `markPaid` emits `invoice.paid` with **only the rest** (0 when parts covered it). Reopening keeps the parts (they stay booked).
- Finance (`services.ts`) books each part as `inv-<invoiceId>-<paymentId>` and the rest as `inv-<invoiceId>`; all idempotent; a rest of 0 books nothing and drops an earlier rest booking.

## From the mail list („Kopf leer“ 3b)
The mail module writes invoices through the quick-capture `invoice` target (id `mail-<hash(message id)>`, create-if-absent) and notes a payment reminder with `amendCapture` on the invoice `findOpenInvoice` names (level, `dunnedAt`, one note line; amount and due stay). `plannable.ts` shows a noted reminder in the plan row as „… bezahlen · Mahnung · <Betrag> bis <Frist>“, read only from the note line the reminder wrote.

## Payment data
`iban.ts` (normalise, group in fours, mod-97 check; a calm hint, never a block). `pay.ts` copies payee, IBAN, BIC, reference and the **rest** as one block (`paymentBlock`) or the IBAN alone. Row menu: "Zahlungsdaten kopieren"; editor (Mehr Felder): IBAN, BIC, the same buttons.

## UI
Head: `ReceiptCard` in `HeroSlot` (signature `receipt`, built in the module: zigzag `mask`, hue only as top rule; grey when nothing is open). `PageHeader` replaces the own header; views Offen / Bezahlt / Alle. Row meta carries "Teilweise bezahlt" and the reminder level; the editor has the part payment list, reminder level + date, IBAN/BIC and the attachment (image inline, PDF opens or downloads; choices apply on "Speichern"; max 8 MB).

## Not in this package
Attachment from a mail (the mail module hands over text only; would need `core/mail` to pass the attachment), AI actions for part payments / reminder level, a reminder on the reminder date (focus guidelines: no extra notifications), pruning attachments of purged invoices (a few KB-MB, local only).
