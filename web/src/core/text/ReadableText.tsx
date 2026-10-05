/** @jsxImportSource react */
// This file is the target of the reading-aid JSX runtime (readjsx/): it must use the plain React runtime itself.
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { emphasize } from './readable';

/** Coverage levels (percent): the aid is shown where the element's level is at most the chosen coverage. */
export type ReadLevel = 25 | 50 | 75 | 100;

export interface ReadAidConfig {
  /** Chosen coverage while the aid is on, 0 = off. */
  cover: 0 | ReadLevel;
  /** Share of each word that is emphasised (0.3 / 0.4 / 0.5). */
  share: number;
  /** Vault and accounts: nothing is emphasised below this point, not even by `force`. */
  blocked: boolean;
}

export const ReadAidContext = createContext<ReadAidConfig>({
  cover: 0,
  share: 0.4,
  blocked: false,
});

/** Wraps a subtree in which the aid never applies (vault, accounts): secrets and credential screens stay untouched. */
export function NoReadAid({ children }: { children: ReactNode }) {
  const cfg = useContext(ReadAidContext);
  const value = useMemo(() => ({ ...cfg, cover: 0 as const, blocked: true }), [cfg]);
  return <ReadAidContext.Provider value={value}>{children}</ReadAidContext.Provider>;
}

/**
 * Text with the reading aid (Einstellungen → Darstellung → Lesen): the start of each word is marked with `data-rs`
 * (weight and colour from tokens.css). Renders the plain string when the aid is off or the level is not covered, so
 * nothing changes for users who do not use it. The text stays one flow of inline spans without roles, `<b>` or
 * `<strong>`, so screen readers read it as ordinary text.
 *
 * Almost all app text reaches this component automatically through the JSX runtime (`readjsx/`), which wraps string
 * children of ordinary elements. Use it directly for text that is not a plain JSX child (list titles: `level={50}`).
 * Never for inputs, numbers, code or vault/account secrets (those hosts and modules are excluded).
 */
export function ReadableText({
  text,
  kind,
  level,
  tone = 'plain',
  heavy = false,
  force = false,
}: {
  text: string;
  /** Shorthand: `prose` = level 25, `list` = level 50. */
  kind?: 'prose' | 'list';
  level?: ReadLevel;
  /**
   * `ink`: headings and titles – if the text is in the primary colour, the rest of each word is dimmed a step so the
   * start stands out. `plain`: only the weight changes (AA stays safe).
   */
  tone?: 'ink' | 'plain';
  /** Headings and other already bold text: the emphasised start gets an extra heavy weight. */
  heavy?: boolean;
  /** Fokus-Lesen: the aid is on for this text whatever the setting says (still with the chosen share and style). */
  force?: boolean;
}) {
  const cfg = useContext(ReadAidContext);
  const need: ReadLevel = level ?? (kind === 'list' ? 50 : 25);
  const active = !cfg.blocked && (force || cfg.cover >= need);
  const runs = useMemo(
    () => (active ? emphasize(text, { share: cfg.share }) : null),
    [active, text, cfg.share],
  );
  // `ink`: dim the rest of the word only when the surrounding text really is in the primary text colour (a muted
  // heading keeps its colour, AA contrast stays safe). Headings are few, so measuring them is cheap.
  const probe = useRef<HTMLSpanElement>(null);
  const [primary, setPrimary] = useState(false);
  useLayoutEffect(() => {
    const host = probe.current?.parentElement;
    if (tone !== 'ink' || !runs || !host) return setPrimary(false);
    setPrimary(getComputedStyle(host).color === getComputedStyle(document.body).color);
  }, [tone, runs]);
  if (!runs) return <>{text}</>;
  const firstStrong = runs.findIndex((r) => r.strong);
  return (
    <>
      {runs.map((r, i) =>
        r.strong ? (
          <span key={i} data-rs={heavy ? 'h' : ''} ref={i === firstStrong ? probe : undefined}>
            {r.text}
          </span>
        ) : primary && r.rest ? (
          <span key={i} data-rr="">
            {r.text}
          </span>
        ) : (
          r.text
        ),
      )}
    </>
  );
}
