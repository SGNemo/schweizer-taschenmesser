import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { keyString } from '@/core/voice/keys';
import { Button } from './Button';

export interface KeyRecorderProps {
  /** The current key string (`F4`, `Ctrl+Alt+M`), empty = none. */
  value: string;
  /** Called with the key string once a key (with its modifiers) was pressed. */
  onRecord: (key: string, modifiers: boolean) => void;
  /** Text of the button for the current value. */
  display: (value: string) => ReactNode;
  /** Button text while it waits for a key. */
  recordingText: ReactNode;
  /** Button text without a key. */
  emptyText: ReactNode;
  ariaLabel: string;
  testId?: string;
  /** Called when recording starts (e.g. to clear an old error text). */
  onStart?: () => void;
}

/**
 * A button that records the next key press: click it, press the key (Esc cancels). While it records
 * it carries `data-hotkey-recording`, which the global key handlers respect (they leave every key to
 * the recorder). Validation and storage stay with the caller.
 */
export function KeyRecorder({
  value,
  onRecord,
  display,
  recordingText,
  emptyText,
  ariaLabel,
  testId,
  onStart,
}: KeyRecorderProps) {
  const [recording, setRecording] = useState(false);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    e.preventDefault();
    if (e.key === 'Escape') return setRecording(false);
    const key = keyString(e);
    if (!key) return; // only a modifier so far
    setRecording(false);
    onRecord(key, e.ctrlKey || e.altKey || e.shiftKey || e.metaKey);
  }

  return (
    <Button
      onClick={() => {
        onStart?.();
        setRecording(true);
      }}
      onKeyDown={onKeyDown}
      onBlur={() => setRecording(false)}
      aria-label={ariaLabel}
      data-testid={testId}
      data-hotkey-recording={recording || undefined}
    >
      {recording ? recordingText : value ? display(value) : emptyText}
    </Button>
  );
}
