/**
 * Whether a settings category shows its "Erweitert" fold open (device-local, `tm-settings-adv`,
 * `{ <category>: boolean }`). Without an own choice the global "Alle Module Erweitert" switch
 * (`comfort.advancedAll`) decides. Storage may be blocked: nothing here throws.
 */
const KEY = 'tm-settings-adv';

function readAll(): Record<string, boolean> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'boolean'))
      : {};
  } catch {
    return {};
  }
}

/** The category's own choice, or `undefined` if it never made one. */
export function readAdvancedOpen(category: string): boolean | undefined {
  return readAll()[category];
}

export function writeAdvancedOpen(category: string, open: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [category]: open }));
  } catch {
    // storage blocked: the fold simply forgets its state
  }
}

/** Own choice first, else the global default. */
export function advancedOpen(category: string, globalDefault: boolean): boolean {
  return readAdvancedOpen(category) ?? globalDefault;
}
