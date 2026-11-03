// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotePaper } from '../components/NotePaper';
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

describe('NotePaper', () => {
  it('is decoration: hidden from assistive technology, text only, no colour needed', () => {
    render(<NotePaper text="Milch nicht vergessen" />);
    const paper = screen.getByTestId('note-paper');
    expect(paper).toHaveAttribute('aria-hidden', 'true');
    expect(paper).toHaveTextContent('Milch nicht vergessen');
    expect(paper.querySelector('img, svg, canvas')).toBeNull();
  });
});
