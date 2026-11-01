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

/**
 * UTF-8 first; a file that is not valid UTF-8 (the replacement character appears) is read again as
 * Windows-1252, the encoding many bank exports still use. Plain ASCII and UTF-8 are unaffected.
 */
export function decodeTextBytes(bytes: ArrayBuffer | Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
}

/** What to read a chosen file with; `legacyEncoding` = fall back to Windows-1252 (bank exports). */
export interface PickOptions {
  legacyEncoding?: boolean;
}

const readFile = (file: File, opts?: PickOptions): Promise<string> =>
  opts?.legacyEncoding ? file.arrayBuffer().then(decodeTextBytes) : file.text();

export function pickTextFile(accept: string, opts?: PickOptions): Promise<PickedFile | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(undefined);
      if (file.size > MAX_BYTES) return reject(new Error('file-too-large'));
      readFile(file, opts).then((text) => resolve({ name: file.name, text }), reject);
    });
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}

/** Like `pickTextFile`, several files at once; the empty list means the dialog was dismissed. */
export function pickTextFiles(accept: string): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return resolve([]);
      if (files.some((f) => f.size > MAX_BYTES)) return reject(new Error('file-too-large'));
      Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))).then(
        resolve,
        reject,
      );
    });
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}
