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

/** Keeps a text as a snippet (the same text once); a full list keeps what it has. */
export function addSnippet(text: string): Snippet[] {
  const clean = text.trim();
  const now = readSnippets();
  if (!clean || now.length >= SNIPPETS_MAX || now.some((s) => s.text === clean)) return now;
  return write([...now, { name: snippetName(clean), text: clean }]);
}

export function removeSnippet(index: number): Snippet[] {
  return write(readSnippets().filter((_, i) => i !== index));
}

/** Puts a snippet in front of what is written (a reply's quote stays below it). */
export function insertSnippet(body: string, snippet: Snippet): string {
  return body.trim() === ''
    ? snippet.text
    : `${snippet.text}${body.startsWith('\n') ? '' : '\n\n'}${body}`;
}
