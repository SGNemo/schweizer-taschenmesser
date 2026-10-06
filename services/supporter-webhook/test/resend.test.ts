import { describe, expect, it } from 'vitest';
import { verifyCode } from '../../../packages/supporter-codes/src/index.ts';
import { handleFetch } from '../src/index.ts';
import { donation, kofiRequest, makeDeps, makeEnv, PUBLIC_KEYS } from './helpers.ts';

const post = (fields: Record<string, string>) =>
  new Request('https://hook.example.invalid/resend', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

async function withDonation() {
  const ctx = makeEnv();
  const { deps } = makeDeps();
  await handleFetch(kofiRequest(donation()), ctx.env, deps);
  ctx.jobs.length = 0; // forget the original mail
  return { ...ctx, deps };
}

describe('"send my code again" page', () => {
  it('shows a form on GET, with strict headers and no CORS', async () => {
    const { env, deps } = await withDonation();
    const res = await handleFetch(new Request('https://hook.example.invalid/resend'), env, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(await res.text()).toContain('name="email"');
  });

  it('the address alone finds the donation and the code goes to exactly that address', async () => {
    const { env, jobs, deps } = await withDonation();
    const res = await handleFetch(post({ email: ' Ada.Donor@Example.invalid ' }), env, deps);
    expect(res.status).toBe(200);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: 'resend', to: 'ada.donor@example.invalid' });
    expect(verifyCode(jobs[0]!.code, PUBLIC_KEYS).ok).toBe(true);
  });

  it('works with the transaction id as well', async () => {
    const { env, jobs, deps } = await withDonation();
    await handleFetch(
      post({ email: 'ada.donor@example.invalid', txid: '11111111-2222-4333-8444-555555555555' }),
      env,
      deps,
    );
    expect(jobs).toHaveLength(1);
  });

  it('never sends to an address that does not belong to the donation', async () => {
    const { env, jobs, deps } = await withDonation();
    await handleFetch(post({ email: 'someone.else@example.invalid' }), env, deps);
    await handleFetch(
      post({ email: 'someone.else@example.invalid', txid: '11111111-2222-4333-8444-555555555555' }),
      env,
      deps,
    );
    await handleFetch(post({ email: 'not-an-address' }), env, deps);
    await handleFetch(post({}), env, deps);
    expect(jobs).toEqual([]);
  });

  it('answers identically whether or not anything matched', async () => {
    const { env, deps } = await withDonation();
    const hit = await handleFetch(post({ email: 'ada.donor@example.invalid' }), env, deps);
    const miss = await handleFetch(post({ email: 'nobody@example.invalid' }), env, deps);
    expect(hit.status).toBe(miss.status);
    expect(await hit.text()).toBe(await miss.text());
  });

  it('allows one send per donation and hour', async () => {
    const { env, jobs, deps } = await withDonation();
    for (let i = 0; i < 3; i++) {
      await handleFetch(post({ email: 'ada.donor@example.invalid' }), env, deps);
    }
    expect(jobs).toHaveLength(1);
  });

  it('is rate limited like the other routes and refuses an oversized form', async () => {
    const { env, jobs, deps } = await withDonation();
    const limited = { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } };
    expect(
      (await handleFetch(post({ email: 'ada.donor@example.invalid' }), limited, deps)).status,
    ).toBe(429);
    const big = await handleFetch(
      post({ email: 'a@example.invalid', txid: 'x'.repeat(5000) }),
      env,
      deps,
    );
    expect(big.status).toBe(413);
    expect(jobs).toEqual([]);
  });
});
