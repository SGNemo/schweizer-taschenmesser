/**
 * Static completeness check of tool manifests (`npm run check:tools`). Works on the source text so
 * it runs without a build; `src/core/tools/registry.test.ts` is the runtime counterpart.
 */
import { HUES } from './checkModules.ts';

/** Keep in step with `TOOL_CATEGORIES` / `TOOL_SIGNATURES` in `src/core/tools/types.ts` (pinned by the registry test). */
export const TOOL_CATEGORIES = ['rechnen', 'zeit', 'erzeugen', 'medien', 'text', 'entwickler'];
export const TOOL_SIGNATURES = [
  'display',
  'flow',
  'ring',
  'calendarLeaf',
  'globe',
  'dice',
  'qrFrame',
  'idCard',
  'notePaper',
  'photoFrame',
  'pageStack',
  'viewfinder',
  'terminal',
  'splitPage',
  'pattern',
  'none',
];

export interface ToolFacts {
  id: string;
  order: number;
  category?: string;
  hue?: string;
  hue2?: string;
  signature?: string;
  type?: string;
}

const str = (src: string, key: string): string | undefined =>
  new RegExp(`\\b${key}:\\s*['"]([A-Za-z0-9]+)['"]`).exec(src)?.[1];

/** Reads the identity facts out of a manifest's source text. */
export function toolFacts(id: string, src: string): ToolFacts {
  const identity = /\bidentity:\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
  return {
    id,
    order: Number(/\border:\s*(\d+)/.exec(src)?.[1] ?? Number.NaN),
    category: str(src, 'category'),
    hue: str(identity, 'hue'),
    hue2: str(identity, 'hue2'),
    signature: str(identity, 'signature'),
    type: str(identity, 'type'),
  };
}

/** One tool: every field present and in its list (the contract of `ToolManifest`). */
export function checkToolManifest(id: string, src: string): string[] {
  const f = toolFacts(id, src);
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`tool ${id}: ${msg}`);
  if (!f.category) fail('manifest has no `category` (one of: ' + TOOL_CATEGORIES.join(', ') + ')');
  else if (!TOOL_CATEGORIES.includes(f.category)) fail(`unknown category "${f.category}"`);
  if (!/\bidentity:\s*\{/.test(src)) fail('manifest has no `identity` ({ hue, signature })');
  else {
    if (!f.hue || !HUES.includes(f.hue))
      fail(`identity.hue "${f.hue ?? ''}" is not a palette v3 hue`);
    if (f.hue2 && !HUES.includes(f.hue2)) fail(`identity.hue2 "${f.hue2}" is not a palette v3 hue`);
    if (f.hue2 && f.hue2 === f.hue) fail('identity.hue2 must differ from hue');
    if (!f.signature || !TOOL_SIGNATURES.includes(f.signature))
      fail(`identity.signature "${f.signature ?? ''}" is not in TOOL_SIGNATURES`);
    if (f.type && !['sans', 'mono'].includes(f.type)) fail(`identity.type "${f.type}" unknown`);
  }
  if (!/\bkeywords\b/.test(src)) fail('manifest has no `keywords` (t.tools.<id>.keywords)');
  return errors;
}

/** Tools next to each other in the list (by order) must not share a hue (every tile reads on its own). */
export function checkToolNeighbours(all: ToolFacts[]): string[] {
  const sorted = [...all].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const errors: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    if (a.hue && a.hue === b.hue)
      errors.push(`tools ${a.id} and ${b.id} are neighbours with the same hue "${a.hue}"`);
  }
  return errors;
}

/** The tool's text block in a catalog must carry `keywords` (German source and the four locales). */
export function checkToolKeywords(id: string, lang: string, catalog: string): string[] {
  const start = catalog.indexOf('\n  tools: {\n');
  const text = start >= 0 ? catalog.slice(start) : catalog;
  const indent = lang === 'de' ? '    ' : '  ';
  const open = new RegExp(`^${indent}${id}: \\{\\n`, 'm').exec(text);
  if (!open) return [`tool ${id}: no text block in ${lang}`];
  const rest = text.slice(open.index + open[0].length);
  const end = new RegExp(`^${indent}\\},?$`, 'm').exec(rest);
  const block = end ? rest.slice(0, end.index) : rest;
  return new RegExp(`^${indent}  keywords: `, 'm').test(block)
    ? []
    : [`tool ${id}: no \`keywords\` in the ${lang} catalog`];
}
