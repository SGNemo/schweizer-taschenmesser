// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordUsage } from '@/core/ai/usage';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { AiStatsSection } from './AiStatsSection';

const s = t.ai.stats;

beforeEach(async () => {
  await db.table('_aiUsage').clear();
});

describe('AI statistics', () => {
  it('says only the one sentence while nothing was answered, even after failed attempts', async () => {
    await recordUsage({
      provider: 'groq',
      model: 'm',
      inputTokens: 0,
      outputTokens: 0,
      cacheHit: false,
      outcome: 'error',
      errorCode: 'unavailable',
    });
    render(<AiStatsSection />);
    expect(await screen.findByText(s.empty)).toBeInTheDocument();
    expect(screen.queryByText(s.perDay)).toBeNull();
    expect(screen.queryByText(s.answers(0))).toBeNull();
  });

  it('lists a day with answers', async () => {
    await recordUsage({
      provider: 'rules',
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      cacheHit: false,
      stage: 'rule',
    });
    render(<AiStatsSection />);
    expect(await screen.findByText(s.perDay)).toBeInTheDocument();
    expect(screen.getByText(s.today)).toBeInTheDocument();
    expect(screen.queryByText(s.empty)).toBeNull();
  });
});
