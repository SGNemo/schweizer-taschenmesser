/**
 * Pure parts of `npm run gen:modules` (scripts/gen-module-list.mjs): shortening a description to
 * one line, building the Markdown block, replacing a marked block in a file.
 */

export const LANGS = ['de', 'en', 'es', 'fr', 'pt-BR'] as const;
export type Lang = (typeof LANGS)[number];
export type DocLang = 'en' | 'de';
export type Names = Record<string, string>;
export type Status = 'default' | 'optional' | 'preview';
export type PlatformKey = 'windows' | 'android' | 'both' | null;

export interface ModuleRecord {
  id: string;
  area: string;
  status: Status;
  platforms: PlatformKey;
  name: Names;
  description: Names;
}
export interface ModuleData {
  areas: { id: string; name: Names }[];
  modules: ModuleRecord[];
  toolCategories: { id: string; name: Names }[];
  tools: { id: string; category: string; status: Status; name: Names }[];
}

export const START = '<!-- modules:start -->';
export const END = '<!-- modules:end -->';

/** Fixed words of the generated tables (English and German; the JSON carries all five names). */
const WORDS = {
  en: {
    area: 'Area',
    module: 'Module',
    what: 'What it does',
    status: 'Status',
    tools: 'Tools',
    toolsHint: 'Open with Ctrl+. or the Tools button; more can be turned on under “Manage tools”.',
    on: 'on by default',
    optional: 'optional',
    preview: 'preview',
    previewHint:
      'Preview modules and tools stay hidden until you turn on “Show work in progress” (Settings → Appearance).',
    only: (p: string) => `${p} only`,
    windows: 'Windows app',
    android: 'Android app',
    both: 'Windows and Android apps',
  },
  de: {
    area: 'Bereich',
    module: 'Modul',
    what: 'Was es tut',
    status: 'Status',
    tools: 'Werkzeuge',
    toolsHint:
      'Öffnen mit Strg+. oder dem Knopf „Werkzeuge“; weitere schaltest du unter „Werkzeuge verwalten“ ein.',
    on: 'standardmäßig an',
    optional: 'optional',
    preview: 'Vorschau',
    previewHint:
      'Vorschau-Module und -Werkzeuge bleiben versteckt, bis du „In Arbeit anzeigen“ einschaltest (Einstellungen → Darstellung).',
    only: (p: string) => `nur ${p}`,
    windows: 'Windows-App',
    android: 'Android-App',
    both: 'Windows- und Android-App',
  },
} as const;

/** What `manifest.platforms` means for people: only the Tauri shells ship, Windows and Android. */
export function platformKey(platforms: readonly string[] | undefined): PlatformKey {
  if (!platforms || platforms.includes('web')) return null;
  const desktop = platforms.includes('desktop');
  const android = platforms.includes('android');
  if (desktop && android) return 'both';
  if (desktop) return 'windows';
  if (android) return 'android';
  return null;
}

/**
 * First clause of a description: the first sentence, cut at a dash, colon or semicolon; a sentence
 * that is still longer than 100 characters is cut at its last comma before character 90.
 */
export function shortText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentence = clean.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„“"])/)[0] ?? clean;
  const cut = sentence.search(/ [–—] |: |; /);
  let head = cut >= 10 ? sentence.slice(0, cut) : sentence;
  if (head.length > 100) {
    const comma = head.slice(0, 90).lastIndexOf(', ');
    if (comma >= 30) head = head.slice(0, comma);
  }
  return head.replace(/[\s.:;,–—-]+$/, '');
}

/** The Markdown block (table, tools line, preview hint) for one document language. */
export function moduleBlock(data: ModuleData, l: DocLang): string {
  const w = WORDS[l];
  const status = (x: { status: Status; platforms?: PlatformKey }) => {
    const parts: string[] = [
      x.status === 'default' ? w.on : x.status === 'preview' ? w.preview : w.optional,
    ];
    if (x.platforms) parts.push(w.only(w[x.platforms]));
    return parts.join(', ');
  };
  const rows = [`| ${w.area} | ${w.module} | ${w.what} | ${w.status} |`, '|---|---|---|---|'];
  for (const area of data.areas) {
    data.modules
      .filter((m) => m.area === area.id)
      .forEach((m, i) => {
        const first = i === 0 ? `**${area.name[l]}**` : '';
        rows.push(
          `| ${first} | ${m.name[l]} | ${shortText(m.description[l] ?? '')} | ${status(m)} |`,
        );
      });
  }
  const tools = data.tools
    .map((x) => (x.status === 'preview' ? `${x.name[l]} (${w.preview})` : x.name[l]))
    .join(' · ');
  return [rows.join('\n'), '', `**${w.tools}:** ${tools}. ${w.toolsHint}`, '', w.previewHint].join(
    '\n',
  );
}

/** `text` with what lies between the markers replaced; `undefined` when the file has no markers. */
export function replaceBlock(text: string, block: string): string | undefined {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a === -1 || b === -1 || b < a) return undefined;
  return `${text.slice(0, a + START.length)}\n\n${block}\n\n${text.slice(b)}`;
}
