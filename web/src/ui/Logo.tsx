import { useId } from 'react';

/**
 * The Nemo fish ("Welle"). Source of truth: `web/brand/logo-mark.svg`; the splash in
 * `web/index.html` repeats the same paths (`brand-sync.test.ts` keeps the three in step).
 * Decorative by default; pass `title` where the logo is the only label. `mono` draws it in the
 * current text colour (empty states, monochrome contexts).
 */
export const LOGO_PATHS = {
  body: 'M168 256c0-76 80-128 176-128 64 0 120 58 120 128s-56 128-120 128c-96 0-176-52-176-128z',
  tail: 'M184 256 100 182c-20-17-46 4-34 28l20 46-20 46c-12 24 14 45 34 28z',
  cut1: 'M262 118c-34 40-34 236 0 276',
  cut2: 'M364 152c-22 30-22 178 0 208',
} as const;
/** Bounding box of the fish inside the 512 canvas (tail tip to nose). */
export const LOGO_VIEWBOX = '60 120 410 272';

export function Logo({
  size = 32,
  title,
  mono = false,
}: {
  size?: number;
  title?: string;
  mono?: boolean;
}) {
  const cut = useId();
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      height={size}
      width={Math.round((size * 410) / 272)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="#fff" />
          <g fill="none" stroke="#000" strokeLinecap="round">
            <path d={LOGO_PATHS.cut1} strokeWidth="42" />
            <path d={LOGO_PATHS.cut2} strokeWidth="34" />
          </g>
          <circle cx="420" cy="230" r="15" fill="#000" />
        </mask>
      </defs>
      <g fill={mono ? 'currentColor' : '#F26A1E'} mask={`url(#${cut})`}>
        <path d={LOGO_PATHS.body} />
        <path d={LOGO_PATHS.tail} />
      </g>
    </svg>
  );
}
