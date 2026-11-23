/**
 * What a click on a mail link does (M6, launch review 2026-11). The mail is the sender's page: its
 * link text can name one site while the link goes to another (the classic phishing shape). Such a
 * link is asked about first, naming the real host; any other http(s), `mailto:` or `tel:` link opens
 * as before; nothing else opens at all.
 */
export type LinkDecision =
  { open: string } | { ask: string; host: string; shown: string } | { none: true };

const SAFE_OPEN = /^(https?:|mailto:|tel:)/i;
/** A domain written in the link text (`www.bank.example`, `https://bank.example/x`). */
const DOMAIN_IN_TEXT = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})/i;

const bare = (host: string) => host.toLowerCase().replace(/^www\./, '');

export function linkDecision(text: string, href: string): LinkDecision {
  if (!SAFE_OPEN.test(href)) return { none: true };
  if (!/^https?:/i.test(href)) return { open: href };
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    return { none: true };
  }
  const named = DOMAIN_IN_TEXT.exec(text.slice(0, 500))?.[1];
  if (!named) return { open: href };
  const shown = bare(named);
  const real = bare(host);
  const same = real === shown || real.endsWith(`.${shown}`) || shown.endsWith(`.${real}`);
  return same ? { open: href } : { ask: href, host, shown: text.trim().slice(0, 120) };
}
