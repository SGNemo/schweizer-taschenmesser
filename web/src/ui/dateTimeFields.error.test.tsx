// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DayField } from './DateTimeFields';

describe('DayField: a message of the form', () => {
  it("shows the form's message as the field's error and marks the field invalid", () => {
    render(
      <DayField
        label="Ende"
        value="2026-01-01"
        onChange={() => {}}
        error="Ende liegt vor dem Beginn"
      />,
    );
    const field = screen.getByLabelText('Ende');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Ende liegt vor dem Beginn');
    expect(field).toHaveAccessibleDescription(/Ende liegt vor dem Beginn/);
  });

  it('is valid without a message, and an empty message counts as none', () => {
    render(<DayField label="Ende" value="2026-01-01" onChange={() => {}} error="" />);
    expect(screen.getByLabelText('Ende')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("text that is no date takes the place of the form's message", async () => {
    const user = userEvent.setup();
    render(
      <DayField label="Ende" value="" onChange={() => {}} error="Ende liegt vor dem Beginn" />,
    );
    await user.type(screen.getByLabelText('Ende'), 'morgen irgendwann');
    await user.tab();
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent('Ende liegt vor dem Beginn');
    expect(alert.textContent).not.toBe('');
  });
});
