import { describe, expect, it } from 'vitest';
import { onboarding as invoices } from '@/modules/invoices/onboarding';
import { onboarding as subscriptions } from '@/modules/subscriptions/onboarding';

describe('start-data forms offer typical names (no prices)', () => {
  it.each([
    ['subscriptions', subscriptions, 'name'],
    ['invoices', invoices, 'payee'],
  ] as const)('%s: the name field has suggestions and no amounts in them', (_id, def, key) => {
    const form = def.importers.find((i) => i.id === 'form');
    const field = form?.fields?.find((f) => f.key === key);
    expect(field?.suggestions?.length).toBeGreaterThanOrEqual(10);
    // Brand names may contain a digit-free "+"; nothing may look like a price.
    expect(field?.suggestions?.some((s) => /\d+[.,]\d{2}|€/.test(s))).toBe(false);
  });
});
