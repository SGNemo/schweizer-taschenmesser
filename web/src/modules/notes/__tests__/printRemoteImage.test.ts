// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pageToHtml } from '../editor/print';

// Q2 (launch review 2026-11), council round 1: printing a note must not load a picture from the net
// either (the print frame of a PWA served without the CSP would fetch it).
describe('printing a note', () => {
  it('drops remote picture addresses and keeps inline ones', async () => {
    const html = await pageToHtml(
      {
        id: 'n1',
        title: 'Notiz',
        body: '![a](https://tracker.example/pixel.png)\n\n![b](data:image/png;base64,iVBORw0KGgo=)',
      },
      'Scratchpad',
    );
    expect(html).not.toContain('tracker.example');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });
});
