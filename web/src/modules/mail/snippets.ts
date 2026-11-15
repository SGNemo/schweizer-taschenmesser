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

/**
 * Where the quote or forward part starts: at the prefill, else at its first line, else at the first quoted
 * (`>`) line, a quote header right above one, or a forward marker (a reopened draft has no prefill). A user's
 * own line that starts with `>` or `----- ` counts as a quote too: the cut errs on the side of less.
 */
function quoteStart(body: string, prefill?: string): number | undefined {
  const cuts: number[] = [];
  if (prefill) {
    const whole = body.lastIndexOf(prefill);
    const head = prefill.split('\n')[0]!.trim();
    const line = head ? body.indexOf(head) : -1;
    for (const at of [whole, line]) if (at >= 0) cuts.push(at);
  }
  const quoted = body.search(/^([^\n]*:\n>|>|-{5,} )/m);
  if (quoted >= 0) cuts.push(quoted);
  return cuts.length ? Math.min(...cuts) : undefined;
}

/**
 * What the user wrote, for keeping as a snippet: the text above the quote. When the window started with a
 * quote that can no longer be found at all, nothing counts, so a snippet never takes someone else's mail.
 */
export function ownText(body: string, prefill?: string): string {
  const at = quoteStart(body, prefill);
  if (at === undefined) return prefill ? '' : body;
  return body.slice(0, at);
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

/** Puts a removed snippet back where it was (the undo of a removal). */
export function restoreSnippet(snippet: Snippet, at: number): Snippet[] {
  const now = readSnippets().filter((s) => s.text !== snippet.text);
  if (now.length >= SNIPPETS_MAX) return now;
  now.splice(Math.min(at, now.length), 0, snippet);
  return write(now);
}

/**
 * Adds a snippet at the end of what the user wrote, above a reply's quote or a forward's header: two
 * snippets come out in the order they were picked.
 */
export function insertSnippet(body: string, snippet: Snippet, prefill?: string): string {
  // For inserting, a quote that is gone means everything is the user's: the snippet goes at the end.
  const at = quoteStart(body, prefill) ?? body.length;
  const own = body.slice(0, at).trimEnd();
  const rest = body.slice(at);
  const next = own ? `${own}\n\n${snippet.text}` : snippet.text;
  return rest ? `${next}\n\n${rest.replace(/^\n+/, '')}` : next;
}
