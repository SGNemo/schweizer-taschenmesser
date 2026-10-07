// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { NoticeHost } from '@/layout/NoticeHost';
import { hasSeenNotice, requireNotice } from './notices';

describe('one-time notices', () => {
  beforeEach(async () => {
    await db.table('_meta').delete('legal.notices');
  });

  it('do not block when no host is mounted', async () => {
    await expect(requireNotice('cloud-ai')).resolves.toBeUndefined();
  });

  it('wait for "Verstanden", then never ask again', async () => {
    render(<NoticeHost />);
    let done = false;
    let p!: Promise<void>;
    await act(async () => {
      p = requireNotice('cloud-ai').then(() => {
        done = true;
      });
    });
    expect(await screen.findByTestId('notice-dialog')).toBeTruthy();
    expect(done).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    await p;
    expect(done).toBe(true);
    expect(await hasSeenNotice('cloud-ai')).toBe(true);
    await expect(requireNotice('cloud-ai')).resolves.toBeUndefined(); // no dialog, returns at once
  });
});
