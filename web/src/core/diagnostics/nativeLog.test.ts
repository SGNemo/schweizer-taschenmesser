// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearErrorLog, errorLog } from './errorLog';
import { importNativePanics } from './nativeLog';

afterEach(clearErrorLog);

const platformWith = (text: string | null) =>
  ({ desktop: { takePanicLog: vi.fn(async () => text) } }) as never;

describe('importNativePanics', () => {
  it('turns panic lines into scrubbed diagnostics entries with their own time', async () => {
    const n = await importNativePanics(
      platformWith(
        '1790000000 src/capture.rs:42 index out of bounds in /home/erika/x for erika@example.test\n' +
          'garbage line\n' +
          '1790000100 src/lib.rs:7 second\n',
      ),
    );
    expect(n).toBe(2);
    const log = errorLog();
    expect(log.map((e) => e.source)).toEqual(['rust', 'rust']);
    expect(log[0]?.at).toBe(1_790_000_000_000);
    expect(log[0]?.message).toContain('panic at src/capture.rs:42');
    expect(JSON.stringify(log)).not.toContain('erika');
  });

  it('does nothing without a native log or on a platform without the call', async () => {
    expect(await importNativePanics(platformWith(null))).toBe(0);
    expect(await importNativePanics({ desktop: {} } as never)).toBe(0);
    expect(errorLog()).toHaveLength(0);
  });
});
