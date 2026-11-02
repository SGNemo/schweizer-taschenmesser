import Image from '@tiptap/extension-image';
import { t } from '@/strings';
import { loadImage } from './images';

/**
 * Pictures are stored as `![alt](nemo-img:<id>)`; the bytes live in this device's `_blobs`. The node view
 * resolves the source to an object URL, or shows a calm note when the picture is only on another device.
 */
export const NoteImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'note-image';
      const src = String(node.attrs.src ?? '');
      const alt = String(node.attrs.alt ?? '');
      let url: string | undefined;
      let gone = false;
      if (src.startsWith('nemo-img:')) {
        void loadImage(src).then((blob) => {
          if (gone) return;
          if (!blob) {
            dom.textContent = t.notes.imageElsewhere;
            dom.dataset.missing = 'true';
            return;
          }
          url = URL.createObjectURL(blob);
          const img = document.createElement('img');
          img.src = url;
          img.alt = alt;
          dom.replaceChildren(img);
        });
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        dom.append(img);
      }
      return {
        dom,
        destroy() {
          gone = true;
          if (url) URL.revokeObjectURL(url);
        },
      };
    };
  },
});
