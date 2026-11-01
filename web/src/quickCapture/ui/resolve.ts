import type { CaptureFields, CaptureResult, CaptureType } from '../parser';

export interface ResolveOptions {
  /** Types whose module is on (`availableTypes`). */
  available: readonly CaptureType[];
  /** The user picked a type by hand. */
  override?: CaptureType;
  /** "Ohne Rückfrage speichern": unclear text goes to the default target as typed. */
  noQuestion: boolean;
  defaultType?: CaptureType;
}

export interface Resolved {
  /** Where it will be saved; undefined = the user has to choose. */
  type?: CaptureType;
  fields: CaptureFields;
  /** True when unclear text falls back to the default target (the ToDo inbox) as typed. */
  inbox: boolean;
}

/**
 * Which target a parsed entry goes to. Shared by the single field and every line of a multi-line
 * capture, so a line is decided exactly like the same text typed alone.
 */
export function resolveTarget(text: string, result: CaptureResult, o: ResolveOptions): Resolved {
  const wanted = o.override ?? (result.needsChoice ? undefined : result.type);
  const chosen = wanted && o.available.includes(wanted) ? wanted : undefined;
  const preferred = o.defaultType ?? 'todo';
  const fallback =
    !chosen && o.noQuestion && text.trim() && o.available.length > 0
      ? o.available.includes(preferred)
        ? preferred
        : o.available[0]
      : undefined;
  return {
    type: chosen ?? fallback,
    fields: fallback ? { ...result.fields, title: text.trim() } : result.fields,
    inbox: !!fallback,
  };
}
