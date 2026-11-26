import { litPath, MARIA, tiltRotation } from './drawV1';

export interface MoonGlyphProps {
  /** Lit fraction 0…1. */
  illum: number;
  size: number;
  /**
   * `mono`: the shape in `currentColor` (lit = filled, dark = a thin ring) for a day row or a chip; otherwise the
   * moon's own colours with maria.
   */
  mono?: boolean;
  /** The real direction of the lit side (deg, + = left of up, `core/sky` `crescentTilt`); without it the glyph is
   * upright: lit on the right while waxing north of the equator, on the left south of it (CONCEPT-MOON §4). */
  tilt?: number;
  waxing?: boolean;
  south?: boolean;
}

/** The moon's phase shape alone, 16–64 px; decoration (`aria-hidden`): its words stand beside it. */
export function MoonGlyph({
  illum,
  size,
  mono = false,
  tilt,
  waxing = true,
  south = false,
}: MoonGlyphProps) {
  const r = 10;
  const lit = litPath(r, illum);
  // upright: the lit-right shape, mirrored when the lit side is on the left
  const rotate =
    tilt != null ? `rotate(${tiltRotation(tilt)})` : waxing !== south ? '' : 'scale(-1 1)';
  const clipId = `mg${Math.round(illum * 1000)}${size}${mono ? 'm' : 'c'}`;
  return (
    <svg
      viewBox="-11 -11 22 22"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-testid="moon-glyph"
      data-illum={Math.round(illum * 100)}
    >
      <g transform={rotate || undefined}>
        {mono ? (
          <>
            <circle
              r={r - 0.5}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={lit ? 0.6 : 1}
            />
            {lit ? <path d={lit} fill="currentColor" /> : null}
          </>
        ) : (
          <>
            <circle r={r} fill="var(--scene-moon-dark)" opacity={0.55} />
            {lit ? (
              <>
                <path d={lit} fill="var(--scene-moon)" />
                {size >= 24 ? (
                  <>
                    <clipPath id={clipId}>
                      <path d={lit} />
                    </clipPath>
                    <g clipPath={`url(#${clipId})`} fill="var(--scene-moon-mare)">
                      {MARIA.map((q, i) => (
                        <ellipse
                          key={i}
                          cx={q[0] * r}
                          cy={q[1] * r}
                          rx={q[2] * r}
                          ry={q[3] * r}
                          transform={`rotate(${q[4]} ${q[0] * r} ${q[1] * r})`}
                        />
                      ))}
                    </g>
                  </>
                ) : null}
              </>
            ) : (
              <circle r={r - 0.5} fill="none" stroke="var(--scene-moon-dark)" strokeWidth={1} />
            )}
          </>
        )}
      </g>
    </svg>
  );
}
