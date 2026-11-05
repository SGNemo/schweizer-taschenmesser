import type { ReactNode } from 'react';
import type { SignatureId } from '@/core/modules/types';

/**
 * The mark of every signature (identity v3.1, size `S`): one line drawing per id on a 24 × 24 grid, stroked
 * in `currentColor`, so it works without colour ("Ruhig"), in both themes and at any size. Decoration only
 * (`aria-hidden`): numbers and words stay text next to it. Modules and tools share this one library.
 */
export const SIGNATURE_MARKS: Record<Exclude<SignatureId, 'none'>, ReactNode> = {
  /* ---- modules ---- */
  // Sun with a cloud in front.
  sky: (
    <>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M9 2.5V4M9 14v1.5M2.5 9H4M14 9h1.5M4.4 4.4l1.1 1.1M13.6 4.4l-1.1 1.1" />
      <path d="M11 20h7.5a2.5 2.5 0 0 0 .4-4.97A4 4 0 0 0 11.3 13.5 3.25 3.25 0 0 0 11 20z" />
    </>
  ),
  // A square cover with a record inside.
  coverTone: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // A card with its stripe.
  bankCard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18M7 14.5h4" />
    </>
  ),
  // A progress ring, three quarters full.
  ring: (
    <>
      <circle cx="12" cy="12" r="8" opacity=".35" />
      <path d="M12 4a8 8 0 0 1 8 8 8 8 0 0 1-8 8" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  calendarLeaf: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8 3v4M16 3v4" />
      <path d="M9 14.5h2" />
    </>
  ),
  // The hours of a day as a strip, one block filled.
  hourStrip: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M7.5 8v8M16.5 8v8M3 12h18" opacity=".5" />
      <rect x="9" y="9.5" width="5" height="5" rx=".6" fill="currentColor" stroke="none" />
    </>
  ),
  // A card with one tick.
  todayCard: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </>
  ),
  // A till receipt with a torn edge.
  receipt: (
    <>
      <path d="M6 3h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20z" />
      <path d="M9 8h6M9 11.5h6M9 15h3" />
    </>
  ),
  // An invoice: lines of text and the amount box.
  bill: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 11.5h5" />
      <rect x="12.5" y="14" width="4.5" height="3" rx=".6" />
    </>
  ),
  // Two arcs that chase each other: a cycle.
  cycle: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 13-5.2" />
      <path d="M19.5 12a7.5 7.5 0 0 1-13 5.2" />
      <path d="M17.5 3.5v3.3h-3.3M6.5 20.5v-3.3h3.3" />
    </>
  ),
  envelope: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </>
  ),
  // Three things standing on a shelf.
  shelf: (
    <>
      <path d="M3 18.5h18" />
      <rect x="5" y="10" width="4" height="8.5" />
      <rect x="10" y="6.5" width="4" height="12" />
      <rect x="15" y="12" width="4" height="6.5" />
    </>
  ),
  // A person inside a ring.
  avatarRing: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M7.5 17.5c1-2.2 2.6-3.3 4.5-3.3s3.5 1.1 4.5 3.3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2" />
    </>
  ),
  // A board with two pinned notes.
  pinboard: (
    <>
      <rect x="3" y="4" width="18" height="15" rx="2" />
      <rect x="6" y="7.5" width="5" height="6" />
      <rect x="13" y="9" width="5" height="6" />
      <circle cx="8.5" cy="7.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  notePaper: (
    <>
      <path d="M5 4.5h14v10l-5 5H5z" />
      <path d="M14 19.5v-5h5M8 9h8M8 12.5h5" />
    </>
  ),
  bubble: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />
      <path d="M8 8.5h8M8 12h5" />
    </>
  ),
  // An address bar with the lock.
  addressBar: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="4" />
      <rect x="6" y="11.2" width="3.2" height="2.6" rx=".5" />
      <path d="M6.7 11.2v-1a.9.9 0 0 1 1.8 0v1M12 12h6" />
    </>
  ),
  // A stamp: perforated edge, a frame inside.
  stamp: (
    <>
      <path d="M5 5h14v14H5z" strokeDasharray="1.6 1.6" />
      <rect x="8" y="8" width="8" height="8" />
    </>
  ),
  // A newspaper masthead over two columns.
  masthead: (
    <>
      <path d="M3 5.5h18" strokeWidth="2.5" />
      <path d="M3 9h18" />
      <path d="M3 12.5h8M3 16h8M3 19.5h8M14 12.5h7M14 16h7M14 19.5h4" />
    </>
  ),
  // A folder with its tab.
  folderTab: (
    <>
      <path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-7l-2-2.5H5a2 2 0 0 0-2 2z" />
      <path d="M3 11.5h18" />
    </>
  ),
  // A door with a dial.
  vaultDoor: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5V10M12 14v1.5M8.5 12H10M14 12h1.5" />
    </>
  ),
  // A gauge with its needle.
  gauges: (
    <>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M12 16l3.5-5" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
      <path d="M4 19.5h16" />
    </>
  ),
  // An arrow band, the first part filled.
  arrowProgress: (
    <>
      <path d="M3 9h12l4 3-4 3H3z" />
      <path d="M3 12h7" strokeWidth="2.5" />
    </>
  ),
  /* ---- tools ---- */
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

/** The mark of a signature at `size` px (`none` draws nothing). */
export function SignatureMark({ id, size = 28 }: { id: SignatureId; size?: number }) {
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
      {SIGNATURE_MARKS[id]}
    </svg>
  );
}
