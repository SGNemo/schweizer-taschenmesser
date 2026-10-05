import { useMemo, type ReactNode } from 'react';
import { ReadAidContext, type ReadAidConfig } from '@/core/text/ReadableText';
import { useUiStore } from '@/stores/ui';

/** Feeds the reading-aid settings to every `ReadableText` below (one subscription instead of one per text). */
export function ReadAidProvider({ children }: { children: ReactNode }) {
  const on = useUiStore((s) => s.readAid);
  const cover = useUiStore((s) => s.readCover);
  const share = useUiStore((s) => s.readShare);
  const value = useMemo<ReadAidConfig>(
    () => ({
      cover: on ? (Number(cover) as 25 | 50 | 75 | 100) : 0,
      share: Number(share) / 100,
      blocked: false,
    }),
    [on, cover, share],
  );
  return <ReadAidContext.Provider value={value}>{children}</ReadAidContext.Provider>;
}
