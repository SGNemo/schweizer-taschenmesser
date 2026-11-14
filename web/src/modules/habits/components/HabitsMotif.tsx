/**
 * The habits motif for the shared `EmptyState`: four separate day boxes, three ticked, the fourth one faint (still
 * open, not missed). Drawn like the signature marks (stroke 1.5 on a 24-unit height, `currentColor`). Decoration only.
 */
export function HabitsMotif() {
  return (
    <svg
      width={128}
      height={64}
      viewBox="0 0 48 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-motif="habits"
    >
      {[2, 13.5, 25, 36.5].map((x, i) =>
        i < 3 ? (
          <g key={x}>
            <rect x={x} y="8" width="8" height="8" rx="1.8" />
            <path d={`m${x + 2} 12.2 1.6 1.6 2.8-3.2`} />
          </g>
        ) : (
          <rect key={x} x={x} y="8" width="8" height="8" rx="1.8" opacity=".45" />
        ),
      )}
    </svg>
  );
}
