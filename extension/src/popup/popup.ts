/**
 * Popup: connection status, the entries of the current tab (search, fill, copy) and a plain
 * generator. No master password, no vault, no storage – everything comes live from the app.
 * Secrets never pass through here: fill and copy are done by the service worker.
 */
import { t } from '../strings';
import type { ConnectionState } from '../lib/bridgeClient';
import type { Generated, GenSettings } from '../lib/generate';
import type { Reply, Request } from '../lib/messages';
import { h } from '../content/dom';

interface Entry {
  id: string;
  title: string;
  username: string;
  url: string;
  hasTotp: boolean;
}
interface PopupState {
  state: ConnectionState;
  origin: string | null;
  entries: Entry[];
}

async function send<T>(request: Request): Promise<Reply<T>> {
  try {
    return (await chrome.runtime.sendMessage(request)) as Reply<T>;
  } catch {
    return { ok: false, error: 'app-missing' };
  }
}

const app = document.getElementById('app')!;
let generated: (Generated & { settings: GenSettings }) | undefined;
let query = '';

function statusLine(state: ConnectionState): HTMLElement {
  switch (state.state) {
    case 'unlocked':
      return h('p', { class: 'status ok', 'data-testid': 'popup-status' }, t.status.unlocked);
    case 'locked':
      return h('p', { class: 'status warn', 'data-testid': 'popup-status' }, t.status.locked);
    case 'pairing':
      return h(
        'p',
        { class: 'status warn', 'data-testid': 'popup-status' },
        t.status.pairing(state.pairCode),
      );
    case 'rejected':
      return h('p', { class: 'status warn', 'data-testid': 'popup-status' }, t.status.rejected);
    default:
      return h('p', { class: 'status warn', 'data-testid': 'popup-status' }, t.status.appMissing);
  }
}

function entryCard(entry: Entry, message: (text: string) => void): HTMLElement {
  const run = async (request: Request, done: string) => {
    const r = await send(request);
    message(r.ok ? done : t.errors.generic);
  };
  return h(
    'li',
    { class: 'card', 'data-testid': `popup-entry-${entry.id}` },
    h('div', {}, h('h2', {}, entry.title), h('p', { class: 'muted' }, entry.username)),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'primary',
          onclick: () => void run({ type: 'popup-fill', entryId: entry.id }, t.fill.filled),
        },
        t.popup.fill,
      ),
      h(
        'button',
        {
          onclick: () =>
            void run(
              { type: 'popup-copy', entryId: entry.id, field: 'username' },
              t.popup.copied('Benutzername'),
            ),
        },
        t.popup.copyUser,
      ),
      h(
        'button',
        {
          onclick: () =>
            void run(
              { type: 'popup-copy', entryId: entry.id, field: 'password' },
              t.popup.copied('Passwort'),
            ),
        },
        t.popup.copyPassword,
      ),
      entry.hasTotp
        ? h(
            'button',
            {
              onclick: () =>
                void run(
                  { type: 'popup-copy', entryId: entry.id, field: 'totp' },
                  t.popup.copied('Code'),
                ),
            },
            t.popup.copyCode,
          )
        : null,
    ),
  );
}

async function ensureGenerated(): Promise<void> {
  if (generated) return;
  const r = await send<Generated & { settings: GenSettings }>({ type: 'generate' });
  if (r.ok) generated = r.data;
}

async function render(state?: PopupState, note = ''): Promise<void> {
  let data = state;
  if (!data) {
    const r = await send<PopupState>({ type: 'popup-state' });
    data = r.ok ? r.data : undefined;
  }
  const status = data?.state ?? ({ state: 'app-missing' } as ConnectionState);
  await ensureGenerated();

  const message = h('p', { class: 'muted', role: 'status', 'data-testid': 'popup-message' }, note);
  const shown = (data?.entries ?? []).filter((e) =>
    `${e.title} ${e.username}`.toLowerCase().includes(query.toLowerCase()),
  );
  const search = h('input', {
    type: 'search',
    placeholder: t.popup.search,
    'aria-label': t.popup.search,
    value: query,
    oninput: (e) => {
      query = (e.target as HTMLInputElement).value;
      void render(data ? { ...data } : undefined, '');
    },
  });

  const parts: (Node | null)[] = [
    h('h1', {}, t.name),
    statusLine(status),
    status.state === 'unlocked'
      ? h(
          'section',
          { class: 'card' },
          data?.origin ? search : h('p', { class: 'muted' }, t.popup.noTab),
          data?.origin
            ? shown.length > 0
              ? h(
                  'ul',
                  {},
                  ...shown.map((e) =>
                    entryCard(e, (text) => {
                      message.textContent = text;
                    }),
                  ),
                )
              : h('p', { class: 'muted', 'data-testid': 'popup-empty' }, t.popup.empty)
            : null,
        )
      : null,
    h(
      'section',
      { class: 'card' },
      h('h2', {}, t.popup.generator),
      h('div', { class: 'value', 'data-testid': 'popup-generated' }, generated?.value ?? ''),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            onclick: async () => {
              const r = await send<Generated & { settings: GenSettings }>({
                type: 'generate',
                ...(generated ? { settings: generated.settings } : {}),
              });
              if (r.ok) generated = r.data;
              void render(data, '');
            },
          },
          t.popup.generate,
        ),
        h(
          'button',
          {
            class: 'primary',
            onclick: async () => {
              if (!generated) return;
              const r = await send({ type: 'popup-copy-text', text: generated.value });
              message.textContent = r.ok ? t.popup.copied('Passwort') : t.errors.generic;
            },
          },
          t.popup.copy,
        ),
      ),
    ),
    message,
    h('p', { class: 'muted' }, t.popup.openSettings),
  ];
  app.replaceChildren(...parts.filter((n): n is Node => n !== null));
}

void render();
