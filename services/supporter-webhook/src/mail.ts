import type { SupporterTier } from '../../../packages/supporter-codes/src/index.ts';
import type { Deps, Env } from './types.ts';

const TIER_DE: Record<SupporterTier, string> = {
  kaffee: 'Kaffee',
  kuchen: 'Kuchen',
  developer: 'Entwickler',
};

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** German first, English below. Friendly, never pushy; says plainly that everything stays free. */
export function renderCodeMail(code: string, tier: SupporterTier, canReply = false): RenderedMail {
  const de = [
    'Hallo und vielen Dank für deine Unterstützung von Nemo!',
    `Hier ist dein Supporter-Code (Stufe: ${TIER_DE[tier]}):`,
  ];
  const deHow =
    'So gibst du ihn ein: Nemo öffnen → Einstellungen → Über Nemo → Supporter → Code einfügen → „Code übernehmen“. Er wird nur auf deinem Gerät geprüft und über deinen Sync auf deine anderen Geräte verteilt.';
  const deFree =
    'Alles in Nemo bleibt für alle kostenlos. Der Code schaltet nur kosmetische Extras frei (Danke-Abzeichen, Farbthemen). Deine Unterstützung ist freiwillig, und du musst nichts weiter tun.';
  const en = [
    'Hello, and thank you so much for supporting Nemo!',
    `Here is your supporter code (tier: ${tier}):`,
  ];
  const enHow =
    'To enter it: open Nemo → Settings → About Nemo → Supporter → paste the code → "Code übernehmen". It is checked on your device only and spreads to your other devices through your sync.';
  const enFree =
    'Everything in Nemo stays free for everyone. The code only unlocks cosmetic extras (thank-you badge, colour themes). Your support is voluntary and there is nothing more to do.';
  // Only promise "reply to this mail" when a reply address exists; otherwise point to the donation page.
  const foot = canReply
    ? 'Fragen oder keine Mail erhalten? Antworte einfach auf diese Mail. / Questions? Just reply to this mail.'
    : 'Fragen oder keine Mail erhalten? Nutze den Kontakt auf der Spendenseite. / Questions? Use the contact on the donation page.';

  const text = [
    ...de,
    '',
    code,
    '',
    deHow,
    '',
    deFree,
    '',
    '—',
    '',
    ...en,
    '',
    code,
    '',
    enHow,
    '',
    enFree,
    '',
    foot,
  ].join('\n');
  const para = (s: string) => `<p style="margin:0 0 12px">${esc(s)}</p>`;
  const block = `<p style="margin:0 0 16px;padding:12px;background:#f3f4f4;border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;word-break:break-all;color:#171f24">${esc(code)}</p>`;
  const html = `<!doctype html><html lang="de"><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171f24;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">${de.map(para).join('')}${block}${para(deHow)}${para(deFree)}<hr style="border:0;border-top:1px solid #e2e5e8;margin:20px 0">${en.map(para).join('')}${block}${para(enHow)}${para(enFree)}<p style="margin:16px 0 0;color:#55636b;font-size:13px">${esc(foot)}</p></body></html>`;
  return {
    subject: 'Danke! Dein Nemo-Supporter-Code / Thank you! Your Nemo supporter code',
    text,
    html,
  };
}

export type SendResult = 'ok' | 'retry' | 'fail';

/** `status` is Resend's HTTP status (a number, no personal data) so a failure can be diagnosed from the logs. */
export interface SendOutcome {
  result: SendResult;
  status?: number;
}

/**
 * Resend HTTP API. Network errors, 429 (daily quota or rate) and 5xx are worth retrying; any other
 * answer (unverified domain, invalid address, bad key) will not get better by waiting.
 */
export async function sendMail(
  env: Env,
  deps: Deps,
  to: string,
  mail: RenderedMail,
): Promise<SendOutcome> {
  try {
    const res = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (res.ok) return { result: 'ok', status: res.status };
    return {
      result: res.status === 429 || res.status >= 500 ? 'retry' : 'fail',
      status: res.status,
    };
  } catch {
    return { result: 'retry' };
  }
}
