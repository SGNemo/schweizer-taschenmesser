// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Fields';

describe('Checkbox', () => {
  it('without a description it is named by its label, as before', () => {
    render(<Checkbox label="Kalender" />);
    expect(screen.getByRole('checkbox', { name: 'Kalender' })).toBeInTheDocument();
  });

  it('with a description the name is the title and the detail is its description', () => {
    render(<Checkbox label="E-Mails senden" description="Nur nach deiner Bestätigung." />);
    const box = screen.getByRole('checkbox', { name: 'E-Mails senden' });
    expect(box).toHaveAccessibleDescription('Nur nach deiner Bestätigung.');
    expect(box.closest('label')?.getAttribute('data-detail')).toBe('true');
  });
});
