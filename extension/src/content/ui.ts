/**
 * The overlay: one closed shadow root with one panel at a time (suggestion, save card, entry menu,
 * notice) and a small key button next to login fields. The page cannot read or style it; it only
 * ever sees the events its own fields receive.
 */
import { t } from '../strings';
import type { GenSettings, Generated } from '../lib/generate';
import { h } from './dom';
import { OVERLAY_CSS } from './styles';

/** Replaced at build time; true only in the e2e flavour (see scripts/build.mjs). */
declare const __NEMO_E2E__: boolean;

let shadow: ShadowRoot | undefined;
let root: HTMLDivElement | undefined;
let panel: HTMLElement | undefined;
let keyButton: HTMLButtonElement | undefined;
let anchorEl: Element | null = null;
let onDismiss: (() => void) | undefined;

function ensureRoot(): HTMLDivElement {
  if (root) return root;
  const host = document.createElement('div');
  shadow = host.attachShadow({ mode: __NEMO_E2E__ ? 'open' : 'closed' });
  shadow.append(h('style', { textContent: OVERLAY_CSS }));
  root = h('div', { class: 'root' });
  shadow.append(root);
  (document.body ?? document.documentElement).append(host);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  return root;
}

function placeAt(el: HTMLElement, anchor: Element | null): void {
  const margin = 8;
  const width = el.offsetWidth || 340;
  const height = el.offsetHeight || 200;
  if (!anchor) {
    el.style.right = `${margin * 2}px`;
    el.style.bottom = `${margin * 2}px`;
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const below = rect.bottom + 6;
  const top =
    below + height + margin > window.innerHeight && rect.top - height - 6 > 0
      ? rect.top - height - 6
      : below;
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, window.innerWidth - width - margin),
  );
  el.style.top = `${Math.max(margin, top)}px`;
  el.style.left = `${left}px`;
}

function reposition(): void {
  if (panel && anchorEl) placeAt(panel, anchorEl);
  if (keyButton && anchorEl) placeKey(keyButton, anchorEl);
}

function placeKey(button: HTMLElement, field: Element): void {
  const rect = field.getBoundingClientRect();
  button.style.top = `${rect.top + (rect.height - 28) / 2}px`;
  button.style.left = `${rect.right - 28 - 6}px`;
}

export function closePanel(): void {
  panel?.remove();
  panel = undefined;
  const cb = onDismiss;
  onDismiss = undefined;
  cb?.();
}

export function closeAll(): void {
  closePanel();
  hideKey();
}

function mount(content: HTMLElement, anchor: Element | null, dismiss?: () => void): HTMLElement {
  ensureRoot();
  closePanel();
  anchorEl = anchor;
  onDismiss = dismiss;
  panel = h('div', { class: 'panel', role: 'dialog' }, content);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePanel();
    }
  });
  root!.append(panel);
  placeAt(panel, anchor);
  return panel;
}

function strengthBar(level: number): HTMLElement {
  return h(
    'div',
    { class: 'bar', role: 'img', 'aria-label': t.suggest.strength[level] ?? '' },
    ...[0, 1, 2, 3, 4].map((i) => h('i', { class: i <= level ? 'on' : '' })),
  );
}

export interface SuggestOptions {
  anchor: Element;
  initial: Generated & { settings: GenSettings };
  regenerate(settings: GenSettings): Promise<Generated & { settings: GenSettings }>;
  onUse(value: string): void;
  onClose(): void;
}

export function showSuggest(opts: SuggestOptions): void {
  let current = opts.initial;
  let settings = opts.initial.settings;
  const s = t.suggest;

  const output = h('div', {
    class: 'value',
    'data-testid': 'nemo-suggested',
    'aria-live': 'polite',
  });
  const bits = h('p', { class: 'muted' });
  const bar = h('div');
  const render = () => {
    output.textContent = current.value;
    bits.textContent = `${s.strength[current.level]} · ${s.bits(current.bits)}`;
    bar.replaceChildren(strengthBar(current.level));
  };
  const roll = async (next?: GenSettings) => {
    if (next) settings = next;
    current = await opts.regenerate(settings);
    settings = current.settings;
    render();
  };
  render();

  const check = (label: string, key: 'lower' | 'upper' | 'digits' | 'symbols' | 'avoidAmbiguous') =>
    h(
      'label',
      {},
      h('input', {
        type: 'checkbox',
        checked: settings.password[key],
        onchange: (e) =>
          void roll({
            ...settings,
            password: { ...settings.password, [key]: (e.target as HTMLInputElement).checked },
          }),
      }),
      label,
    );

  const length = h('input', {
    type: 'range',
    min: '8',
    max: '64',
    value: String(settings.password.length),
    'aria-label': s.length,
    oninput: (e) =>
      void roll({
        ...settings,
        password: { ...settings.password, length: Number((e.target as HTMLInputElement).value) },
      }),
  });
  const words = h('input', {
    type: 'range',
    min: '3',
    max: '10',
    value: String(settings.passphrase.words),
    'aria-label': s.words,
    oninput: (e) =>
      void roll({
        ...settings,
        passphrase: { ...settings.passphrase, words: Number((e.target as HTMLInputElement).value) },
      }),
  });
  const phrase = h(
    'label',
    {},
    h('input', {
      type: 'checkbox',
      checked: settings.mode === 'passphrase',
      onchange: (e) =>
        void roll({
          ...settings,
          mode: (e.target as HTMLInputElement).checked ? 'passphrase' : 'password',
        }),
    }),
    s.passphrase,
  );

  mount(
    h(
      'div',
      { class: 'panel-body', style: 'display:grid;gap:8px' },
      h(
        'div',
        { class: 'head' },
        h('span', {}, s.title),
        h(
          'button',
          {
            class: 'ghost icon',
            'aria-label': s.close,
            onclick: () => {
              closePanel();
              opts.onClose();
            },
          },
          '✕',
        ),
      ),
      output,
      bar,
      bits,
      h(
        'div',
        { class: 'row' },
        h('button', { onclick: () => void roll() }, s.reroll),
        h(
          'button',
          { class: 'primary', 'data-testid': 'nemo-use', onclick: () => opts.onUse(current.value) },
          s.use,
        ),
      ),
      h(
        'details',
        {},
        h('summary', {}, s.settings),
        h('div', { class: 'checks' }, phrase),
        h('label', {}, s.length, length),
        h(
          'div',
          { class: 'checks' },
          check(s.lower, 'lower'),
          check(s.upper, 'upper'),
          check(s.digits, 'digits'),
          check(s.symbols, 'symbols'),
          check(s.ambiguous, 'avoidAmbiguous'),
        ),
        h('label', {}, s.words, words),
      ),
    ),
    opts.anchor,
  );
}

export interface SaveOptions {
  kind: 'save' | 'update';
  /** 'new' = fresh from the suggestion; 'offer' = after a submitted form. */
  origin: 'suggestion' | 'offer';
  title: string;
  username: string;
  site: string;
  anchor: Element | null;
  /** Resolves to a German status text on failure, or null on success. */
  onSave(
    title: string,
    username: string,
  ): Promise<{ ok: true; text: string } | { ok: false; text: string }>;
  onLater(): void;
  onDiscard(): void;
}

export function showSave(opts: SaveOptions): void {
  const s = t.save;
  const title = h('input', {
    type: 'text',
    value: opts.title,
    maxLength: 200,
    'data-testid': 'nemo-title',
  });
  const user = h('input', {
    type: 'text',
    value: opts.username,
    maxLength: 500,
    autocomplete: 'off',
    'data-testid': 'nemo-username',
  });
  const status = h('p', {
    class: 'status',
    role: 'status',
    'aria-live': 'polite',
    'data-testid': 'nemo-status',
  });
  const heading =
    opts.kind === 'update' ? s.updateTitle : opts.origin === 'offer' ? s.offerTitle : s.title;
  const saveButton = h(
    'button',
    { class: 'primary', 'data-testid': 'nemo-save' },
    opts.kind === 'update' ? s.update : s.save,
  );
  saveButton.addEventListener('click', () => {
    saveButton.disabled = true;
    status.className = 'status';
    status.textContent = '';
    void opts.onSave(title.value, user.value).then((r) => {
      status.textContent = r.text;
      status.className = r.ok ? 'status ok' : 'status err';
      if (r.ok) setTimeout(closePanel, 2500);
      else {
        saveButton.disabled = false;
        saveButton.textContent = s.retry;
      }
    });
  });
  mount(
    h(
      'div',
      { style: 'display:grid;gap:8px' },
      h('div', { class: 'head' }, h('span', {}, heading)),
      opts.kind === 'save' ? h('label', {}, s.name, title) : null,
      h('label', {}, s.username, user),
      h('p', { class: 'muted' }, `${s.site}: ${opts.site}`),
      status,
      h(
        'div',
        { class: 'row' },
        saveButton,
        h(
          'button',
          {
            onclick: () => {
              closePanel();
              opts.onLater();
            },
          },
          s.later,
        ),
        h(
          'button',
          {
            class: 'ghost',
            onclick: () => {
              closePanel();
              opts.onDiscard();
            },
          },
          s.discard,
        ),
      ),
      h('p', { class: 'muted' }, s.kept),
    ),
    opts.anchor,
  );
}

export interface MenuEntry {
  id: string;
  title: string;
  username: string;
}

export function showMenu(opts: {
  anchor: Element;
  title: string;
  entries: MenuEntry[];
  onPick(entry: MenuEntry): void;
}): void {
  mount(
    h(
      'div',
      { style: 'display:grid;gap:8px' },
      h(
        'div',
        { class: 'head' },
        h('span', {}, opts.title),
        h(
          'button',
          { class: 'ghost icon', 'aria-label': t.suggest.close, onclick: closePanel },
          '✕',
        ),
      ),
      opts.entries.length === 0
        ? h('p', { class: 'muted' }, t.fill.none)
        : h(
            'ul',
            { class: 'entries' },
            ...opts.entries.map((e) =>
              h(
                'li',
                {},
                h(
                  'button',
                  {
                    'data-testid': `nemo-entry-${e.id}`,
                    onclick: () => {
                      closePanel();
                      opts.onPick(e);
                    },
                  },
                  h('span', {}, e.title),
                  h('small', {}, e.username),
                ),
              ),
            ),
          ),
    ),
    opts.anchor,
  );
}

export function showNotice(
  text: string,
  kind: 'ok' | 'err' | 'info',
  anchor: Element | null = null,
): void {
  mount(
    h(
      'div',
      { style: 'display:grid;gap:8px' },
      h(
        'p',
        {
          class: kind === 'ok' ? 'status ok' : kind === 'err' ? 'status err' : 'status',
          role: 'status',
          'data-testid': 'nemo-notice',
        },
        text,
      ),
      h('button', { class: 'ghost', onclick: closePanel }, t.suggest.close),
    ),
    anchor,
  );
  setTimeout(() => {
    if (panel?.contains(root?.querySelector('[data-testid="nemo-notice"]') ?? null)) closePanel();
  }, 6000);
}

export function showKey(field: Element, label: string, onClick: () => void): void {
  ensureRoot();
  hideKey();
  anchorEl = field;
  keyButton = h(
    'button',
    {
      class: 'key',
      'aria-label': label,
      title: label,
      'data-testid': 'nemo-key',
      onclick: onClick,
    },
    '🔑',
  );
  keyButton.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the field
  root!.append(keyButton);
  placeKey(keyButton, field);
}

export function hideKey(): void {
  keyButton?.remove();
  keyButton = undefined;
}

export const isOverlayOpen = (): boolean => panel !== undefined;
