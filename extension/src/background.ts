/** Service worker: wires chrome.* to the tested logic in `lib/background.ts`. Keeps nothing on disk. */
import { HOST_NAME } from '@nemo/vault-core';
import { createBackground, type Sender } from './lib/background';
import { createBridgeClient, type PortLike } from './lib/bridgeClient';
import { requestSchema, type OffscreenCommand } from './lib/messages';

const client = createBridgeClient({
  connect: () => chrome.runtime.connectNative(HOST_NAME) as unknown as PortLike,
  origin: `chrome-extension://${chrome.runtime.id}/`,
});

async function ensureOffscreen(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: 'Copy a secret to the clipboard and clear it again after 30 seconds.',
  });
}

const background = createBackground({
  client,
  now: () => Date.now(),
  async copySecret(text) {
    await ensureOffscreen();
    const command: OffscreenCommand = { target: 'offscreen', cmd: 'copy', text };
    await chrome.runtime.sendMessage(command);
  },
  async activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id === undefined ? undefined : { id: tab.id, url: tab.url };
  },
  async sendToTab(tabId, frameId, command) {
    await chrome.tabs.sendMessage(tabId, command, { frameId });
  },
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if ((message as { target?: string } | null)?.target === 'offscreen') return false;
  const parsed = requestSchema.safeParse(message);
  // Extension pages (the popup) are recognised by their own URL; a tab-less sender is not enough,
  // because the popup can also be opened as a tab. Content scripts always carry the page's URL.
  const fromExtensionPage = sender.url?.startsWith(chrome.runtime.getURL('')) === true;
  const popupOnly = parsed.success && parsed.data.type.startsWith('popup-');
  const shared = parsed.success && ['status', 'generate'].includes(parsed.data.type);
  if (
    !parsed.success ||
    (popupOnly && !fromExtensionPage) ||
    (!popupOnly && !shared && fromExtensionPage)
  ) {
    sendResponse({ ok: false, error: 'bad-request' });
    return false;
  }
  const from: Sender = {
    tabId: sender.tab?.id,
    frameId: sender.frameId,
    origin: sender.origin,
    url: sender.url ?? sender.tab?.url,
  };
  background
    .handle(parsed.data, from)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, error: 'failed' }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => background.tabClosed(tabId));
