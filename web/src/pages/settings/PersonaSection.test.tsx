// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSettings, setSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { z } from 'zod';
import { PersonaSection } from './PersonaSection';

const s = t.tools.persona;
const read = () =>
  getSettings('tools.persona', z.object({ mailProvider: z.string().optional() }), {});

beforeEach(async () => {
  await setSettings('tools.persona', { mailProvider: 'guerrilla' });
});
afterEach(cleanup);

describe('settings: disposable-mail provider of the persona tool', () => {
  it('shows the stored default and lists the three providers', async () => {
    render(
      <MemoryRouter>
        <PersonaSection />
      </MemoryRouter>,
    );
    const select = await screen.findByLabelText(s.mailProvider);
    expect(select).toHaveValue('guerrilla');
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      s.providers.guerrilla,
      s.providers.tempmail,
      s.providers.tenminute,
    ]);
  });

  it('writes the choice to the same setting the tool reads, and keeps the tool’s other settings', async () => {
    await setSettings('tools.persona', { noticeSeen: true, bio: true });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PersonaSection />
      </MemoryRouter>,
    );
    await user.selectOptions(await screen.findByLabelText(s.mailProvider), 'tenminute');
    await waitFor(async () => expect((await read()).mailProvider).toBe('tenminute'));
    const stored = await getSettings(
      'tools.persona',
      z.object({ noticeSeen: z.boolean(), bio: z.boolean() }),
      {
        noticeSeen: false,
        bio: false,
      },
    );
    expect(stored).toEqual({ noticeSeen: true, bio: true });
  });

  it('falls back to the default for an unknown stored value', async () => {
    await setSettings('tools.persona', { mailProvider: 'nonsense' });
    render(
      <MemoryRouter>
        <PersonaSection />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText(s.mailProvider)).toHaveValue('guerrilla');
  });
});
