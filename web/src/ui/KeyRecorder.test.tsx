// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KeyRecorder } from './KeyRecorder';

function setup(value = 'F8') {
  const onRecord = vi.fn();
  render(
    <KeyRecorder
      value={value}
      onRecord={onRecord}
      display={(v) => `Taste ${v}`}
      recordingText="Drücken …"
      emptyText="Keine"
      ariaLabel="Taste ändern"
      testId="rec"
    />,
  );
  return { onRecord, button: screen.getByTestId('rec') };
}

describe('KeyRecorder', () => {
  it('shows the value, or the empty text without one', () => {
    expect(setup().button).toHaveTextContent('Taste F8');
  });

  it('records the next key, marks itself while waiting and reports modifiers', () => {
    const { onRecord, button } = setup();
    fireEvent.click(button);
    expect(button).toHaveAttribute('data-hotkey-recording', 'true');
    expect(button).toHaveTextContent('Drücken …');
    fireEvent.keyDown(button, { key: 'Alt', code: 'AltLeft', altKey: true });
    expect(onRecord).not.toHaveBeenCalled(); // a modifier alone is not a key
    fireEvent.keyDown(button, { key: 'm', code: 'KeyM', altKey: true });
    expect(onRecord).toHaveBeenCalledWith('Alt+M', true);
    expect(button).not.toHaveAttribute('data-hotkey-recording');
  });

  it('reports a bare F-key without modifiers', () => {
    const { onRecord, button } = setup();
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'F9', code: 'F9' });
    expect(onRecord).toHaveBeenCalledWith('F9', false);
  });

  it('Esc and losing focus cancel; keys outside recording do nothing', () => {
    const { onRecord, button } = setup('');
    expect(button).toHaveTextContent('Keine');
    fireEvent.keyDown(button, { key: 'F9', code: 'F9' });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Escape', code: 'Escape' });
    expect(button).not.toHaveAttribute('data-hotkey-recording');
    fireEvent.click(button);
    fireEvent.blur(button);
    expect(button).not.toHaveAttribute('data-hotkey-recording');
    expect(onRecord).not.toHaveBeenCalled();
  });
});
