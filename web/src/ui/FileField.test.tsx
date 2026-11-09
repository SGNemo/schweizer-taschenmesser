// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileField } from './FileField';

const file = (name: string) => new File(['x'], name, { type: 'text/plain' });

describe('FileField (U07)', () => {
  it('says "Datei wählen" and "Keine Datei gewählt" instead of the browser text, input reachable by its label', () => {
    render(<FileField label="Datei" hint="Bleibt auf diesem Gerät." onFiles={() => {}} />);
    // The name holds the visible button text (label in name).
    const input = screen.getByLabelText('Datei Datei wählen');
    expect(input).toHaveAttribute('type', 'file');
    // Lies over the button: in the tab order, not hidden, so it also takes a dropped file.
    expect(input).not.toHaveAttribute('hidden');
    expect(input).not.toHaveAttribute('tabindex', '-1');
    expect(input.parentElement).toContainElement(screen.getByText('Datei wählen'));
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
    const input = screen.getByLabelText<HTMLInputElement>('Anhang Dateien wählen');
    expect(input).toHaveAttribute('accept', '.pdf');
    expect(input.multiple).toBe(true);
    expect(screen.getByText('Dateien wählen')).toBeInTheDocument();
    await userEvent.upload(input, [file('a.pdf'), file('b.pdf')]);
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles.mock.calls[0]![0]).toHaveLength(2);
    expect(screen.getByText('2 Dateien gewählt')).toHaveAttribute('aria-live', 'polite');
  });

  it('says "Kein Ordner gewählt" for a folder picker, then the folder name', async () => {
    render(<FileField label="Ordner" directory buttonLabel="Ordner wählen" onFiles={() => {}} />);
    expect(screen.getByText('Kein Ordner gewählt')).toBeInTheDocument();
    const input = screen.getByLabelText<HTMLInputElement>('Ordner Ordner wählen');
    expect(input).toHaveAttribute('webkitdirectory');
    const inFolder = (name: string) =>
      Object.defineProperty(file(name), 'webkitRelativePath', { value: `Reisen/${name}` });
    await userEvent.upload(input, [inFolder('Rom.md'), inFolder('Packliste.txt')]);
    expect(screen.getByText('Reisen')).toBeInTheDocument();
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
    expect(screen.getByLabelText(/^Datei/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Zu groß.');
  });
});
