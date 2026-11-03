# Household and vault modules – what each one has

Index: [HOW-TO](../HOW-TO.md). Rules: [MODULE-IDENTITY](../design/MODULE-IDENTITY.md). Modules: `pantry` (Vorräte), `lists` (Einkauf + Packlisten), `people` (Geburtstage + Geschenkideen), `vault` (Unterlagen), `accounts` (Passwörter). Signatures are local components (`components/*Signature*`, `AvatarRing`, `FolderTabs`, `VaultDoor`) put into the head with `HeroSlot`; they are decoration, numbers stay text.

- **pantry:** optional `unit`, `ean`; expiry lamp (dot + text); `autoRestock` setting (taking one down to `minCount` puts it on the shopping list, only with `lists` on); scan dialog (`BarcodeDetector` + camera like the QR tool, typed number as fallback, no online lookup); `services.ts` listens to `pantry.restock`.
- **lists:** shopping items have `section`, `priceCents`, `recurring`; packing items `category`, `toBuy`; packing lists `tripDate`, `place`. History (`historyOf`, incl. removed rows) drives suggestions and remembers section/price per name. "In Vorräte übernehmen" emits `pantry.restock`. `TripWeather` asks open-meteo.com only on a click (notice `weather` first) and only for a trip within 7 days.
- **people:** person `phone`, `email`, `remindDaysBefore`, `giftBudgetCents`; `congratsLinks` builds WhatsApp/tel/mailto (no `sms:`: not in the Tauri opener defaults); `contactsImport.ts` parses `.vcf` (BDAY) and `.ics` (yearly all-day events, year not taken); `inbox.ts` keeps `gift.requested` ideas (scope `module.people.inbox`) until a person is chosen.
- **vault:** folder-tab head from category counts; "Verlängert +1 Jahr" for contracts and insurances (undoable).
- **accounts:** `getAutoLockDeadline()` (read-only) feeds the door head; `changedAt` inside the encrypted entry feeds the age hint; `audit.ts` (reuse, age) and `measureStrength` run in memory over the open entries, results hold ids only; emergency sheet = static text, date, a count.

Events added in `core/events/events.ts`: `pantry.restock`, `gift.requested` (one-way, modules still never import each other).
