import type { ReactNode } from 'react';
import type { Pattern } from '../catalog';
import styles from '../fitness.module.css';

/**
 * A small line drawing per movement pattern (package 4): 24-grid, stroked in `currentColor`, so it works
 * in both themes and without colour. Decoration only (`aria-hidden`): the exercise name next to it is the text.
 */
const DRAWINGS: Record<Pattern, ReactNode> = {
  // Lying on the bench, the bar pressed up.
  press: (
    <>
      <path d="M3 18h15" />
      <path d="M6 16h9" />
      <circle cx="17.5" cy="15" r="1.6" />
      <path d="M8.5 16V9.5M12.5 16V9.5" />
      <path d="M5 9.5h11M5 8v3M16 8v3" />
    </>
  ),
  // Standing, the bar over the head.
  overhead: (
    <>
      <circle cx="12" cy="6.5" r="1.6" />
      <path d="M12 8.5v6.5M12 15l-2.5 5.5M12 15l2.5 5.5" />
      <path d="M12 10l-3.5-5M12 10l3.5-5" />
      <path d="M5.5 5h13M5.5 3.5v3M18.5 3.5v3" />
    </>
  ),
  // Bent over, pulling the weight to the body.
  row: (
    <>
      <circle cx="6.5" cy="7.5" r="1.6" />
      <path d="M8 8.5l6.5 2.5" />
      <path d="M14.5 11l-1 4.5 1 4.5M14.5 11l3 9" />
      <path d="M10.5 9.8v4.7" />
      <path d="M8 14.5h5" />
    </>
  ),
  // Hanging from the bar.
  pullup: (
    <>
      <path d="M4 3.5h16" />
      <path d="M8.5 3.5l2.2 4.3M15.5 3.5l-2.2 4.3" />
      <circle cx="12" cy="9.7" r="1.6" />
      <path d="M12 11.7v5.3M12 17l-2 3.5M12 17l2 3.5" />
    </>
  ),
  // Down in the squat, the bar on the shoulders.
  squat: (
    <>
      <path d="M5 7h14M5 5.5v3M19 5.5v3" />
      <circle cx="12" cy="4.3" r="1.5" />
      <path d="M12 7v5.5" />
      <path d="M12 12.5l-4 2.3 1.5 5.2M12 12.5l4 2.3-1.5 5.2" />
    </>
  ),
  // Hip hinge, the bar at the shins.
  hinge: (
    <>
      <circle cx="7.5" cy="7" r="1.6" />
      <path d="M9 8l5.5 3.5" />
      <path d="M14.5 11.5v4l-1.5 4.5M14.5 15.5l1.5 4.5" />
      <path d="M10.5 9.5l-.5 6" />
      <path d="M5 16h10M5 14.5v3M15 14.5v3" />
    </>
  ),
  // One leg forward, the back knee down.
  lunge: (
    <>
      <circle cx="11" cy="4.5" r="1.6" />
      <path d="M11 6.5v6" />
      <path d="M11 12.5l4.5 1.5v6M11 12.5l-4 4.5-2.5 3" />
      <path d="M11 8.5l-2.5 3M11 8.5l2.5 3" />
    </>
  ),
  // Standing, the forearm curled up with a dumbbell.
  curl: (
    <>
      <circle cx="10" cy="4.5" r="1.6" />
      <path d="M10 6.5v8M10 14.5l-2 6M10 14.5l2 6" />
      <path d="M10 8.5v4l4.5-2.2" />
      <path d="M14 8.5v3.4M16 8.5v3.4M14 10.2h2" />
    </>
  ),
  // Plank on the floor.
  core: (
    <>
      <path d="M3 18.5h18" />
      <circle cx="18" cy="11.5" r="1.6" />
      <path d="M16.5 12.6L6 15.6l-2 2.9" />
      <path d="M15.5 13v5.5" />
    </>
  ),
  // Mid-stride.
  run: (
    <>
      <circle cx="14" cy="4.5" r="1.6" />
      <path d="M13.2 6.8l-2.7 6 3 2.6-1 5.1" />
      <path d="M10.5 12.8l-4 2.2" />
      <path d="M12.6 8.5l3.6 2.4M12.6 8.5l-3.6 1.6" />
    </>
  ),
  // A bike.
  bike: (
    <>
      <circle cx="6" cy="16.5" r="3.5" />
      <circle cx="18" cy="16.5" r="3.5" />
      <path d="M6 16.5l4-7h5l3 7M10 9.5l2 7h-6" />
      <path d="M14 7.5h2.5" />
    </>
  ),
  // Swimming over two waves.
  swim: (
    <>
      <circle cx="17" cy="8.5" r="1.6" />
      <path d="M4 11.5l5-2 4 1.5 3-1" />
      <path d="M3 15.5c2 0 2-1.5 4.5-1.5S10 15.5 12 15.5s2.5-1.5 4.5-1.5 2.5 1.5 4.5 1.5" />
      <path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19" />
    </>
  ),
  // Arms and legs open: a stretch.
  stretch: (
    <>
      <circle cx="12" cy="4.5" r="1.6" />
      <path d="M12 6.5v7" />
      <path d="M12 13.5l-5 6.5M12 13.5l5 6.5" />
      <path d="M12 8.5l-6.5-3M12 8.5l6.5-3" />
    </>
  ),
  // Anything else: the module's dumbbell.
  other: (
    <>
      <path d="M7 12h10" />
      <rect x="3.5" y="8" width="3.5" height="8" rx="1" />
      <rect x="17" y="8" width="3.5" height="8" rx="1" />
      <path d="M2 10.5v3M22 10.5v3" />
    </>
  ),
};

export function ExercisePicto({ pattern, size = 24 }: { pattern: Pattern; size?: number }) {
  return (
    <svg
      className={styles.picto}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-pattern={pattern}
    >
      {DRAWINGS[pattern]}
    </svg>
  );
}
