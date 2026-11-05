import styles from './Stopwatch.module.css';

const R = 26;
const ARC = 0.75; // three quarters of the dial, open at the bottom
const LEN = 2 * Math.PI * R;

/**
 * A stopwatch dial (Zeiterfassung, C25): a round face with the crown on top and a three-quarter arc that fills with
 * `fill` (0..1, the share of a working day already tracked). `running` adds the hand at the arc's end. Its own round
 * shape, so the time-tracking head never reads as the calendar's hour strip. Decoration only (`aria-hidden`); the
 * figure next to it says the time in words.
 */
export function Stopwatch({ fill = 0, running }: { fill?: number; running?: boolean }) {
  const v = Math.max(0, Math.min(1, fill));
  const track = LEN * ARC;
  // The arc starts at 7:30 on the dial (225°) and runs clockwise.
  const angle = ((225 + 270 * v) * Math.PI) / 180;
  const hand = { x: 32 + Math.sin(angle) * (R - 8), y: 36 - Math.cos(angle) * (R - 8) };
  return (
    <div
      className={styles.watch}
      data-signature="stopwatch"
      data-running={running ? 'true' : undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 68">
        <rect x="28" y="1" width="8" height="5" rx="1.5" className={styles.crown} />
        <circle cx="32" cy="36" r={R + 4} className={styles.face} />
        <circle
          cx="32"
          cy="36"
          r={R}
          className={styles.track}
          strokeDasharray={`${track} ${LEN}`}
          transform="rotate(135 32 36)"
        />
        <circle
          cx="32"
          cy="36"
          r={R}
          className={styles.fill}
          strokeDasharray={`${track * v} ${LEN}`}
          transform="rotate(135 32 36)"
        />
        {running ? <line x1="32" y1="36" x2={hand.x} y2={hand.y} className={styles.hand} /> : null}
        <circle cx="32" cy="36" r="2.5" className={styles.pin} />
      </svg>
    </div>
  );
}
