/**
 * A small, safe Markdown renderer for answers: no HTML is ever interpreted (text goes through
 * React as text), links only with http(s)/mailto and always `rel="noopener noreferrer"`. Supported:
 * headings, paragraphs, bullet/numbered lists, quotes, code blocks and inline code, bold, italic,
 * links, rules. Everything else stays plain text.
 */
import { Fragment, type ReactNode } from 'react';

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function safeHref(raw: string): string | undefined {
  try {
    const url = new URL(raw.trim());
    return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;

export function renderInline(text: string, keyBase = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [token] = match;
    const key = `${keyBase}-${n++}`;
    if (token.startsWith('`')) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**'))
      out.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    else if (token.startsWith('*'))
      out.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    else {
      const close = token.indexOf('](');
      const label = token.slice(1, close);
      const href = safeHref(token.slice(close + 2, -1));
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          label
        ),
      );
    }
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'hr' };

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: 'p', text: paragraph.join('\n') });
    paragraph.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) body.push(lines[i++]!);
      i++; // closing fence (or end of text while streaming)
      blocks.push({ type: 'code', lang: fence[1] ?? '', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'h', level: heading[1]!.length as 1 | 2 | 3, text: heading[2]! });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const type = bullet ? 'ul' : 'ol';
      const items: string[] = [];
      while (i < lines.length) {
        const m =
          type === 'ul'
            ? /^\s*[-*+]\s+(.*)$/.exec(lines[i]!)
            : /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]!);
        if (!m) break;
        items.push(m[1]!);
        i++;
      }
      blocks.push({ type, items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!))
        quote.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      flush();
      i++;
      continue;
    }
    paragraph.push(line);
    i++;
  }
  flush();
  return blocks;
}

export function Markdown({
  text,
  renderCode,
}: {
  text: string;
  /** Lets the caller add a copy button to code blocks. */
  renderCode?: (code: string, lang: string) => ReactNode;
}) {
  return (
    <>
      {parseBlocks(text).map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case 'p':
            return (
              <p key={key}>
                {b.text.split('\n').map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 ? <br /> : null}
                    {renderInline(l, `${key}-${j}`)}
                  </Fragment>
                ))}
              </p>
            );
          case 'h': {
            const Tag = (['h4', 'h4', 'h5'] as const)[b.level - 1]!;
            return <Tag key={key}>{renderInline(b.text, key)}</Tag>;
          }
          case 'ul':
          case 'ol': {
            const Tag = b.type;
            return (
              <Tag key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return <blockquote key={key}>{renderInline(b.text, key)}</blockquote>;
          case 'code':
            return renderCode ? (
              <Fragment key={key}>{renderCode(b.text, b.lang)}</Fragment>
            ) : (
              <pre key={key}>
                <code>{b.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={key} />;
        }
      })}
    </>
  );
}
