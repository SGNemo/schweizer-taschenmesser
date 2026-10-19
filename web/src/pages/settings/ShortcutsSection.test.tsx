// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readShortcutPrefs, writeShortcutPrefs } from '@/core/keyboard/prefs';
import { writeVoicePrefs } from '@/core/voice/settings';
import { tKeys } from '@/strings.keys';
import { ShortcutsSection } from './ShortcutsSection';

const tx = tKeys.de;

beforeEach(() => {
  localStorage.clear();
  writeShortcutPrefs({ keys: {} });
});
afterEach(() => writeVoicePrefs({ enabled: false, key: 'F4' }));

function record(testId: string, key: string) {
  const button = screen.getByTestId(testId);
  fireEvent.click(button);
  fireEvent.keyDown(button, { key, code: key });
}

describe('Settings → Tastenkürzel', () => {
  it('lists every action with its default key, the voice key and the fixed chords', () => {
    render(<ShortcutsSection />);
    expect(screen.getByTestId('shortcut-quickAdd')).toHaveTextContent('F2');
    expect(screen.getByTestId('shortcut-palette')).toHaveTextContent('F3');
    expect(screen.getByTestId('shortcut-today')).toHaveTextContent('F6');
    expect(screen.getByTestId('shortcut-tool-timer')).toHaveTextContent('F8');
    expect(screen.getByTestId('shortcut-tool-screenshot')).toHaveTextContent(tx.none);
    expect(screen.getByTestId('shortcut-voice')).toHaveTextContent('F4');
  });

  it('rebinds a free key and stores only the difference', () => {
    render(<ShortcutsSection />);
    record('shortcut-tool-screenshot', 'F7'); // F7 is "Fokus starten"
    expect(screen.getByTestId('shortcut-message')).toHaveTextContent('„Fokus starten“');
    expect(readShortcutPrefs().keys).toEqual({});
  });

  it('refuses a taken key with a text, then accepts it once it is freed', () => {
    render(<ShortcutsSection />);
    fireEvent.click(screen.getByRole('button', { name: `${tx.clear}: Werkzeug: Rechner` }));
    expect(readShortcutPrefs().keys).toEqual({ 'tool:calc': '' });
    record('shortcut-today', 'F9');
    expect(readShortcutPrefs().keys).toEqual({ 'tool:calc': '', today: 'F9' });
    expect(screen.getByTestId('shortcut-today')).toHaveTextContent('F9');
  });

  it('rejects keys that belong to the browser or system', () => {
    render(<ShortcutsSection />);
    record('shortcut-today', 'F5');
    expect(screen.getByTestId('shortcut-message')).toHaveTextContent(tx.rejected);
    expect(readShortcutPrefs().keys).toEqual({});
  });

  it('"Standard" brings the default key back', () => {
    render(<ShortcutsSection />);
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`${tx.clear}: Werkzeug: .*Timer`) }),
    );
    expect(screen.getByTestId('shortcut-tool-timer')).toHaveTextContent(tx.none);
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`${tx.reset}: Werkzeug: .*Timer`) }),
    );
    expect(screen.getByTestId('shortcut-tool-timer')).toHaveTextContent('F8');
    expect(readShortcutPrefs().keys).toEqual({});
  });

  it('keeps the voice key out of the map', () => {
    writeVoicePrefs({ key: 'F9' });
    render(<ShortcutsSection />);
    expect(screen.getByTestId('shortcut-tool-calc')).toHaveTextContent(tx.none);
    record('shortcut-today', 'F9');
    expect(screen.getByTestId('shortcut-message')).toHaveTextContent(tx.takenVoice('F9'));
  });
});
