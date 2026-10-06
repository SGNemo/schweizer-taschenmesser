/**
 * Supporter colour themes: device-local choice (`tm-palette`, like theme and accent), applied as
 * `data-palette` on <html> (ui/supporterThemes.css). Cosmetic only. Non-supporters can try a theme
 * for 30 seconds (in memory, never stored); the inline script in index.html applies a stored
 * choice before first paint and `usePaletteEffect` removes it again for a non-supporter.
 */
import { useEffect } from 'react';
import { create } from 'zustand';

export const PALETTES = ['korallenriff', 'tiefsee', 'sand', 'nordlicht', 'monochrom'] as const;
export type PaletteId = (typeof PALETTES)[number];
export const PREVIEW_MS = 30_000;

const PALETTE_KEY = 'tm-palette';
const LOGO_KEY = 'tm-logo';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: the choice still applies for this session
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore, see above
  }
}

export const isPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p === v);

interface PaletteState {
  /** The stored choice (applies only while the user is a supporter). */
  chosen: PaletteId | null;
  /** Try-out of a locked theme; lasts `PREVIEW_MS`, never stored. */
  preview: PaletteId | null;
  /** Fish in the accent colour instead of Nemo orange (supporter, device-local). */
  logoThemed: boolean;
  choose(id: PaletteId | null): void;
  startPreview(id: PaletteId): void;
  stopPreview(): void;
  setLogoThemed(on: boolean): void;
}

let previewTimer: ReturnType<typeof setTimeout> | undefined;

export const usePaletteStore = create<PaletteState>((set) => ({
  chosen: ((v) => (isPalette(v) ? v : null))(read(PALETTE_KEY)),
  preview: null,
  logoThemed: read(LOGO_KEY) === 'themed',
  choose(id) {
    write(PALETTE_KEY, id);
    set({ chosen: id });
  },
  startPreview(id) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => set({ preview: null }), PREVIEW_MS);
    set({ preview: id });
  },
  stopPreview() {
    clearTimeout(previewTimer);
    set({ preview: null });
  },
  setLogoThemed(on) {
    write(LOGO_KEY, on ? 'themed' : null);
    set({ logoThemed: on });
  },
}));

/** The palette that is on screen: a running preview, else the stored choice for supporters. */
export function effectivePalette(
  isSupporter: boolean,
  chosen: PaletteId | null,
  preview: PaletteId | null,
): PaletteId | null {
  return preview ?? (isSupporter ? chosen : null);
}

export function applyPalette(id: PaletteId | null, logoThemed = false): void {
  const el = document.documentElement;
  if (id) el.dataset.palette = id;
  else delete el.dataset.palette;
  if (id && logoThemed) el.dataset.logo = 'themed';
  else delete el.dataset.logo;
}

/** Mount once in the app shell: keeps `<html>` in step with status, choice and preview. */
export function usePaletteEffect(isSupporter: boolean): void {
  const chosen = usePaletteStore((s) => s.chosen);
  const preview = usePaletteStore((s) => s.preview);
  const logoThemed = usePaletteStore((s) => s.logoThemed);
  useEffect(() => {
    applyPalette(effectivePalette(isSupporter, chosen, preview), isSupporter && logoThemed);
  }, [isSupporter, chosen, preview, logoThemed]);
}
