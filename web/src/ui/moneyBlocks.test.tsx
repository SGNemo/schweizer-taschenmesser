// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setFormatPref } from '@/core/i18n/format';
import { AdvancedFields } from './AdvancedFields';
import { DayField, TimeField } from './DateTimeFields';
import { DetailPanel } from './DetailPanel';
import { Switch } from './Fields';
import { FormActions, ItemList, ItemRow } from './Patterns';

/**
 * The building blocks package 0b-3 of UI audit 2026-11 added to `@/ui`: date and time fields in the app's format,
 * the fixed foot of a sheet, the detail panel of a master–detail page, the row marked as current, the neutral
 * switch and the summary beside "Mehr Felder".
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const css = (name: string) => readFileSync(join(HERE, name), 'utf8');

afterEach(() => setFormatPref('auto'));

function Day({
  start = '2026-09-29',
  onChange = () => {},
}: {
  start?: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(start);
  return (
    <DayField
      label="Datum"
      value={value}
      required
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('DayField', () => {
  it('shows the date in the app format and keeps the label for the field alone', () => {
    setFormatPref('de-DE');
    render(<Day />);
    expect(screen.getByLabelText('Datum')).toHaveValue('29.09.2026');
    // The calendar button is named by what it does, so "Datum" finds one control.
    expect(screen.getAllByLabelText('Datum')).toHaveLength(1);
    // jsdom has no `showPicker`: no dead calendar button there (browsers with it: e2e/seed/money-area.seed.spec.ts).
    expect(screen.queryByRole('button', { name: 'Kalender öffnen' })).toBeNull();
  });

  it('reports the stored form for what is typed, in the region order or as ISO', async () => {
    setFormatPref('de-DE');
    const seen = vi.fn();
    const user = userEvent.setup();
    render(<Day onChange={seen} />);
    const field = screen.getByLabelText('Datum');
    await user.clear(field);
    await user.type(field, '3.9.26');
    expect(seen).toHaveBeenLastCalledWith('2026-09-03');
    await user.tab();
    expect(field).toHaveValue('03.09.2026');
    await user.clear(field);
    await user.type(field, '2026-07-15');
    expect(seen).toHaveBeenLastCalledWith('2026-07-15');
  });

  it('says so when the text is no date and keeps the last good value', async () => {
    setFormatPref('de-DE');
    const seen = vi.fn();
    const user = userEvent.setup();
    render(<Day onChange={seen} />);
    const field = screen.getByLabelText('Datum');
    await user.clear(field);
    await user.type(field, '31.02.2026');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte ein Datum eingeben');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(seen).not.toHaveBeenCalledWith('2026-02-31');
  });

  it('text that stopped being a date blocks the form instead of saving the last readable prefix', async () => {
    setFormatPref('de-DE');
    const submit = vi.fn();
    const user = userEvent.setup();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Day />
        <button type="submit">Speichern</button>
      </form>,
    );
    const field = screen.getByLabelText<HTMLInputElement>('Datum');
    await user.clear(field);
    // "3.9.20" reads as 2020 on the way; "3.9.202" is no date.
    await user.type(field, '3.9.202');
    expect(field.validity.valid).toBe(false);
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(submit).not.toHaveBeenCalled();
    await user.type(field, '6');
    expect(field.validity.valid).toBe(true);
    await user.keyboard('{Enter}');
    expect(submit).toHaveBeenCalledOnce();
  });
});

describe('TimeField', () => {
  it('reads short forms and reports HH:mm', async () => {
    const seen = vi.fn();
    const user = userEvent.setup();
    render(<TimeField label="Beginn" value="" onChange={seen} />);
    await user.type(screen.getByLabelText('Beginn'), '930');
    expect(seen).toHaveBeenLastCalledWith('09:30');
  });
});

describe('sheet foot, detail panel, current row, neutral switch', () => {
  it('FormActions is the sticky foot of a dialog on the phone', () => {
    render(
      <FormActions start={<button type="button">Löschen</button>}>
        <button type="submit">Speichern</button>
      </FormActions>,
    );
    expect(document.querySelector('[data-form-actions]')).not.toBeNull();
    const patterns = css('Patterns.module.css').replace(/\s+/g, ' ');
    expect(patterns).toMatch(
      /@media \(max-width: 899px\) \{ dialog \.formActions \{ position: sticky; inset-block-end: 0;/,
    );
  });

  it('DetailPanel shows title, figure, facts and actions and closes', async () => {
    const close = vi.fn();
    const user = userEvent.setup();
    render(
      <DetailPanel
        eyebrow="Rechnung"
        title="Stadtwerke"
        figure="87,40 €"
        facts={[{ label: 'Fällig am', value: '17. September 2026' }]}
        actions={<button type="button">Bearbeiten</button>}
        onClose={close}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Stadtwerke' })).toBeInTheDocument();
    expect(screen.getByText('87,40 €')).toBeInTheDocument();
    expect(screen.getByText('Fällig am').tagName).toBe('DT');
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Details schließen' }));
    expect(close).toHaveBeenCalledOnce();
    // Tone step: no frame and no shadow on the panel.
    const panel = css('DetailPanel.module.css');
    expect(panel).not.toMatch(/box-shadow/);
    expect(panel).not.toMatch(/border:\s*1px/);
  });

  it('ItemRow current marks the row whose entry the panel shows', () => {
    render(
      <ItemList>
        <ItemRow title="Bahn" onOpen={() => {}} current />
        <ItemRow title="Tram" onOpen={() => {}} />
      </ItemList>,
    );
    expect(screen.getByRole('button', { name: 'Bahn' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Tram' })).not.toHaveAttribute('aria-current');
  });

  it('a neutral switch is on in grey, not in the accent', () => {
    render(<Switch label="Aktiv" checked onChange={() => {}} tone="neutral" />);
    expect(screen.getByRole('switch', { name: 'Aktiv' })).toHaveAttribute('data-tone', 'neutral');
    const fields = css('Fields.module.css').replace(/\s+/g, ' ');
    expect(fields).toMatch(
      /\.track\[data-tone='neutral'\]\[aria-checked='true'\] \{ background: var\(--calm-ink\);/,
    );
  });

  it('AdvancedFields says what the folded fields hold', () => {
    render(
      <AdvancedFields moduleId="finance" summary="Heute · Girokonto">
        <input aria-label="Notiz" />
      </AdvancedFields>,
    );
    expect(screen.getByTestId('more-fields-summary')).toHaveTextContent('Heute · Girokonto');
    expect(screen.queryByLabelText('Notiz')).toBeNull();
  });
});
