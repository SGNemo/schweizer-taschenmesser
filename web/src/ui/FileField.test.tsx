// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileField } from './FileField';

const file = (name: string) => new File(['x'], name, { type: 'text/plain' });

describe('FileField (U07)', () => {
  it('says "Datei wählen" and "Keine Datei gewählt" instead of the browser text, input reachable by its label', () => {
    render(<FileField label="Datei" hint="Bleibt auf diesem Gerät." onFiles={() => {}} />);
    const input = screen.getByLabelText('Datei');
    expect(input).toHaveAttribute('type', 'file');
    // Visually hidden, but not removed from the tab order.
    expect(input).not.toHaveAttribute('hidden');
    expect(input).not.toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('Datei wählen')).toBeInTheDocument();
    expect(screen.getByText('Keine Datei gewählt')).toBeInTheDocument();
    const described = input.getAttribute('aria-describedby')!.split(' ');
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Keine Datei gewählt',
      'Bleibt auf diesem Gerät.',
    ]);
  });

  it('shows the picked name, passes accept/multiple and hands the files over', async () => {
    const onFiles = vi.fn();
    render(<FileField label="Anhang" accept=".pdf" multiple onFiles={onFiles} />);
    const input = screen.getByLabelText<HTMLInputElement>('Anhang');
    expect(input).toHaveAttribute('accept', '.pdf');
    expect(input.multiple).toBe(true);
    expect(screen.getByText('Dateien wählen')).toBeInTheDocument();
    await userEvent.upload(input, [file('a.pdf'), file('b.pdf')]);
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles.mock.calls[0]![0]).toHaveLength(2);
    expect(screen.getByText('2 Dateien gewählt')).toBeInTheDocument();
  });

  it('offers "Entfernen" while a file is chosen and marks an error', () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <FileField label="Datei" fileName="vertrag.pdf" onFiles={() => {}} onRemove={onRemove} />,
    );
    expect(screen.getByText('vertrag.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(onRemove).toHaveBeenCalledOnce();
    rerender(<FileField label="Datei" fileName={null} error="Zu groß." onFiles={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Entfernen' })).toBeNull();
    expect(screen.getByLabelText('Datei')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Zu groß.');
  });
});
