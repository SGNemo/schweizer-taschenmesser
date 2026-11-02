/**
 * Static completeness check of module manifests (`npm run check:modules`). Works on the source
 * text so it runs without a build; `src/core/modules/widgets.test.tsx` is the runtime counterpart.
 */

export interface ModuleSource {
  id: string;
  manifest: string;
  /** True when the file exists (path relative to the module folder, extension optional). */
  fileExists: (relative: string) => boolean;
}

const PLATFORMS = ['web', 'desktop', 'android'];
const LAYOUTS = ['narrow', 'content', 'wide', 'full'];
/** Keep in step with `MODULE_HUES` / `WIDGET_TYPES` in `src/core/modules/types.ts` (pinned by the registry test). */
export const HUES = [
  'sky',
  'moss',
  'teal',
  'ocean',
  'violet',
  'plum',
  'orchid',
  'indigo',
  'slate',
  'navy',
];
export const WIDGET_TYPES = [
  'kpi',
  'dueList',
  'progress',
  'checklist',
  'timeline',
  'tiles',
  'status',
  'gauge',
];

/** The text of the `widgets: [ … ]` array (balanced brackets), or undefined. */
function widgetsBlock(src: string): string | undefined {
  const start = src.search(/\bwidgets:\s*\[/);
  if (start < 0) return undefined;
  const open = src.indexOf('[', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']' && --depth === 0) return src.slice(open + 1, i);
  }
  return undefined;
}

export function checkModule({ id, manifest, fileExists }: ModuleSource): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`${id}: ${msg}`);

  // Retired modules keep only schema/repo/manifest: no widgets, layout or seed data.
  if (/\bretired:\s*true/.test(manifest)) {
    if (!/\bnone:\s*['"]retired['"]/.test(manifest))
      fail("retired needs `seed: { none: 'retired' }`");
    if (fileExists('seed.ts')) fail('retired modules must not ship seed.ts');
    if (/\bwidgets:\s*\[\s*\{/.test(manifest)) fail('retired modules must not have widgets');
    return errors;
  }

  const block = widgetsBlock(manifest);
  if (block === undefined) fail('manifest has no `widgets` array');
  else {
    const components = [...block.matchAll(/import\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)].map(
      (m) => m[1]!,
    );
    if (components.length === 0) fail('no widget declared (every module needs at least one)');
    for (const c of components) {
      if (!fileExists(`${c}.tsx`) && !fileExists(`${c}.ts`)) fail(`widget file "${c}" is missing`);
    }
    const count = (re: RegExp) => [...block.matchAll(re)].length;
    for (const key of ['id', 'title', 'defaultSize', 'sizes'] as const) {
      // A text field may be a getter (`get title() { return t.… }`) so it follows the UI language.
      if (count(new RegExp(`\\b${key}:|\\bget\\s+${key}\\s*\\(`, 'g')) < components.length)
        fail(`every widget needs \`${key}\``);
    }
  }

  const devOnly = /\bdevOnly:\s*true/.test(manifest);
  const layout = /\blayout:\s*['"]([a-z]+)['"]/.exec(manifest)?.[1];
  if (!layout && !devOnly) fail('manifest has no `layout`');
  if (layout && !LAYOUTS.includes(layout)) fail(`unknown layout "${layout}"`);

  // Identity: `identity: { hue, widgetType }` from the fixed lists (docs/decisions/ui-shell.md).
  const identity = /\bidentity:\s*\{([^}]*)\}/.exec(manifest)?.[1];
  if (identity === undefined) fail('manifest has no `identity: { hue, widgetType }`');
  else {
    const hue = /\bhue:\s*['"]([a-z]+)['"]/.exec(identity)?.[1];
    const type = /\bwidgetType:\s*['"]([a-zA-Z]+)['"]/.exec(identity)?.[1];
    if (!hue || !HUES.includes(hue))
      fail(`identity.hue "${hue ?? ''}" is not in the module palette`);
    if (!type || !WIDGET_TYPES.includes(type))
      fail(`identity.widgetType "${type ?? ''}" is not a catalogue type`);
  }

  const platforms = /\bplatforms:\s*\[([^\]]*)\]/.exec(manifest)?.[1];
  if (platforms !== undefined) {
    const list = [...platforms.matchAll(/['"]([a-z]+)['"]/g)].map((m) => m[1]!);
    if (list.length === 0) fail('`platforms` must not be empty (omit it for all)');
    for (const p of list) if (!PLATFORMS.includes(p)) fail(`unknown platform "${p}"`);
  }

  // Seed contract: `seed: { version, dependsOn }` plus a `seed.ts` (docs/HOW-TO.md "Seed bauen").
  const seed = /\bseed:\s*\{([^}]*)\}/.exec(manifest)?.[1];
  if (seed === undefined)
    fail('manifest has no `seed: { version, dependsOn }` (test data is mandatory)');
  else {
    if (!/\bversion:\s*\d+/.test(seed)) fail('`seed.version` must be a number');
    if (!/\bdependsOn:\s*\[/.test(seed)) fail('`seed.dependsOn` is missing (use [] for none)');
    const none = /\bnone:\s*['"]live-data['"]/.test(seed);
    if (!none && !fileExists('seed.ts')) fail('seed.ts is missing (every module ships test data)');
    if (none && fileExists('seed.ts')) fail('`seed.none` is set but seed.ts exists');
  }

  return errors;
}

/** Widget source must offer a next step when empty (an action link or an empty state). */
export function checkWidgetSource(id: string, file: string, src: string): string[] {
  return /emptyAction|EmptyState|<Link\b|\bempty=|<Status(Widget|Card)\b/.test(src)
    ? []
    : [`${id}: widget "${file}" shows no empty state / link to the module`];
}

/**
 * Settings of a module (`settings.ts`, or the `settings:` block of the manifest): a `category`, if
 * given, must be a known settings category (`core/settings/registry/types.ts`); without one the
 * module's section lands in "Module". `categories` are the valid route ids.
 */
/**
 * Comfort contract: a delete in a module screen (`components/`, `routes/`) must go through
 * `deleteWithUndo` / `undoableWithToast` / `undoable`, so it can be undone from the toast or Ctrl+Z.
 * Only direct repo removals are detected; helpers in `repo.ts`/`services.ts` are the caller's job.
 */
export function checkDeleteSource(id: string, file: string, src: string): string[] {
  const direct = /\b\w+Repo\.remove(Many)?\(/.test(src);
  if (!direct || /comfort-allow-delete/.test(src)) return []; // marker: automatic clean-up, not a user delete
  return /\b(deleteWithUndo|undoableWithToast|undoable)\b/.test(src)
    ? []
    : [`${id}: "${file}" deletes without undo (use deleteWithUndo from @/core/undo/withToast)`];
}

/**
 * Comfort contract: a list screen (`routes/`) whose hand-made rows (`<li>` / `Card as="li"`) open an
 * editor on click must be built from `ItemRow`, so swipe, the "⋯" menu, the keys and undo come for
 * free. A deliberately different row (progress cards, a conversation list) says why with a
 * `comfort-custom-row:` comment in the file.
 */
export function checkRowSource(id: string, file: string, src: string): string[] {
  const handMade = /<li\b|as=["']li["']/.test(src);
  const opensEditor = /onClick=\{\(\)\s*=>\s*set\w*(Target|For)\(/.test(src);
  if (!handMade || !opensEditor || /\bItemRow\b/.test(src) || /comfort-custom-row:/.test(src))
    return [];
  return [
    `${id}: "${file}" builds its own list rows (use ItemRow from @/ui, or explain with a "comfort-custom-row:" comment)`,
  ];
}

export function checkSettingsSource(
  id: string,
  source: string,
  categories: readonly string[],
): string[] {
  const match = /\bcategory:\s*['"]([^'"]*)['"]/.exec(source);
  if (!match || categories.includes(match[1]!)) return [];
  return [
    `${id}: settings.category "${match[1]}" is not a settings category (${categories.join(', ')})`,
  ];
}
