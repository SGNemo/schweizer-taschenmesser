// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotePaper } from '@/ui/identity';
import { pageMenuItems } from '../components/pageMenu';
import { settings as moduleSettings, settingsSchema } from '../settings';
import { buildTemplate, TEMPLATE_IDS } from '../templates';

describe('note templates', () => {
  it('builds a title with today in it and a non-empty Markdown body for each template', () => {
    for (const id of TEMPLATE_IDS) {
      const made = buildTemplate(id);
      expect(made.title.length, id).toBeGreaterThan(0);
      expect(made.body.length, id).toBeGreaterThan(0);
    }
    expect(buildTemplate('list').body).toMatch(/^- \[ \] /);
    expect(buildTemplate('meeting').body).toContain('- [ ] ');
    expect(buildTemplate('diary').title).toMatch(/\d/);
  });
});

describe('notes settings', () => {
  it('has a list view by default and accepts old stored settings without it', () => {
    expect(moduleSettings.defaults).toMatchObject({ view: 'list' });
    expect(settingsSchema.safeParse({ ...moduleSettings.defaults, view: 'cards' }).success).toBe(
      true,
    );
    expect(settingsSchema.safeParse({ ...moduleSettings.defaults, view: 'grid' }).success).toBe(
      false,
    );
  });
});

describe('NotePaper (library block in the head)', () => {
  it('is decoration: hidden from assistive technology, text only, no colour needed', () => {
    render(<NotePaper>Milch nicht vergessen</NotePaper>);
    const paper = document.querySelector('[data-signature="notePaper"]')!;
    expect(paper).toHaveAttribute('aria-hidden', 'true');
    expect(paper).toHaveTextContent('Milch nicht vergessen');
    expect(paper.querySelector('img, svg, canvas')).toBeNull();
  });
});

describe('page menu', () => {
  it('lists pin and move first and delete last, so a new entry slots in before delete', () => {
    const noop = () => undefined;
    const items = pageMenuItems({ id: 'p', pinned: false } as never, {
      onTogglePin: noop,
      onMove: noop,
      onDelete: noop,
    });
    expect(items.map((i) => i.id)).toEqual(['pin', 'move', 'delete']);
    expect(items.at(-1)!.danger).toBe(true);
  });
});
