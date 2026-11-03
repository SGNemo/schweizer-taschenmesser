# Money group: Abos (package 3)

Binding rules: [MODULE-IDENTITY](../design/MODULE-IDENTITY.md). Index: [HOW-TO](../HOW-TO.md). Code: `web/src/modules/subscriptions/`, finance side in `web/src/modules/finance/{subscriptionLink,attention,services}.ts`.

## Data (manifest version 4, all new fields optional, no index change)

`trialEndsOn`, `category` (streaming, music, software, cloud, news, mobility, sport, insurance, telecom, other), `paymentMethod` (short text, never a card number). Notice periods in weeks/months already exist (`core/deadline`, stored in days; a month is 30 days). A paused subscription stays `active: false`; a cancelled one stays `recurrence.until`.

## Pure logic (expectation tables in `__tests__/depth.test.ts`)

`monthlyEquivalent` (rounded half up: weekly 5,00 € → 21,67 €, two weekdays a week, every 3 weeks, yearly /12), `subscriptionStatus` (`paused` beats `trial`; the last day counts as still running; `ended` has no charge left), `trialDaysLeft`, `topExpensive` (running ones, yearly cost, main currency only), `monogram` and `paletteIndex` (the tile: one or two letters, a stable hue from the ten module hues).

## Signature: service tiles

`ServiceTile` (monogram on a tint of `--module-color`, decoration; the name is always text next to it) and `NextChargesHead` in the head (`HeroSlot`): the next three charges with date and price; on a phone only the next one. Rows carry a tile on wide screens. No logos of third parties.

## UI

Row: recurrence, next charge, monthly equivalent for non-monthly rules, price rise, status chip (Probezeit, Pausiert, Beendet). **Erweitert**: category and payment method in the row, "Teuerste Abos" (top three), and the editor fields trial end / category / payment method. The trial gets a reminder (`trialRemindDaysBefore`, default 3 days) and a calendar item.

## Finance link (finance → `subscriptions/public.ts` only)

- **Price change from bookings**: when the two newest bookings of a subscription (payee contains the name on word boundaries, same currency, last 120 days, no transfers) agree on an amount that differs from the stored price, "Jetzt wichtig" offers it (`finance/attention.ts`); it opens `/subscriptions?open=<id>&newprice=<cents>` and the editor offers "Preis übernehmen" for that subscription only. Off with the subscriptions setting `priceHint`. Nothing changes by itself.
- **Bookings from charges**: finance setting `bookSubscriptions` (default **off**): charges of the last 31 days are booked as expenses (id `sub-<subscriptionId>-<date>`, category "Abos", `sourceRef: subscription:<id>`) unless a booking already stands for them (same service and amount within three days); a booking the user deleted is not brought back; a toast offers "Rückgängig". Public API addition: `listSubscriptionPrices`, `priceHintOn`.

## Not in this package

Cancellation notice units in the row (the editor field has them), a category filter chip row (stimulus budget), per-category mapping to finance categories, a paused-until date, AI actions for the new fields.
