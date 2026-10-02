/**
 * Styles of the overlay (inside its closed shadow root). The values mirror the Nemo tokens in
 * `web/src/ui/tokens.css` (flat surfaces, borders, one accent for the primary action); the page's
 * own CSS cannot reach into the shadow root and `all: initial` stops inheritance from the page.
 */
export const OVERLAY_CSS = `
:host { all: initial; }
.root {
  --bg: #fbf8f3; --surface: #ffffff; --surface-2: #f3efe8; --border: #e6e1d8; --border-strong: #788489;
  --text: #13262f; --muted: #51616a; --accent: #b5430c; --accent-contrast: #ffffff; --accent-soft: #fdebdd;
  --danger: #b3261e; --success: #1b7545; --focus: #0b6f72;
  font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--text);
}
@media (prefers-color-scheme: dark) {
  .root {
    --bg: #0b1d2b; --surface: #132b3a; --surface-2: #1a3747; --border: #26485b; --border-strong: #71919e;
    --text: #e7f1f2; --muted: #9fb6bc; --accent: #ff9a57; --accent-contrast: #1b0f06; --accent-soft: #3a2a22;
    --danger: #f4a39c; --success: #74d39c; --focus: #4fd1c5;
  }
}
.panel {
  position: fixed; z-index: 2147483647; box-sizing: border-box; width: min(340px, calc(100vw - 16px));
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.22), 0 2px 6px rgb(0 0 0 / 0.1); display: grid; gap: 8px;
}
.panel * { box-sizing: border-box; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; }
.muted { color: var(--muted); font-size: 12px; margin: 0; }
.value {
  font: 14px ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; word-break: break-all;
  padding: 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; user-select: all;
}
.bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
.bar i { height: 4px; border-radius: 2px; background: var(--border); }
.bar i.on { background: var(--accent); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
button, input[type='text'] { font: inherit; color: inherit; }
button {
  min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border-strong);
  background: var(--surface); cursor: pointer;
}
button:hover { background: var(--surface-2); }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); font-weight: 600; }
button.primary:hover { filter: brightness(0.95); }
button.ghost { border-color: transparent; background: transparent; color: var(--accent); }
button.icon { min-width: 40px; padding: 0 8px; }
button:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; }
label { display: grid; gap: 2px; font-size: 12px; color: var(--muted); }
input[type='text'] {
  min-height: 40px; padding: 0 10px; background: var(--surface); color: var(--text);
  border: 1px solid var(--border-strong); border-radius: 10px; width: 100%;
}
input[type='range'] { width: 100%; accent-color: var(--accent); }
details { border-top: 1px solid var(--border); padding-top: 6px; }
summary { cursor: pointer; font-size: 13px; }
.checks { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 6px; }
.checks label { display: flex; gap: 6px; align-items: center; color: var(--text); font-size: 13px; }
.status { margin: 0; font-size: 13px; }
.status.err { color: var(--danger); }
.status.ok { color: var(--success); }
ul.entries { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
ul.entries button { width: 100%; text-align: left; display: grid; padding: 6px 10px; line-height: 1.3; }
ul.entries small { color: var(--muted); }
.key {
  position: fixed; z-index: 2147483647; width: 28px; height: 28px; min-height: 28px; padding: 0;
  border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface); font-size: 14px;
  display: grid; place-items: center;
}
@media (prefers-reduced-motion: no-preference) {
  .panel { animation: in 160ms cubic-bezier(0.22, 1, 0.36, 1); }
  @keyframes in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
}
`;
