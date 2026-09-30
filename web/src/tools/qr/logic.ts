import qrcode from 'qrcode-generator';

export class QrTooLongError extends Error {
  constructor() {
    super('too-long');
  }
}

export interface QrMatrix {
  size: number;
  /** Row-major dark modules. */
  dark: boolean[][];
}

/** Builds a QR code (error correction M, UTF-8 payload). Throws `QrTooLongError` when it does not fit. */
export function makeQr(text: string): QrMatrix {
  // The library defaults to ISO-8859-1; UTF-8 keeps umlauts and emoji intact for modern readers.
  qrcode.stringToBytes = (text) => Array.from(new TextEncoder().encode(text));
  const qr = qrcode(0, 'M');
  qr.addData(text);
  try {
    qr.make();
  } catch {
    throw new QrTooLongError();
  }
  const size = qr.getModuleCount();
  const dark = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => qr.isDark(r, c)),
  );
  return { size, dark };
}

/** One SVG path for all dark modules (quiet zone of 4 modules included in the viewBox). */
export function qrPath(m: QrMatrix, margin = 4): { path: string; box: number } {
  const parts: string[] = [];
  m.dark.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c += 1;
        continue;
      }
      let end = c;
      while (end < row.length && row[end]) end += 1;
      parts.push(`M${c + margin} ${r + margin}h${end - c}v1h${c - end}z`);
      c = end;
    }
  });
  return { path: parts.join(''), box: m.size + margin * 2 };
}

/** A standalone SVG document of the code, for saving. */
export function qrSvg(m: QrMatrix): string {
  const { path, box } = qrPath(m);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#fff"/><path d="${path}" fill="#000"/></svg>\n`;
}
