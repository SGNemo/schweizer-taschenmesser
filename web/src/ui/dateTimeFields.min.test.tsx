// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DayField } from './DateTimeFields';

/** "Gekündigt zum" (0b-8): a first allowed day, typed or stored, never a value before it. */
describe('DayField min', () => {
  it('an earlier day typed is not reported, blocks the form and says the first allowed day on leaving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DayField label="Gekündigt zum" value="" onChange={onChange} min="2026-10-01" />);
    const field = screen.getByLabelText('Gekündigt zum') as HTMLInputElement;
    await user.type(field, '15.09.2026');
    expect(onChange).not.toHaveBeenCalledWith('2026-09-15');
    expect(field.validity.valid).toBe(false);
    // No message while typing …
    expect(screen.queryByRole('alert')).toBeNull();
    await user.tab();
    // … but once the field is left.
    expect(screen.getByRole('alert')).toHaveTextContent('Frühestens am 01.10.2026.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('the first allowed day itself and later days are reported', async () => {
    const user = userEvent.setup();
    function Host() {
      const [v, setV] = useState('');
      return <DayField label="Gekündigt zum" value={v} onChange={setV} min="2026-10-01" />;
    }
    render(<Host />);
    const field = screen.getByLabelText('Gekündigt zum') as HTMLInputElement;
    await user.type(field, '01.10.2026');
    await user.tab();
    expect(field.validity.valid).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field.value).toBe('01.10.2026');
  });

  it('a stored day the limit moved past says so at once and blocks the form', () => {
    render(
      <DayField label="Gekündigt zum" value="2026-09-15" onChange={() => {}} min="2026-10-01" />,
    );
    const field = screen.getByLabelText('Gekündigt zum') as HTMLInputElement;
    expect(field.validity.valid).toBe(false);
    expect(screen.getByRole('alert')).toHaveTextContent('Frühestens am 01.10.2026.');
  });

  it('an empty optional field stays valid', () => {
    render(<DayField label="Gekündigt zum" value="" onChange={() => {}} min="2026-10-01" />);
    expect((screen.getByLabelText('Gekündigt zum') as HTMLInputElement).validity.valid).toBe(true);
  });
});
