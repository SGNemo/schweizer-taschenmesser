import type { ReactNode } from 'react';

/**
 * The 16 px line glyphs of the sky events (mockups/10-karte.html): eclipse, lunar eclipse, rainbow, meteors, solstice,
 * dust and the star night. Decorative: the words beside them say the event (`aria-hidden`), stroke `currentColor`.
 */
export type EventGlyphName =
  'eclipse' | 'lunar' | 'rainbow' | 'meteor' | 'solstice' | 'dust' | 'stars';

const PATHS: Record<EventGlyphName, ReactNode> = {
  eclipse: (
    <>
      <circle cx="7" cy="9" r="5" />
      <circle cx="10.2" cy="5.8" r="4" fill="currentColor" stroke="none" />
    </>
  ),
  lunar: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.1 4.1a5.5 5.5 0 0 0 7.8 7.8z" fill="currentColor" />
    </>
  ),
  rainbow: (
    <>
      <path d="M1.5 12.5a6.5 6.5 0 0 1 13 0" />
      <path d="M4 12.5a4 4 0 0 1 8 0" />
    </>
  ),
  meteor: (
    <>
      <path d="M13.5 2.5L6 10" />
      <path d="M11 2.5L7.5 6" />
      <circle cx="4.5" cy="11.5" r="1.8" fill="currentColor" />
    </>
  ),
  solstice: (
    <>
      <path d="M1.5 12.5h13" />
      <path d="M3 12.5a5 3.5 0 0 1 10 0" strokeDasharray="1.6 1.8" />
      <circle cx="11.4" cy="10.4" r="1.6" fill="currentColor" />
    </>
  ),
  dust: (
    <>
      <path d="M2 5h8M4 8h10M2 11h7" />
      <circle cx="12.5" cy="5" r=".6" fill="currentColor" />
      <circle cx="11" cy="11" r=".6" fill="currentColor" />
    </>
  ),
  stars: (
    <g fill="currentColor" stroke="none">
      <path d="M8 2l.9 2.6L11.5 5.5 8.9 6.4 8 9l-.9-2.6L4.5 5.5l2.6-.9z" />
      <circle cx="12.5" cy="11" r="1" />
      <circle cx="4" cy="12" r=".8" />
    </g>
  ),
};

export function EventGlyph({ name, size = 16 }: { name: EventGlyphName; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-testid="event-glyph"
      data-glyph={name}
    >
      {PATHS[name]}
    </svg>
  );
}
