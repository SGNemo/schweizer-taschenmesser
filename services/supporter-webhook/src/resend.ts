import { hmacHex, looksLikeEmail, normaliseEmail, safeEqual } from './hash.ts';
import { html, readLimited } from './http.ts';
import { parseRecord } from './issue.ts';
import { log } from './log.ts';
import type { Env } from './types.ts';

/** Where a supporter whose mail got lost can ask for it again. Shown in German and English. */
const FORM = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nemo – Code erneut senden</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:34rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#171f24}label{display:block;margin:1rem 0 .25rem;font-weight:500}input{width:100%;box-sizing:border-box;padding:.6rem;font:inherit;border:1px solid #76838c;border-radius:8px}button{margin-top:1rem;padding:.7rem 1.2rem;font:inherit;border:0;border-radius:8px;background:#b5430c;color:#fff;cursor:pointer}small{color:#55636b}</style></head><body><h1>Code erneut senden</h1><p>Mail mit dem Supporter-Code nicht angekommen? Gib die E-Mail-Adresse ein, die du bei Ko-fi verwendet hast. Wir senden den Code <strong>nur an diese Adresse</strong>, wenn sie zu einer Unterstützung passt.</p><p lang="en"><small>Did not get your supporter code mail? Enter the address you used at Ko-fi. We only send the code to that address, and only if it matches a donation.</small></p><form method="post" action="/resend"><label for="e">E-Mail-Adresse / Email address</label><input id="e" name="email" type="email" autocomplete="email" required maxlength="320"><label for="t">Transaktions-ID (optional) / Transaction id (optional)</label><input id="t" name="txid" type="text" autocomplete="off" maxlength="100"><button type="submit">Code senden / Send code</button></form><p><small>Schau auch im Spam-Ordner nach. Es wird nichts gespeichert außer einem anonymen Prüfwert. / Check your spam folder too. Nothing is stored except an anonymous check value.</small></p></body></html>`;

/** The same answer for every outcome, so the page cannot be used to find out who donated. */
const NEUTRAL = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nemo</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:34rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#171f24}</style></head><body><h1>Danke!</h1><p>Falls die Angaben zu einer Unterstützung passen, ist die Mail mit dem Code unterwegs. Schau auch im Spam-Ordner nach.</p><p lang="en">If the details match a donation, the mail with your code is on its way. Please check your spam folder too.</p><p><a href="/resend">Zurück / Back</a></p></body></html>`;

export const resendForm = (): Response => html(200, FORM);

/** One request per transaction and hour; the lock holds no personal data. */
const LOCK_SECONDS = 3600;

export async function handleResend(request: Request, env: Env): Promise<Response> {
  const body = await readLimited(request, 2048);
  if (body === null) return html(413, NEUTRAL);
  const form = new URLSearchParams(body);
  const email = normaliseEmail(form.get('email') ?? '');
  const txid = (form.get('txid') ?? '').trim().slice(0, 100);
  if (!looksLikeEmail(email)) return html(200, NEUTRAL);

  const emailMac = await hmacHex(env.HASH_PEPPER, `mail:${email}`);
  const txKey = txid
    ? await hmacHex(env.HASH_PEPPER, `kofi:${txid}`)
    : await env.KV.get(`em:${emailMac}`);
  const record = txKey ? parseRecord(await env.KV.get(`tx:${txKey}`)) : null;

  // Only an address that matches the one the donation came with gets anything – and the mail goes
  // to exactly that address (equal by keyed hash), never to something else that was typed in.
  if (!txKey || !record || !(await safeEqual(record.emailMac, emailMac))) {
    log('resend', { result: 'no-match' });
    return html(200, NEUTRAL);
  }
  if (await env.KV.get(`rs:${txKey}`)) {
    log('resend', { txp: txKey.slice(0, 8), result: 'cooldown' });
    return html(200, NEUTRAL);
  }
  await env.KV.put(`rs:${txKey}`, '1', { expirationTtl: LOCK_SECONDS });
  await env.MAIL_QUEUE.send({
    kind: 'resend',
    txKey,
    to: email,
    code: record.code,
    tier: record.tier,
  });
  log('resend', { txp: txKey.slice(0, 8), result: 'queued' });
  return html(200, NEUTRAL);
}
