/**
 * Text snippets for the compose window („Textbausteine“): the user's own short texts, kept on this device
 * like the remembered searches (`localStorage`, never synced, never sent anywhere until the user inserts one
 * into a mail). At most twenty; the name is the snippet's first line.
 */
const KEY = 'tm-mail-snippets';
export const SNIPPETS_MAX = 20;
const NAME_MAX = 40;

export interface Snippet {
  name: string;
  text: string;
}

export function readSnippets(): Snippet[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is Snippet =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as Snippet).name === 'string' &&
          typeof (x as Snippet).text === 'string' &&
          (x as Snippet).text.trim() !== '',
      )
      .slice(0, SNIPPETS_MAX);
  } catch {
    return [];
  }
}

function write(list: Snippet[]): Snippet[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: nothing is kept */
  }
  return list;
}

/** The name a text gets: its first non-empty line, shortened. */
export function snippetName(text: string): string {
  const first =
    text
      .split(/\r?\n/)
      .find((l) => l.trim() !== '')
      ?.trim() ?? '';
  return first.length > NAME_MAX ? `${first.slice(0, NAME_MAX - 1)}…` : first;
}

/** What the user wrote: the text above the quote or forward header the window started with. */
export function ownText(body: string, prefill?: string): string {
  const at = prefill ? body.lastIndexOf(prefill) : -1;
  return at >= 0 ? body.slice(0, at) : body;
}

/** Keeps a text as a snippet (the same text once); a full list keeps what it has. */
export function addSnippet(text: string): { list: Snippet[]; added: boolean } {
  const clean = text.trim();
  const now = readSnippets();
  if (!clean || now.length >= SNIPPETS_MAX || now.some((s) => s.text === clean))
    return { list: now, added: false };
  return { list: write([...now, { name: snippetName(clean), text: clean }]), added: true };
}

/** Removes by text (unique per list), so another window's change cannot make it hit the wrong one. */
export function removeSnippet(text: string): Snippet[] {
  return write(readSnippets().filter((s) => s.text !== text));
}

/**
 * Adds a snippet at the end of what the user wrote, above a reply's quote or a forward's header: two
 * snippets come out in the order they were picked.
 */
export function insertSnippet(body: string, snippet: Snippet, prefill?: string): string {
  const own = ownText(body, prefill).trimEnd();
  const rest = body.slice(ownText(body, prefill).length);
  const next = own ? `${own}\n\n${snippet.text}` : snippet.text;
  return rest ? `${next}\n\n${rest.replace(/^\n+/, '')}` : next;
}
