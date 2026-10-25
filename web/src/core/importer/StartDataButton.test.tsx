// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as RegistryModule from '@/core/setup/registry';
import { useSetupHost } from '@/core/setup/host';
import { t } from '@/strings';
import { StartDataButton } from './StartDataButton';

const stepFor = vi.hoisted(() => vi.fn<(id: string, start: boolean) => string | undefined>());
vi.mock('@/core/setup/registry', async (importOriginal) => ({
  ...(await importOriginal<typeof RegistryModule>()),
  setupStepIdForModule: stepFor,
}));

afterEach(() => {
  stepFor.mockReset();
  useSetupHost.getState().close();
});

describe('StartDataButton setup link', () => {
  it('shows the link only when the assistant has a step, and opens that step on click', async () => {
    stepFor.mockReturnValue('core.startdata');
    render(<StartDataButton moduleId="todos" />);
    await userEvent.click(screen.getByRole('button', { name: t.setup.open }));
    expect(useSetupHost.getState()).toMatchObject({ open: true, stepId: 'core.startdata' });
  });

  it('shows no link without a step, and nothing opens by itself', () => {
    stepFor.mockReturnValue(undefined);
    render(<StartDataButton moduleId="todos" />);
    expect(screen.getByRole('button', { name: t.onboarding.button })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.setup.open })).toBeNull();
    expect(useSetupHost.getState().open).toBe(false);
  });

  it('can leave the link out where the button already sits in the assistant', () => {
    stepFor.mockReturnValue('core.startdata');
    render(<StartDataButton moduleId="todos" setupLink={false} />);
    expect(screen.queryByRole('button', { name: t.setup.open })).toBeNull();
  });

  it('renders nothing for a module without start data', () => {
    stepFor.mockReturnValue('core.startdata');
    const { container } = render(<StartDataButton moduleId="nope" />);
    expect(container.textContent).toBe('');
  });
});
