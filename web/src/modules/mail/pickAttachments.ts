import type { OutgoingAttachment } from '@/core/mail/types';

const MAX_FILE = 15 * 1024 * 1024;

/** Lets the user choose files to attach (a plain file input: works in the browser, WebView2 and Android). */
export function pickAttachments(): Promise<{ files: OutgoingAttachment[]; tooLarge: string[] }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', () => {
      const chosen = [...(input.files ?? [])];
      const tooLarge = chosen.filter((f) => f.size > MAX_FILE).map((f) => f.name);
      Promise.all(
        chosen
          .filter((f) => f.size <= MAX_FILE)
          .map(async (f) => ({
            filename: f.name,
            mime: f.type || 'application/octet-stream',
            data: new Uint8Array(await f.arrayBuffer()),
          })),
      ).then((files) => resolve({ files, tooLarge }), reject);
    });
    input.addEventListener('cancel', () => resolve({ files: [], tooLarge: [] }));
    input.click();
  });
}
