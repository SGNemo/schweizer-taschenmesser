import { z } from 'zod';

/**
 * Ko-fi webhook: `application/x-www-form-urlencoded` with one field `data` holding JSON; the
 * payload carries the shared `verification_token`. Field names as documented by Ko-fi (checked
 * against the "Send test" button before going live, see README).
 */
const payloadSchema = z.object({
  verification_token: z.string(),
  type: z.string(),
  kofi_transaction_id: z.string().min(1).max(100),
  email: z.string().min(3).max(320),
  amount: z.string().max(20),
  currency: z.string().length(3),
  is_public: z.boolean().default(false),
  from_name: z.string().max(200).default(''),
  is_first_subscription_payment: z.boolean().optional(),
});
export type KofiPayload = z.infer<typeof payloadSchema>;

/** The JSON inside `data`, or null if the body is not a Ko-fi form. */
export function parseKofiBody(body: string): unknown {
  try {
    const data = new URLSearchParams(body).get('data');
    return data === null ? null : JSON.parse(data);
  } catch {
    return null;
  }
}

/** The token field alone, so it can be verified before anything else is looked at. */
export function tokenOf(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const token = (raw as { verification_token?: unknown }).verification_token;
  return typeof token === 'string' ? token : null;
}

export function parsePayload(raw: unknown): KofiPayload | null {
  const r = payloadSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Only a successful one-off donation (or the first payment of a membership) earns a code. */
export function earnsCode(p: KofiPayload): boolean {
  return (
    p.type === 'Donation' || (p.type === 'Subscription' && p.is_first_subscription_payment === true)
  );
}
