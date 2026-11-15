import { describe, expect, expectTypeOf, it } from 'vitest';
import type { EventMap } from '@/core/events/events';
import type { PlannableItem } from '@/core/modules/types';
import type { CaptureFields } from '@/quickCapture/parser/types';
import {
  LINK_KINDS,
  fromLegacy,
  linkRel,
  refKey,
  refOfKey,
  refOfKind,
  type EntityLink,
  type LegacyLink,
} from './types';

describe('link contract: helpers', () => {
  it('a ref key is `<module>:<id>`, the planner’s item key format', () => {
    expect(refKey({ module: 'invoices', id: 'mail-abc' })).toBe('invoices:mail-abc');
  });

  it('a key reads back as its ref; anything else is no ref', () => {
    expect(refOfKey('todos:t-1')).toEqual({ module: 'todos', id: 't-1' });
    expect(refOfKey('mail:a:b')).toEqual({ module: 'mail', id: 'a:b' });
    expect(refOfKey(`todos:${'x'.repeat(128)}`)).toEqual({ module: 'todos', id: 'x'.repeat(128) });
    for (const bad of [
      '',
      'evt-1',
      ':x',
      'todos:',
      'To Dos:x',
      `todos:${'x'.repeat(129)}`,
      'todos:t 1',
      'todos: t1',
      'todos:t1\n',
      'todos:t\t1',
      'todos:t\u00a01',
      'todos:t\u00001',
      'todos:t\u001b1',
      'todos:t\u007f1',
      'todos:t\u200b1',
      42,
      null,
    ])
      expect(refOfKey(bad)).toBeUndefined();
  });

  it('every legacy kind names its module', () => {
    expect(LINK_KINDS).toEqual(['note', 'mail', 'invoice', 'event']);
    expect(LINK_KINDS.map((k) => refOfKind[k])).toEqual(['notes', 'mail', 'invoices', 'calendar']);
  });

  it('a legacy link becomes the target half of an entity link, label unchanged', () => {
    expect(fromLegacy({ kind: 'mail', id: 't-1', label: 'Stadtwerke <b>' })).toEqual({
      to: { module: 'mail', id: 't-1' },
      rel: 'origin',
      label: 'Stadtwerke <b>',
    });
  });

  it('an unknown stored rel reads as `about`', () => {
    expect(linkRel('dunning')).toBe('dunning');
    expect(linkRel('origin')).toBe('origin');
    expect(linkRel('something-newer')).toBe('about');
    expect(linkRel(undefined)).toBe('about');
  });
});

describe('link contract: one legacy shape everywhere', () => {
  it('events, plannable items and the capture parser carry exactly `LegacyLink`', () => {
    expectTypeOf<NonNullable<EventMap['todo.requested']['link']>>().toEqualTypeOf<LegacyLink>();
    expectTypeOf<NonNullable<EventMap['plan.requested']['link']>>().toEqualTypeOf<LegacyLink>();
    expectTypeOf<NonNullable<PlannableItem['link']>>().toEqualTypeOf<LegacyLink>();
    // The parser may not import from outside its folder, so its copy of the shape is pinned here.
    expectTypeOf<NonNullable<CaptureFields['link']>>().toEqualTypeOf<LegacyLink>();
    expectTypeOf<NonNullable<PlannableItem['links']>[number]>().toEqualTypeOf<
      Omit<EntityLink, 'from'>
    >();
  });
});
