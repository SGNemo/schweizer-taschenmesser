# feat/identity-v3-disk – for the next chat (identity v3.1 package 3, PR open)

- **Head** `modules/disk/components/DiskHead.tsx`: figure = used space of the system drive (`headDrive`), state word on a `Badge`, rings per drive in slot M (`aria-hidden`, decoration like every signature block), library `Gauges` before the first reading. Drives are read once for head + tab (`useDriveList` in `routes/DrivesPage.tsx`).
- **Treemap palette** `components/Palette.module.css` is tokens only; canvas + legend go through `resolveColors` (`logic/colors.ts`, probe element → `#rrggbb`). Never use `--viz-1` or `--module-color` there: `[data-hue]` rebinds them to the module hue (slate) – pinned in `__tests__/palette.test.ts`.
- For `fix/disk-scan-live` follow-ups: the pending outline still uses `p.muted` (`--text-muted`); folding `t.disk.scan.pendingLegend` into `Legend.tsx` was not done (out of scope).
- Not done, small: the scan route `/disk/scan` still shows the frame's default `Gauges` in the head; the drive card's "Systemlaufwerk" badge is `tone="accent"` (C01 says accent is not identity).
- `ui/tokens.test.ts` head-ink guard now lists `downloads/components/DownloadsBand.module.css` and `disk/components/DiskHead.module.css`.
