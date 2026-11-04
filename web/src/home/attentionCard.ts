import { allManifests } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';

/**
 * Splits a leading count off an attention title ("2 Rechnungen überfällig" → `2` + "Rechnungen überfällig") so the card can
 * show it as the big figure. Titles without a count (a budget name, an update) stay one line; user text that merely starts with a
 * number ("2. Training") is not split: the number must be followed by a space and a word.
 */
export function splitFigure(title: string): { figure?: string; label: string } {
  const m = /^(\d{1,4}(?:[.,]\d+)?)\s+(\p{L}.*)$/u.exec(title);
  return m ? { figure: m[1]!, label: m[2]! } : { label: title };
}

/** The module an attention route belongs to (its first path segment is the module id); core items have none. */
export function moduleOfPath(to: string): ModuleManifest | undefined {
  const id = /^\/([^/?#]+)/.exec(to)?.[1];
  return id ? allManifests.find((m) => m.id === id) : undefined;
}
