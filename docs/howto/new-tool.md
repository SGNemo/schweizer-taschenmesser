# New tool with identity

Recipe for a tool that looks and feels like the rest of Nemo (identity v3, [design/MODULE-IDENTITY.md](../design/MODULE-IDENTITY.md) "Tools"). Index: [HOW-TO](../HOW-TO.md). General tool rules (isolation, lazy chunks, settings): [new-extension.md](new-extension.md) "New tool". Commands in `web/`.

1. **Folder** `src/tools/<id>/`: `manifest.ts`, thin `Tool.tsx` (`lazyOnline`), `View.tsx`, optional `logic.ts` + test.
2. **Manifest fields** (`ToolManifest`, `core/tools/types.ts`), all required, checked by `npm run check:tools`:
   - `category`: `rechnen | zeit | erzeugen | medien | text | entwickler` (sorts the panel list, `t.tools.panel.categories`). `group` stays the library section and default on/off.
   - `identity: { hue, hue2?, signature, type? }`: a palette v3 hue (`MODULE_HUES`, not the same as the tool before or after in `order`), an optional second hue for the head gradient, a `signature` from the shared `SIGNATURES` (`core/modules/types.ts`; the mark lives in `ui/identity/SignatureMark.tsx` – add the SVG there, the id to `SIGNATURES` **and** to `scripts/lib/checkModules.ts`, the registry test pins both), `type: 'mono'` only for code-like tools.
   - `keywords`: getter `toolKeywords(t.tools.<id>.keywords)`; a comma separated list of synonyms in each language (the panel search folds case and umlauts).
The tool's `identity.hue` is also the colour of its plate in the tool library and in Settings → Werkzeuge (`ui/HuePlate`), nothing to add.
3. **Texts** in German and English: `name`, `description`, `keywords` under `t.tools.<id>` (`strings.ts` + `i18n/locales/*/tools.ts`), `npm run check:i18n`.
4. **Content blocks** (`tools/kit.tsx` + `kit.module.css`, allowed next to `shared.ts`): `kit.display*` (calculator display), `kit.key*` (keys with depth), `Flow` (start card → arrow or swap → end card with big numbers), `TimerRing`, `kit.leaves` (calendar leaves from `@/ui/identity`), `kit.cards` (time-zone cards), `kit.mat` (framed preview: QR, picture), `kit.idCard` (persona card with the stamp that says it is made up), `kit.die`, `kit.section`, `kit.chips`, `kit.code`/`kit.codeInput` (mono panels), `kit.files`, `decimalSign()`. They read the stage's `--module-color`; use them before writing new CSS.
5. **The tool itself** sits in `ToolStage` (`layout/tools/`): the stage draws the head (plate, one line from `description`, signature) and the tinted surface; the tool draws only its content. Use `@/ui` and tokens (no hex, no edge stripes), a large result with "copy", short feedback (`copyText` toast), nothing that moves without `prefers-reduced-motion` care.
6. **Keys:** the panel gives Alt+1…9 by list position and the arrows; a tool must not take Alt+digit or Esc for itself (Esc closes the panel; inside a field it first leaves the field's own popup).
7. **Detached window:** `/tool/<id>` renders the same stage without the shell; the tool must work when it is the only thing on screen.
8. Tests: registry test (identity valid), your `logic.test.ts`, one e2e that opens the tool with `pickTool(page, name)` (`e2e/helpers.ts`).
