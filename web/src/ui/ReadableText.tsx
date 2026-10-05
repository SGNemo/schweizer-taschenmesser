import { useMemo } from 'react';
import { emphasize } from '@/core/text/readable';
import { useUiStore } from '@/stores/ui';

/**
 * Prose or list text with the reading aid (Einstellungen → Darstellung → Lesen): the start of each word
 * is marked with `data-rs` (weight/contrast from tokens.css). Renders the plain string when the aid is off,
 * so nothing changes for users who do not use it. The text stays one flow of inline spans: no roles, no
 * `<b>`/`<strong>`, so screen readers read it as ordinary text.
 *
 * Use for running text (`kind="prose"`: notes, answers, help) and list titles/teasers (`kind="list"`, only with
 * the "auch Listen" scope). Never for inputs, numbers, code, buttons, navigation or vault/account secrets.
 */
export function ReadableText({ text, kind = 'prose' }: { text: string; kind?: 'prose' | 'list' }) {
  const share = useReadShare(kind);
  const runs = useMemo(
    () => (share === null ? null : emphasize(text, { share: Number(share) / 100 })),
    [text, share],
  );
  if (!runs) return <>{text}</>;
  return (
    <>
      {runs.map((r, i) =>
        r.strong ? (
          <span key={i} data-rs="">
            {r.text}
          </span>
        ) : (
          r.text
        ),
      )}
    </>
  );
}

/** The share to use for this kind of text, or `null` while the aid is off (or the scope excludes it). */
export function useReadShare(kind: 'prose' | 'list'): string | null {
  return useUiStore((s) =>
    s.readAid && (kind === 'prose' || s.readScope === 'lists') ? s.readShare : null,
  );
}
