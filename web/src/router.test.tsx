// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { RouteObject } from 'react-router';
import { NoReadAid } from '@/ui';
import { AreaFrame } from '@/layout/AreaFrame';
import { buildRoutes } from './router';

const flat = (routes: RouteObject[]): RouteObject[] =>
  routes.flatMap((r) => [r, ...(r.children ? flat(r.children) : [])]);

describe('routes', () => {
  it('credential modules get the reading aid switched off around the whole frame, head included (DESIGN-SPEC §4c)', () => {
    const routes = flat(buildRoutes({ vault: true, accounts: true, todos: true }));
    const element = (path: string) =>
      routes.find((r) => r.path === path)?.element as {
        type: unknown;
        props: { children?: { type: unknown } };
      };
    for (const id of ['vault', 'accounts']) {
      const el = element(id);
      expect(el?.type, id).toBe(NoReadAid);
      expect(el.props.children?.type, `${id}: the frame sits inside`).toBe(AreaFrame);
    }
    // Every other module keeps the aid: the frame is the element itself.
    expect(element('todos')?.type).toBe(AreaFrame);
  });
});
