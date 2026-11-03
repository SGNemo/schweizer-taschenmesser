# Automation rules ("Wenn X, dann Y")

Rule engine in `web/src/core/automation/`; why: [decisions/automation.md](../decisions/automation.md). Commands run in `web/`.

## Model
A rule = trigger (`event` type, or `schedule` time + weekdays) + conditions (field comparisons `eq neq lt lte gt gte contains in`, time windows) + actions. Actions are a closed list: `entry` (an `aiSchema.actions` contract of a module), `reminder`, `notice`, `focus`, `profile`, `suggest` (entry waits for the user). No delete, send or pay action exists. `{field}` in an action text or value is replaced from the event's data (a lone `{field}` keeps its type).

## What a module offers (`modules/<id>/automation.ts`, `manifest.automation: () => import('./automation')`)
- `watch: { <collection>: { fields } }`: local writes of that collection become `<id>.<collection>.created|updated|deleted|restored` (nothing else is reported).
- `events: { '<type>': { fields } }`: domain events (`invoice.dueSoon`, `pantry.belowMinimum`, …), produced by `derive(signal, base)` (more events for one write, e.g. `todos.task.completed`) or by `detectors` (state checks, at most every 10 minutes, cheap and read-only). **The key must be stable per occurrence** (`<type>:<id>:<date>`): a rule runs once per key.
- `actions: ['create']`: ids of the module's `aiSchema.actions` rules may call. Only `create` today; `npm run check:modules` refuses a `delete` or an id that is not in `aiSchema.actions`, and a module without `aiSchema` cannot list actions. The vault has no `automation.ts` (`exclusion.test.ts`).
- Mail reports through the bus: `bus.emit('automation.event', …)` (`modules/mail/automationEvents.ts`): no title, only sender, subject, amount and due date.

## Templates (`core/automation/templates.ts`)
12 ready rules, all off. A template has `id`, `modules`, `params` (number / time) and `build(params)`; texts live in `strings.automation.ts` (5 languages). `core/automation/modules.test.ts` checks that every template is a valid rule the registered modules can run.

## Guards and safety
Loop: a rule is not run inside its own cause chain (`cause.ruleIds`), depth ≤ 3. Once per occurrence key. Limit per rule and hour (default 3) and globally (default 10). Dry run (`dryRun` setting) logs "would do" and writes nothing. Entries get fixed ids `auto-<hash(rule, key, action)>`, so devices agree. Every run has a `groupId`: `undoRun(groupId)` takes back entries (edited ones stay), hints, focus round and profile switch. Hints and reminders are soft + local notifications and pass the calm policy.

## Tests
`npx vitest run src/core/automation`. Add a detector test with repo fixtures (see `modules.test.ts`) and a flow test through `runTick` (`templates.flow.test.ts`).
