// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import { t } from '@/strings';
import { LockScreen } from '../components/LockScreen';

afterEach(() => setPlatform(undefined));

describe('lock screen: focus', () => {
  it('the master password field has the focus when the screen appears, marked with data-autofocus', () => {
    // The lock screen is a page, not a Dialog: nobody else reads the marker, so it focuses the field itself.
    render(<LockScreen />);
    const field = screen.getByLabelText(t.accounts.lock.password);
    expect(field).toHaveAttribute('data-autofocus');
    expect(field).not.toHaveAttribute('autofocus');
    expect(field).toHaveFocus();
  });
});
