// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DATA_FLOW_IDS } from '@/core/legal/dataFlows';
import licenses from '@/core/about/licenses.json';
import { LegalImprintSection, LegalLicensesSection, LegalPrivacySection } from './LegalSections';

describe('Rechtliches', () => {
  it('imprint shows the open placeholders and says they are open', () => {
    render(<LegalImprintSection />);
    expect(screen.getByText('[[NAME]]')).toBeTruthy();
    expect(screen.getByTestId('legal-open')).toBeTruthy();
  });

  it('privacy lists every data flow', () => {
    render(<LegalPrivacySection />);
    for (const id of DATA_FLOW_IDS) expect(screen.getByTestId(`flow-${id}`)).toBeTruthy();
  });

  it('licences load on opening a group and show the generated entries', async () => {
    render(<LegalLicensesSection />);
    await userEvent.click(screen.getByText(/Web-Bibliotheken/));
    const first = licenses.npm[0]!;
    expect(
      await screen.findByText(`${first.name} ${first.version} – ${first.license}`),
    ).toBeTruthy();
  });
});
