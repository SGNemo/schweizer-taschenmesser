/**
 * The habits motif for the shared `EmptyState`: a row of four day boxes, three ticked, the fourth still open –
 * "the same thing, day after day". Drawn like the signature marks (stroke 1.5 on a 24-unit height, round caps,
 * `currentColor`), so it sits next to the other motifs at 64 px height. It replaced three dashed rings, which
 * read as a loading spinner (UI audit 2026-11, follow-up 13). Decoration only.
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
      {[3.5, 14, 24.5, 35].map((x, i) => (
        <g key={x}>
          <rect x={x} y="7" width="9.5" height="9.5" rx="2" />
          {i < 3 ? <path d={`m${x + 2.5} 11.9 1.8 1.8 3-3.4`} /> : null}
        </g>
      ))}
    </svg>
  );
}
