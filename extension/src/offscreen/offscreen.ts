/** Offscreen document: the only place that touches the clipboard (copy, then clear after 30 s). */
import { createSecretClipboard, type ClipboardAdapter } from '../lib/clipboard';
import { offscreenCommandSchema } from '../lib/messages';

function withTextarea<T>(fn: (area: HTMLTextAreaElement) => T): T {
  const area = document.createElement('textarea');
  document.body.append(area);
  try {
    return fn(area);
  } finally {
    area.remove();
  }
}

const adapter: ClipboardAdapter = {
  async write(text) {
    withTextarea((area) => {
      area.value = text;
      area.select();
      document.execCommand('copy');
    });
  },
  async read() {
    // `clipboardRead` lets the extension paste into its own textarea without a page in the way.
    return withTextarea((area) => {
      area.focus();
      return document.execCommand('paste') ? area.value : null;
    });
  },
};

const clipboard = createSecretClipboard(adapter);

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  const parsed = offscreenCommandSchema.safeParse(message);
  if (parsed.success) void clipboard.copy(parsed.data.text);
});
