// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { t } from '@/strings';
import { TARGETS } from '../targets';
import { CaptureForm } from './CaptureForm';
import { FieldPanel } from './FieldPanel';

vi.setConfig({ testTimeout: 20_000 });

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 16, 10, 0).getTime());
  localStorage.clear();
  await clearAll();
});
afterEach(() => setNow());

const panel = () => screen.findByTestId('capture-fields');
const field = (key: string) =>
  screen.getByTestId('capture-fields').querySelector<HTMLElement>(`[data-field="${key}"]`);

describe('edit panel: every target renders its fields', () => {
  // Derived from the target definitions: a target that gains or loses a field changes this test by itself.
  for (const [type, target] of Object.entries(TARGETS)) {
    if (target.fields.length === 0) continue;
    it(`${type}: ${target.fields.map((s) => s.key).join(', ')}`, () => {
      const errors = Object.fromEntries(
        target.fields.filter((s) => s.required).map((s) => [s.key, t.quickCapture.field.required]),
      );
      render(
        <FieldPanel
          specs={target.fields}
          fields={{ title: '' }}
          errors={errors}
          onEdit={() => undefined}
        />,
      );
      for (const spec of target.fields) {
        expect(field(spec.key), spec.key).not.toBeNull();
        expect(screen.getByLabelText(t.quickCapture.field[spec.label])).toBeInTheDocument();
      }
      // Each required field says so at the field itself.
      expect(screen.queryAllByText(t.quickCapture.field.required)).toHaveLength(
        target.fields.filter((s) => s.required).length,
      );
    });
  }
});

describe('CaptureForm with editFields (create from a mail)', () => {
  it('invoice: fields prefilled from the line, the message only after a save attempt and at the field', async () => {
    await enableModule(getManifest('invoices')!);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <CaptureForm
        initialText="Kanzlei Beispiel"
        initialType="invoice"
        extra={{ reference: 'AB-77' }}
        editFields
        onSaved={onSaved}
      />,
    );
    await panel();
    expect(within(field('title')!).getByRole('textbox')).toHaveValue('Kanzlei Beispiel');
    expect(within(field('reference')!).getByRole('textbox')).toHaveValue('AB-77');
    // Nothing red before the person tried to save.
    expect(screen.queryByText(t.quickCapture.field.required)).toBeNull();
    expect(screen.queryByText(t.quickCapture.errors.invalid)).toBeNull();

    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    expect(within(field('amountMinor')!).getByText(t.quickCapture.field.required)).toBeVisible();
    expect(screen.queryByText(t.quickCapture.errors.invalid)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();

    await user.type(within(field('amountMinor')!).getByRole('textbox'), '186,40');
    expect(screen.queryByText(t.quickCapture.field.required)).toBeNull();
    await user.type(within(field('date')!).getByRole('textbox'), '03.12.2026');
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [invoice] = await db.table('invoices_invoice').toArray();
    expect(invoice).toMatchObject({
      payee: 'Kanzlei Beispiel',
      amountMinor: 18640,
      dueDate: '2026-12-03',
      reference: 'AB-77',
    });
  });

  it('a chip swaps the fields and keeps the values both targets have', async () => {
    await enableModule(getManifest('invoices')!);
    await enableModule(getManifest('planner')!);
    const user = userEvent.setup();
    render(
      <CaptureForm
        initialText="Kanzlei Beispiel 186,40 € 03.12.2026"
        initialType="invoice"
        editFields
        onSaved={() => undefined}
      />,
    );
    await panel();
    await waitFor(() =>
      expect(within(field('amountMinor')!).getByRole('textbox')).toHaveValue('186,40'),
    );
    await user.clear(within(field('title')!).getByRole('textbox'));
    await user.type(within(field('title')!).getByRole('textbox'), 'Kostennote bezahlen');

    await user.click(screen.getByRole('radio', { name: t.quickCapture.type.finance }));
    await waitFor(() => expect(field('reference')).toBeNull());
    expect(within(field('amountMinor')!).getByRole('textbox')).toHaveValue('186,40');
    expect(within(field('title')!).getByRole('textbox')).toHaveValue('Kostennote bezahlen');

    const more = screen.queryByTestId('capture-more-types');
    if (more) await user.click(more);
    await user.click(screen.getByRole('radio', { name: t.quickCapture.type.plan }));
    await waitFor(() => expect(field('amountMinor')).toBeNull());
    expect(field('estimateMin')).not.toBeNull();
    expect(within(field('title')!).getByRole('textbox')).toHaveValue('Kostennote bezahlen');
  });
});
