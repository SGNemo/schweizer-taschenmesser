/** Small helpers the tools share. */
import { evaluate, CalcError } from '@/core/calc/expr';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';

const two = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 1234.5 → "1.234,50" */
export const fmt2 = (n: number): string => two.format(n);

const many = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
export const fmt = (n: number): string => many.format(n);

/** "12,5" / "1.234,56" / "12.5" → number, undefined when it is not a number (expressions are fine). */
export function num(text: string): number | undefined {
  if (!text.trim()) return undefined;
  try {
    return evaluate(text);
  } catch (e) {
    if (e instanceof CalcError) return undefined;
    throw e;
  }
}

/** Best effort clipboard copy; never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Safe wrappers: storage can be blocked. */
export function readStored(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}
export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; the tool still works for this session.
  }
}

/** Copies and confirms with a toast (German text lives with the calculator strings). */
export async function copyWithToast(text: string): Promise<void> {
  const ok = await copyText(text);
  if (ok) useUiStore.getState().toast(t.tools.calc.copied);
}
