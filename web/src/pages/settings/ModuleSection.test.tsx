// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import accounts from '@/modules/accounts/manifest';
import example from '@/modules/example/manifest';
import { t } from '@/strings';
import { ModuleSection } from './ModuleSection';

const g = t.settings.appearanceGroups;
const m = t.settings.moduleGroups;
/** The section renders only after its stored values are loaded. */
const group = (id: string) => screen.findByTestId(`module-${id}-group-fields`);

describe('Module settings, folded', () => {
  it('shows one closed line with at most three current values, then "+ n"', async () => {
    render(<ModuleSection manifest={accounts} />);
    const fields = await group('accounts');
    const labels = accounts.settings.fields;
    const value = (key: string, v: string) => {
      const f = labels.find((x) => x.key === key);
      return `${f?.label}: ${f?.options?.find((o) => o.value === v)?.label}`;
    };
    const line = [
      value('autoLockMinutes', '5'),
      value('backgroundLock', 'now'),
      value('originMatch', 'domain'),
      m.more(2),
    ].join(' · ');
    expect(await within(fields).findByText(g.line(m.fields, line))).toBeInTheDocument();
    expect(fields).not.toHaveAttribute('open');
  });

  it('keeps every field inside the group, in the order of the manifest', async () => {
    render(<ModuleSection manifest={accounts} />);
    const fields = await group('accounts');
    await within(fields).findByText(/^Felder/);
    for (const f of accounts.settings.fields)
      expect(document.getElementById(`module-accounts--${f.key}`)?.closest('details'), f.key).toBe(
        fields,
      );
  });

  it('a switch that is on is named in the line; switching it off leaves just the title', async () => {
    const user = userEvent.setup();
    render(<ModuleSection manifest={example} />);
    const fields = await group('example');
    const label = example.settings.fields[0]!.label;
    expect(await within(fields).findByText(g.line(m.fields, label))).toBeInTheDocument();
    await user.click(within(fields).getByText(g.change).closest('summary')!);
    expect(fields).toHaveAttribute('open');
    await user.click(within(fields).getByRole('switch', { name: label }));
    expect(await within(fields).findByText(m.fields)).toBeInTheDocument();
    expect(within(fields).queryByText(g.line(m.fields, label))).toBeNull();
  });
});
