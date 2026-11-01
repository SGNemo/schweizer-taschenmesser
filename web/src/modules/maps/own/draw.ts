/**
 * The canvas behind the renderer: an OffscreenCanvas where the browser has one, else a plain canvas
 * element. Returns undefined where nothing can draw (jsdom, no 2D context), so callers fall back.
 */
import { renderTile, type Ctx2D, type RenderInput } from './render';
import type { Palette } from './style';

export async function drawTile(input: RenderInput, palette: Palette): Promise<Blob | undefined> {
  const px = Math.max(1, Math.round(input.size * input.dpr));
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(px, px);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    renderTile(ctx as unknown as Ctx2D, input, palette);
    return canvas.convertToBlob({ type: 'image/png' });
  }
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  renderTile(ctx as unknown as Ctx2D, input, palette);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/png'));
}
