/** Search engines of the address bar. All are privacy-friendly or at least tracking-light; the default is DuckDuckGo. */
export interface SearchEngine {
  id: string;
  name: string;
  /** `{q}` is replaced by the URL-encoded search text. */
  template: string;
}

export const SEARCH_ENGINES: readonly SearchEngine[] = [
  { id: 'duckduckgo', name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={q}' },
  { id: 'startpage', name: 'Startpage', template: 'https://www.startpage.com/do/search?q={q}' },
  { id: 'brave', name: 'Brave Search', template: 'https://search.brave.com/search?q={q}' },
  { id: 'ecosia', name: 'Ecosia', template: 'https://www.ecosia.org/search?q={q}' },
];

export const DEFAULT_ENGINE = 'duckduckgo';

/** A custom template must be https and contain `{q}` exactly where the text goes. */
export function isValidTemplate(template: string): boolean {
  if (!template.includes('{q}')) return false;
  try {
    return new URL(template.replace('{q}', 'x')).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Template of the chosen engine; unknown id or invalid custom template falls back to the default. */
export function engineTemplate(id: string, custom: string): string {
  if (id === 'custom' && isValidTemplate(custom)) return custom;
  return (SEARCH_ENGINES.find((e) => e.id === id) ?? SEARCH_ENGINES[0]!).template;
}
