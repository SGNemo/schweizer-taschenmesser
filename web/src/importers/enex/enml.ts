/**
 * Evernote note content (ENML, XHTML with `en-note`, `en-todo`, `en-media`) as Markdown. A small
 * tokenizer instead of `DOMParser`, so it also runs in a Worker. Images and files cannot be stored
 * in a note's text: `en-media` is counted and left out.
 */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  euro: '€',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  bull: '•',
  copy: '©',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
    const code = dec ? Number(dec) : hex ? parseInt(hex, 16) : undefined;
    if (code !== undefined) {
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[name as string] ?? m;
  });
}

const BLOCK = new Set([
  'p',
  'div',
  'li',
  'ul',
  'ol',
  'tr',
  'table',
  'blockquote',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
]);

export interface EnmlResult {
  markdown: string;
  /** `en-media` elements (images, files) that were left out. */
  media: number;
}

function attr(attrs: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  return decodeEntities(m?.[1] ?? m?.[2] ?? '');
}

export function enmlToMarkdown(enml: string): EnmlResult {
  let media = 0;
  let out = '';
  const lists: { ordered: boolean; n: number }[] = [];
  let pre = false;
  let href: string | undefined;
  let linkStart = 0;
  const newline = (n = 1) => {
    out = out.replace(/[ \t]+$/, '');
    const have = /\n*$/.exec(out)![0].length;
    if (out !== '' && have < n) out += '\n'.repeat(n - have);
  };
  const tag = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![\s\S]*?>/g;
  let last = 0;
  const text = (raw: string) => {
    if (raw === '') return;
    const decoded = decodeEntities(raw);
    out += pre ? decoded : decoded.replace(/\s+/g, ' ');
  };
  for (let m = tag.exec(enml); m; m = tag.exec(enml)) {
    text(enml.slice(last, m.index));
    last = tag.lastIndex;
    if (!m[2]) continue; // comment, doctype, processing instruction
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] ?? '';
    if (/^h[1-6]$/.test(name)) {
      newline(2);
      if (!closing) out += `${'#'.repeat(Number(name[1]))} `;
      else newline(2);
    } else if (name === 'br') {
      out += '\n';
    } else if (name === 'ul' || name === 'ol') {
      if (closing) lists.pop();
      else lists.push({ ordered: name === 'ol', n: 0 });
      newline(lists.length > 0 && !closing ? 1 : 2);
    } else if (name === 'li') {
      if (!closing) {
        newline();
        const list = lists[lists.length - 1];
        const indent = '  '.repeat(Math.max(0, lists.length - 1));
        if (list) list.n++;
        out += `${indent}${list?.ordered ? `${list.n}. ` : '- '}`;
      } else newline();
    } else if (name === 'en-todo') {
      const box = /^true$/i.test(attr(attrs, 'checked')) ? '[x] ' : '[ ] ';
      // Inside a list item the box follows the bullet; elsewhere it is a task-list line of its own.
      if (/^\s*(?:- |\d+\. )$/.test(out.slice(out.lastIndexOf('\n') + 1))) out += box;
      else {
        newline();
        out += `- ${box}`;
      }
    } else if (name === 'en-media') {
      media++;
    } else if (name === 'pre') {
      newline(2);
      if (!closing) out += '```\n';
      else {
        out = out.replace(/\n*$/, '\n') + '```';
        newline(2);
      }
      pre = !closing;
    } else if (name === 'code' && !pre) {
      out += '`';
    } else if (name === 'b' || name === 'strong') {
      out += '**';
    } else if (name === 'i' || name === 'em') {
      out += '*';
    } else if (name === 's' || name === 'strike' || name === 'del') {
      out += '~~';
    } else if (name === 'a') {
      if (!closing) {
        href = attr(attrs, 'href');
        linkStart = out.length;
      } else if (href !== undefined) {
        const label = out.slice(linkStart);
        out = href && label.trim() ? `${out.slice(0, linkStart)}[${label}](${href})` : out;
        href = undefined;
      }
    } else if (name === 'td' || name === 'th') {
      if (closing) out += ' | ';
    } else if (name === 'tr' && closing) {
      out = out.replace(/ \| $/, '');
      newline();
    } else if (name === 'blockquote') {
      newline(2);
      if (!closing) out += '> ';
    } else if (name === 'hr') {
      newline(2);
      out += '---';
      newline(2);
    } else if (BLOCK.has(name)) {
      newline(closing && (name === 'p' || name === 'div') ? 2 : 1);
    }
  }
  text(enml.slice(last));
  const markdown = tidy(out);
  return { markdown, media };
}

const LIST_LINE = /^\s*(?:- |\d+\. )/;

/** Tight lists, a blank line after each list; code blocks stay as they are. */
function tidy(raw: string): string {
  const lines = raw.replace(/[ \t]+\n/g, '\n').split('\n');
  const out: string[] = [];
  let fenced = false;
  for (const line of lines) {
    if (/^```/.test(line)) fenced = !fenced;
    const prev = out[out.length - 1];
    if (!fenced && !/^```/.test(line)) {
      if (line === '' && prev === '') continue;
      if (LIST_LINE.test(line) && prev === '' && LIST_LINE.test(out[out.length - 2] ?? ''))
        out.pop();
      else if (
        line !== '' &&
        !LIST_LINE.test(line) &&
        prev !== undefined &&
        LIST_LINE.test(prev) &&
        !/^\s/.test(line)
      )
        out.push('');
    }
    out.push(line);
  }
  return out.join('\n').replace(/^\s+|\s+$/g, '');
}
