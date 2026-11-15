import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import { DEMO_EMAIL } from '../cache';
import manifest from '../manifest';
import { bodySchema, threadSchema } from '../schema';
import seedModule from '../seed';

describe('mail seed', () => {
  it.each(SEED_SCALES)('is deterministic, valid and uses only invented addresses (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.thread!.length).toBeGreaterThan(0);
    // One body per message: a thread with the person's own answer has two.
    const messages = rows.thread!.reduce(
      (n, r) => n + (r.data as { demo: { messageCount: number } }).demo.messageCount,
      0,
    );
    expect(rows.body!.length).toBe(messages);
    for (const row of rows.thread!) expect(threadSchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.body!) expect(bodySchema.safeParse(row.data).success).toBe(true);
    const emails = JSON.stringify(rows).match(/[\w.+-]+@[\w.-]+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    // the host is example.org itself or a subdomain of it – not just any name ending in that text
    for (const e of emails) expect(e).toMatch(/@([a-z0-9-]+\.)*example\.org$/);
  });

  it("has one planned-reply case: the newest message is the person's own (`lastFromMe`, last body exists)", () => {
    const rows = seedModule.seed(
      createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale: 'medium' }),
    );
    const mine = rows.thread!.map((r) => r.data as { demo: Record<string, unknown> });
    const answered = mine.filter((r) => r.demo.lastFromMe === true);
    expect(answered).toHaveLength(1);
    const last = answered[0]!.demo.lastMessageId as string;
    expect(rows.body!.some((b) => b.id === `demo|${last}`)).toBe(true);
    // The answer is from the demo mailbox's own address (the page names no ToDo after it).
    expect((answered[0]!.demo.from as { email: string }).email).toBe(DEMO_EMAIL);
    // The small set stays as it was (four mails, none answered).
    const small = seedModule.seed(
      createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale: 'small' }),
    );
    expect(JSON.stringify(small)).not.toContain('lastFromMe');
  });
});
