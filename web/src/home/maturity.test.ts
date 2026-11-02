import { describe, expect, it } from 'vitest';
import { isWidgetVisible, widgetMaturity } from './maturity';

describe('home widget maturity', () => {
  it('inherits the module maturity and can only tighten it', () => {
    expect(widgetMaturity('stable', {})).toBe('stable');
    expect(widgetMaturity('preview', {})).toBe('preview');
    expect(widgetMaturity('stable', { maturity: 'preview' })).toBe('preview');
    expect(widgetMaturity('preview', { maturity: 'preview' })).toBe('preview');
  });

  it('a preview widget shows with the switch or when pinned, a stable one always', () => {
    const off = { showPreview: false, pinned: [] };
    expect(isWidgetVisible('m:w', {}, off)).toBe(true);
    expect(isWidgetVisible('m:w', { maturity: 'preview' }, off)).toBe(false);
    expect(isWidgetVisible('m:w', { maturity: 'preview' }, { ...off, showPreview: true })).toBe(
      true,
    );
    expect(isWidgetVisible('m:w', { maturity: 'preview' }, { ...off, pinned: ['m:w'] })).toBe(true);
    expect(isWidgetVisible('m:w', { maturity: 'preview' }, { ...off, pinned: ['m:other'] })).toBe(
      false,
    );
  });
});
