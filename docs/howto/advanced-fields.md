# Basis / Erweitert in a module

Rule: the default is Basis; the rare fields and functions sit behind "Erweitert" and never hold anything important alone. Plan: [product/comfort/02-plan.md](../product/comfort/02-plan.md).

1. **Header switch:** put `<AdvancedToggle moduleId="<id>" />` (`@/ui`) into the page header next to the main action. It stores the choice for this module (synced scope `comfort`, `core/settings/comfort.ts`); the global setting Settings → Darstellung → "Basis oder Erweitert" is the fallback, the module's own choice overrides it.
2. **Rare form fields:** wrap them in `<AdvancedFields moduleId="<id>" hasData={…}>`. They show in Erweitert, after "Mehr Felder" (this dialog only, the setting stays), or whenever one of them already holds data (`hasData`: nothing in use is ever hidden).
3. **What goes in:** end date, recurrence, note, reference numbers, tags, kind, minimum stock, notice days. **What stays out:** anything that feeds a widget, a reminder or "Jetzt wichtig" (due dates, expiry, estimate and "Für heute einplanen", location, notify lead).
4. **Texts:** `strings.advanced.ts` (bundle, all five languages); new texts of a module stay in `strings.ts`.
5. **Tests:** unit `ui/advancedFields.test.tsx`, `core/settings/comfort.test.ts`; e2e `e2e/advanced.spec.ts`; in other specs call `moreFields(page)` (`e2e/helpers.ts`) before touching a hidden field.
