# Design docs – index

Nothing here is imported by the app. Mockups are standalone HTML with invented data; images are never committed ([DOCS-GUIDE](../meta/DOCS-GUIDE.md#images)). A finished round keeps only what code, tests or decisions cite; package prompts, mockups and audit tools of a merged round are deleted (git history).

| Path | What | State |
| --- | --- | --- |
| [DESIGN-SPEC.md](DESIGN-SPEC.md) | the specification: principles, shell, areas, tokens + contrast ratios, components, widgets (§4a), motion, modules, a11y; summarises design rounds 1–7, the readability plan and the visual audit 2026-10-03 (files removed 2026-11-10) | living |
| [MODULE-IDENTITY.md](MODULE-IDENTITY.md) | identity v3.1: hue, head, widget, signature per module | living |
| [FOCUS-GUIDELINES.md](FOCUS-GUIDELINES.md), [FOCUS-WORDING.md](FOCUS-WORDING.md) | checklist and wording for every new feature (hard rule) | living |
| [ui-audit-2026-11/](ui-audit-2026-11/REPORT.md) | UI audit 4.0: report, ledger, packages, guards the tests cite | running |
| [remote-control/](remote-control/CONCEPT.md) | phone → PC input: concept, packages, prototype | running |
| [site/](site/ROUND-5.md) | website rounds | running |
| [identity-v3/](identity-v3/) | concept and mockups behind MODULE-IDENTITY (code comments cite it) | reference |
| [identity-v3-audit/](identity-v3-audit/03-acceptance.md) | findings and acceptance of v3.1 | finished, reference |
| [plan/](plan/CONCEPT.md) | planner concept and engine prototype (code and tests cite it) | finished, reference |
| [sync-lan/](sync-lan/CONCEPT.md) | LAN sync concept, notes, review, prototype | finished, reference |
| [settings-v3/](settings-v3/ROUND-1.md) | settings rounds 1–3 (decisions cite them) | finished, reference |
| [usecases/kopf-leer/](usecases/kopf-leer/TARGET.md) | use case analysis and target (a spec and the test corpus cite them) | finished, reference |
| `mockups/fonts/`, `mockups/adhd/` | font the mockups load; focus-aid mockups ([features/focus-aids.md](../features/focus-aids.md)) | reference |

Screenshots for a design check: `cd web && npm run screenshots` ([howto/design-rules.md](../howto/design-rules.md)).
