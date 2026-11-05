import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

/**
 * QA round 4, X07: Esc, Back or a click next to an editor threw away what was typed, without asking.
 * Every editor dialog either asks first (`askAfterTyping`) or keeps a draft (`useFormDraft`).
 */
it('every editor dialog asks before throwing typed input away (or keeps a draft)', () => {
  const root = join(__dirname);
  const missing: string[] = [];
  for (const mod of readdirSync(root, { withFileTypes: true })) {
    if (!mod.isDirectory()) continue;
    let files: string[];
    try {
      files = readdirSync(join(root, mod.name, 'components')).filter((f) =>
        /Editor.*\.tsx$/.test(f),
      );
    } catch {
      continue; // a module without components
    }
    for (const f of files) {
      if (f.endsWith('.test.tsx')) continue;
      const src = readFileSync(join(root, mod.name, 'components', f), 'utf8');
      if (src.includes('useFormDraft')) continue;
      // The opening tag up to its `>` (an arrow `=>` inside a prop is not the end).
      const dialogs = src.match(/<Dialog\b(?:=>|[^>])*>/g) ?? [];
      if (dialogs.some((d) => !/askAfterTyping|dirty=/.test(d))) missing.push(`${mod.name}/${f}`);
    }
  }
  expect(missing).toEqual([]);
});
