# feat/tools-diff-regex – for the next chat:
- Two tools, both off by default: `tools/diff` (T F), `tools/regex` (T E). Decisions: `docs/decisions/tools.md`.
- Regex runs in `tools/regex/worker.ts` via `run.ts` (`startRun` takes a worker factory, so tests use a fake worker and a real `worker_threads` thread with `(a+)+$`). Tauri CSP already has `worker-src 'self' blob:`; not hand-tested in the Windows WebView2 / Android WebView (module workers) – worth a glance on a real device.
- Open: no "rough" threshold tuning on slow phones (4 M cells ≈ 16 MB table); lower `MAX_CELLS` in `diff/logic.ts` if it feels slow.
- Not done on purpose: saving patterns, other regex flavours, home widget.
