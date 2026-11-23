// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { NoteImage } from '../editor/imageNode';

// Q2 (launch review 2026-11): a note with a remote image called home when opened in the PWA (the
// desktop CSP blocks it, a browser does not). A remote picture is never loaded; the note says so.
type View = (props: { node: { attrs: Record<string, unknown> } }) => { dom: HTMLElement };
const view = (NoteImage.config.addNodeView as unknown as () => View).call({} as never);

describe('note images', () => {
  it('never loads a remote picture', () => {
    for (const src of [
      'https://tracker.example/pixel.png',
      'http://192.168.1.1/x.gif',
      '//cdn.example/x.png',
    ]) {
      const { dom } = view({ node: { attrs: { src, alt: 'Bild' } } });
      expect(dom.querySelector('img'), src).toBeNull();
      expect(dom.textContent).toContain(t.notes.imageRemote);
    }
  });

  it('shows embedded pictures', () => {
    const { dom } = view({
      node: { attrs: { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'x' } },
    });
    expect(dom.querySelector('img')).not.toBeNull();
  });
});
