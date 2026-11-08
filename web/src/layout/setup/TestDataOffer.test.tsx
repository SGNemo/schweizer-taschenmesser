// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { tDev } from '@/strings.dev';

const autoFillIfEmpty = vi.fn(async () => true);
vi.mock('@/core/seed/load', () => ({ loadSeed: async () => ({ autoFillIfEmpty }) }));

const { default: TestDataOffer } = await import('./TestDataOffer');

describe('A10 (round 5): the Dev-Preview asks before it fills an empty app', () => {
  it('fills only after "Mit Testdaten ansehen" and says what it does', async () => {
    render(<TestDataOffer />);
    expect(screen.getByText(tDev.offer.hint)).toBeInTheDocument();
    expect(autoFillIfEmpty).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: tDev.offer.button }));
    await waitFor(() => expect(autoFillIfEmpty).toHaveBeenCalledWith(undefined, { asked: true }));
  });
});
