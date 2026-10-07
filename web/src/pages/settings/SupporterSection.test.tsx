// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeCode } from '@nemo/supporter-codes';
import { db } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
import { settingsRepo } from '@/core/settings/settings';
import { t } from '@/strings';
import {
  TEST_PUBLIC_KEY,
  TEST_SECRET_KEY,
} from '../../../../packages/supporter-codes/test/fixtures/test-keypair';
import { SupporterSection } from './SupporterSection';
import { SUPPORT_PAGE_URL } from './supporterLinks';

// This app build trusts the public test key (id 255) – a normal build does not.
vi.mock('@/core/supporter/keys', () => ({
  ACCEPTED_KEYS: {
    255: Array.from(TEST_PUBLIC_KEY, (b) => b.toString(16).padStart(2, '0')).join(''),
  },
}));

const s = t.supporter.section;
const code = (tier: 'kaffee' | 'kuchen', name = '') =>
  encodeCode({ keyId: 255, tier, issued: '2026-10-05', name }, TEST_SECRET_KEY);

function renderSection() {
  return render(
    <MemoryRouter>
      <SupporterSection />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await db.table('_settings').clear();
});

describe('SupporterSection', () => {
  it('starts calm: nothing locked, no code needed, a plain way to pay', async () => {
    renderSection();
    expect(await screen.findByTestId('supporter-status')).toHaveTextContent(s.notSupporter);
    expect(SUPPORT_PAGE_URL).toMatch(/^https:\/\//);
    expect(screen.getByRole('button', { name: s.donate })).toBeEnabled();
    expect(screen.getByRole('switch', { name: s.sidebarBadge })).toBeDisabled();
    expect(screen.getByRole('button', { name: s.contact })).toBeEnabled();
  });

  it('a wrong code gets one friendly message and stores nothing', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.type(screen.getByTestId('supporter-code-input'), 'NEMO1-nope');
    await user.click(screen.getByTestId('supporter-code-save'));
    expect(await screen.findByText(s.invalid)).toBeInTheDocument();
    expect(await settingsRepo.get('supporter')).toBeUndefined();
  });

  it('a valid code shows tier, name and date; removing it goes back', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByTestId('supporter-code-input'));
    await user.paste(code('kuchen', 'Ada'));
    await user.click(screen.getByTestId('supporter-code-save'));

    // The status element is replaced when the state changes: query it again on every attempt.
    const status = () => screen.getByTestId('supporter-status');
    await waitFor(() => expect(status()).toHaveTextContent('Kuchen'));
    expect(status()).toHaveTextContent('Ada');
    expect(status()).toHaveTextContent('05.10.2026');
    expect(screen.getByRole('switch', { name: s.sidebarBadge })).toBeEnabled();

    await user.click(screen.getByTestId('supporter-code-remove'));
    await waitFor(() =>
      expect(screen.getByTestId('supporter-status')).toHaveTextContent(s.notSupporter),
    );
    expect(await settingsRepo.get('supporter')).toMatchObject({ code: '' });
  });

  it('the sidebar badge switch is stored in the synced scope', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByTestId('supporter-code-input'));
    await user.paste(code('kaffee'));
    await user.click(screen.getByTestId('supporter-code-save'));
    const toggle = screen.getByRole('switch', { name: s.sidebarBadge });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(async () =>
      expect(await settingsRepo.get('supporter')).toMatchObject({ showSidebarBadge: true }),
    );
  });

  it('opens the contact page through the platform, never by itself', async () => {
    const open = vi.spyOn(getPlatform().app, 'openUrl').mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSection();
    expect(open).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: s.contact }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/github\.com\//));
  });
});
