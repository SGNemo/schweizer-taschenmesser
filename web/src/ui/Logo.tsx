import { useId } from 'react';

/**
 * The Nemo fish (source of truth: `web/brand/logo-mark.svg`, keep both in step). Decorative by
 * default; pass `title` where the logo is the only label.
 */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const clip = useId();
  return (
    <svg
      viewBox="24 96 456 304"
      height={size}
      width={Math.round((size * 456) / 304)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <ellipse cx="296" cy="262" rx="172" ry="126" />
        </clipPath>
      </defs>
      <path d="M236 150c14-40 60-58 104-40 12 5 12 20 2 28l-24 18z" fill="#F26A1E" />
      <path
        d="M170 262C136 220 98 188 58 176c-14-4-24 8-20 22l18 64-18 64c-4 14 6 26 20 22 40-12 78-44 112-86z"
        fill="#F26A1E"
      />
      <ellipse cx="296" cy="262" rx="172" ry="126" fill="#F57A2A" />
      <g clipPath={`url(#${clip})`} fill="#fff">
        <rect x="338" y="100" width="46" height="330" rx="23" />
        <rect x="214" y="100" width="50" height="330" rx="25" />
      </g>
      <circle cx="420" cy="238" r="18" fill="#12303A" />
    </svg>
  );
}
