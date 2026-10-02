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
      if (count(new RegExp(`\\b${key}:`, 'g')) < components.length)
        fail(`every widget needs \`${key}\``);
    }
  }

  const devOnly = /\bdevOnly:\s*true/.test(manifest);
  const layout = /\blayout:\s*['"]([a-z]+)['"]/.exec(manifest)?.[1];
  if (!layout && !devOnly) fail('manifest has no `layout`');
  if (layout && !LAYOUTS.includes(layout)) fail(`unknown layout "${layout}"`);

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
  return /emptyAction|EmptyState|<Link\b/.test(src)
    ? []
    : [`${id}: widget "${file}" shows no empty state / link to the module`];
}

/**
 * Settings of a module (`settings.ts`, or the `settings:` block of the manifest): a `category`, if
 * given, must be a known settings category (`core/settings/registry/types.ts`); without one the
 * module's section lands in "Module". `categories` are the valid route ids.
 */
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
