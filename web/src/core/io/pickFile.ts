/**
 * Lets the user choose a text file and reads it. Resolves `undefined` when the dialog is dismissed.
 * A plain `<input type=file>` works in the browser, in WebView2 and in the Android WebView (the same
 * approach the backup import uses).
 */
export interface PickedFile {
  name: string;
  text: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function pickTextFile(accept: string): Promise<PickedFile | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(undefined);
      if (file.size > MAX_BYTES) return reject(new Error('file-too-large'));
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    });
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}
