import { describe, expect, it } from 'vitest';
import {
  END,
  START,
  moduleBlock,
  platformKey,
  replaceBlock,
  shortText,
  type ModuleData,
} from './moduleList';

describe('shortText', () => {
  it('cuts at a dash, colon or semicolon', () => {
    expect(shortText('Events in month, week and day view – also shows due dates.')).toBe(
      'Events in month, week and day view',
    );
    expect(shortText('Downloads files: progress, pause, resume.')).toBe('Downloads files');
  });

  it('keeps a short first sentence whole and drops the rest', () => {
    expect(shortText('Open invoices with amount and due date. “Mark as paid” books it.')).toBe(
      'Open invoices with amount and due date',
    );
  });

  it('cuts a very long sentence at a comma before character 90', () => {
    const long =
      'Accounts, income and expenses with categories, a monthly overview with charts and the money you really have available';
    expect(shortText(long)).toBe('Accounts, income and expenses with categories');
  });

  it('never cuts inside brackets and knows Spanish and French sentence starts', () => {
    const disk =
      'Unidades con análisis de las carpetas más grandes e información del sistema (procesador, memoria, batería, red): solo para ver.';
    expect(shortText(disk)).toBe(
      'Unidades con análisis de las carpetas más grandes e información del sistema',
    );
    expect(
      shortText(
        'Facturas pendientes con importe, destinatario y vencimiento. «Marcar como pagada» registra el gasto.',
      ),
    ).toBe('Facturas pendientes con importe, destinatario y vencimiento');
    expect(
      shortText('Coffre-fort à mots de passe : identifiants chiffrés (Argon2id, AES-256).'),
    ).toBe('Coffre-fort à mots de passe');
  });

  it('does not cut inside the first words', () => {
    expect(shortText('Password vault: logins and codes')).toBe('Password vault');
    expect(shortText('Vault: x')).toBe('Vault: x');
  });
});

describe('platformKey', () => {
  it('maps the manifest platforms to what people can install', () => {
    expect(platformKey(undefined)).toBeNull();
    expect(platformKey(['desktop'])).toBe('windows');
    expect(platformKey(['desktop', 'android'])).toBe('both');
    expect(platformKey(['android'])).toBe('android');
    expect(platformKey(['web', 'desktop'])).toBeNull();
  });
});

const data: ModuleData = {
  areas: [
    { id: 'plan', name: { en: 'Plan', de: 'Planen' } },
    { id: 'system', name: { en: 'System', de: 'Gerät' } },
  ],
  modules: [
    {
      id: 'calendar',
      area: 'plan',
      status: 'default',
      platforms: null,
      icon: 'calendar',
      hue: 'sky',
      hue2: 'ocean',
      head: 'zeit',
      widget: 'zeitleiste',
      name: { en: 'Calendar', de: 'Kalender' },
      short: {},
      description: {
        en: 'Events in month view – and more.',
        de: 'Termine in der Monatsansicht – und mehr.',
      },
    },
    {
      id: 'todos',
      area: 'plan',
      status: 'optional',
      platforms: null,
      icon: 'checklist',
      hue: 'moss',
      hue2: null,
      head: 'fokus',
      widget: 'fokus',
      name: { en: 'To-dos', de: 'ToDos' },
      short: {},
      description: { en: 'Tasks in lists.', de: 'Aufgaben in Listen.' },
    },
    {
      id: 'disk',
      area: 'system',
      status: 'preview',
      platforms: 'windows',
      icon: 'disk',
      hue: 'slate',
      hue2: null,
      head: 'fortschritt',
      widget: 'fortschritt',
      name: { en: 'This PC', de: 'Dieser PC' },
      short: {},
      description: { en: 'Drives and system info.', de: 'Laufwerke und Systeminfo.' },
    },
  ],
  toolCategories: [],
  tools: [
    {
      id: 'calc',
      category: 'rechnen',
      status: 'default',
      name: { en: 'Calculator', de: 'Rechner' },
    },
    { id: 'regex', category: 'entwickler', status: 'preview', name: { en: 'Regex', de: 'Regex' } },
  ],
};

describe('moduleBlock', () => {
  it('writes one row per module, the area name only on its first row, and the notes as words', () => {
    const md = moduleBlock(data, 'en');
    expect(md).toContain('| **Plan** | Calendar | Events in month view | on by default |');
    expect(md).toContain('|  | To-dos | Tasks in lists | optional |');
    expect(md).toContain(
      '| **System** | This PC | Drives and system info | preview, Windows app only |',
    );
    expect(md).toContain('**Tools:** Calculator · Regex (preview).');
  });

  it('speaks German for the German files', () => {
    const md = moduleBlock(data, 'de');
    expect(md).toContain('| Bereich | Modul | Was es tut | Status |');
    expect(md).toContain(
      '| **Gerät** | Dieser PC | Laufwerke und Systeminfo | Vorschau, nur Windows-App |',
    );
    expect(md).toContain('**Werkzeuge:** Rechner · Regex (Vorschau).');
  });
});

describe('replaceBlock', () => {
  it('replaces what lies between the markers and keeps the rest', () => {
    const out = replaceBlock(`before\n${START}\nold\n${END}\nafter\n`, 'NEW');
    expect(out).toBe(`before\n${START}\n\nNEW\n\n${END}\nafter\n`);
    expect(replaceBlock(out ?? '', 'NEW')).toBe(out);
  });

  it('leaves a file without markers alone', () => {
    expect(replaceBlock('no markers', 'NEW')).toBeUndefined();
  });
});
