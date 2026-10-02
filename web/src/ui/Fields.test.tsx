// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import { Checkbox, DateField, SelectField, Switch, TextArea, TextField } from './Fields';
import { Chip, Segmented } from './Patterns';
import { Tabs } from './Tabs';

describe('fields', () => {
  it('a text field wires label, hint and error to the control', () => {
    render(<TextField label="Name" hint="Pflicht" error="Bitte ausfüllen." />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/hint.*err|err.*hint/);
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte ausfüllen.');
  });

  it('a text area and a select field support errors too', () => {
    render(
      <>
        <TextArea label="Notiz" error="Zu lang." />
        <SelectField label="Konto" error="Wählen.">
          <option>A</option>
        </SelectField>
      </>,
    );
    expect(screen.getByLabelText('Notiz')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Konto')).toHaveAttribute('aria-invalid', 'true');
  });

  it('the date field says what the date means', () => {
    setNow(() => new Date('2026-09-29T10:00:00').getTime());
    render(<DateField label="Fällig" value="2026-10-05" onChange={() => undefined} />);
    expect(screen.getByText('Montag, in 6 Tagen')).toBeVisible();
    setNow();
  });

  it('checkbox and switch toggle', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Checkbox label="Erledigt" />
        <Switch label="Aktiv" checked={false} onChange={onChange} />
      </>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Erledigt' }));
    expect(screen.getByRole('checkbox', { name: 'Erledigt' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Aktiv' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('segmented, chips, tabs', () => {
  it('segmented marks the selected option and reports changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Segmented
        label="Ansicht"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('a chip is a toggle button only when clickable', () => {
    render(
      <>
        <Chip label="Nur Anzeige" />
        <Chip label="Filter" selected onClick={() => undefined} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Nur Anzeige' })).toBeNull();
  });

  it('tabs link to routes or select by id, and mark the active one', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <Tabs
          label="Geld"
          onSelect={onSelect}
          items={[
            { id: 'f', label: 'Finanzen', to: '/finance', active: true },
            { id: 'x', label: 'Extra', active: false },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Finanzen' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Extra' }));
    expect(onSelect).toHaveBeenCalledWith('x');
  });
});
