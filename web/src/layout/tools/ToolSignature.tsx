import type { ToolSignatureId } from '@/core/tools/types';

/**
 * The small mark in a tool's head: decoration only (`aria-hidden`), drawn in `currentColor`, so it
 * works without colour ("Ruhig") and in both themes. Numbers and words stay text elsewhere.
 */
const SHAPES: Record<Exclude<ToolSignatureId, 'none'>, React.ReactNode> = {
  // Calculator display with a result line and a key row.
  display: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <rect x="6" y="6" width="12" height="4" rx="1" />
      <path d="M7 14h2M11 14h2M15 14h2M7 17.5h2M11 17.5h2M15 17.5h2" />
    </>
  ),
  // Two amounts and an arrow between them.
  flow: (
    <>
      <rect x="2.5" y="6" width="7" height="12" rx="2" />
      <rect x="14.5" y="6" width="7" height="12" rx="2" />
      <path d="M10.5 12h3m-1.5-1.5L13.5 12 12 13.5" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendarLeaf: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8 3v4M16 3v4" />
      <path d="M9 14.5h2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c3 3.2 3 13.8 0 17M12 3.5c-3 3.2-3 13.8 0 17" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  qrFrame: (
    <>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      <rect x="8" y="8" width="3" height="3" />
      <rect x="13" y="8" width="3" height="3" />
      <rect x="8" y="13" width="3" height="3" />
      <path d="M13.5 14.5h2.5" />
    </>
  ),
  // An ID-card shape; the avatar is a plain circle, no data in it.
  idCard: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14.5 10h3.5M14.5 13h3" />
    </>
  ),
  notePaper: (
    <>
      <path d="M5 4.5h14v10l-5 5H5z" />
      <path d="M14 19.5v-5h5M8 9h8M8 12.5h5" />
    </>
  ),
  photoFrame: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
    </>
  ),
  pageStack: (
    <>
      <path d="M8 3.5h6l4 4V17a1.5 1.5 0 0 1-1.5 1.5h-8.5A1.5 1.5 0 0 1 6.5 17V5A1.5 1.5 0 0 1 8 3.5z" />
      <path d="M14 3.5V8h4M4 7v12.5A1.5 1.5 0 0 0 5.5 21H15" />
    </>
  ),
  viewfinder: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m7 10 3 2.5L7 15M12.5 15H17" />
    </>
  ),
  splitPage: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M12 4.5v15M6 9h3M6 12h3M15 9h3M15 15h3" />
    </>
  ),
  pattern: (
    <>
      <path d="M5 8c0-2.5 3-3.5 5-2M5 16c0 2.5 3 3.5 5 2" />
      <path d="M13 8c0-2.5 3-3.5 5-2M13 16c0 2.5 3 3.5 5 2" />
      <circle cx="19.5" cy="12" r=".8" />
    </>
  ),
};

export function ToolSignature({ id, size = 28 }: { id: ToolSignatureId; size?: number }) {
  if (id === 'none') return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-signature={id}
    >
      {SHAPES[id]}
    </svg>
  );
}
