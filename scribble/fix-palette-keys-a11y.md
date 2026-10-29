# fix/palette-keys-a11y – for the next chat:
- `Keys` has a `decorative` prop (aria-hidden); use it wherever key caps sit inside a named control.
- `orderFKeys` in `layout/ShortcutSheet.tsx` places a voice key `F<n>` by number; other voice keys stay last.
