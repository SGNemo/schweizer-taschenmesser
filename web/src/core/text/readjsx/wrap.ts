import * as base from 'react/jsx-runtime';
import { Link, NavLink } from 'react-router';
import { ReadableText, type ReadLevel } from '../ReadableText';

/** Hosts whose text is data, code, form state or SVG: never emphasised. */
const SKIP = new Set([
  'input',
  'textarea',
  'select',
  'option',
  'optgroup',
  'datalist',
  'output',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'script',
  'style',
  'title',
  'noscript',
  'template',
  'text',
  'tspan',
  'textpath',
  'desc',
  'svg',
  'g',
  'path',
]);
const RUNNING = new Set(['p', 'blockquote', 'figcaption', 'dd']);
/** Headings and other already bold text: heavy start, and (when the ink is primary) a dimmed rest. */
const BOLD_HOSTS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'summary', 'legend']);
const LISTY = new Set(['li', 'caption']);
const CONTROLS = new Set(['button', 'a']);

/** Coverage level an element's own text belongs to, or `null` for hosts that are never emphasised. */
export function levelOf(host: string): ReadLevel | null {
  if (SKIP.has(host)) return null;
  if (RUNNING.has(host)) return 25;
  if (BOLD_HOSTS.has(host) || LISTY.has(host)) return 50;
  if (CONTROLS.has(host)) return 100;
  return 75;
}

const hasLetters = (s: string): boolean => /\p{L}/u.test(s);

interface Plan {
  level: ReadLevel;
  heavy: boolean;
}

/** Third-party components that render an `<a>` from their own (unwrapped) code: their text is link text. */
const LINK_COMPONENTS: ReadonlySet<unknown> = new Set([Link, NavLink]);

function planOf(host: unknown): Plan | null {
  if (typeof host !== 'string')
    return LINK_COMPONENTS.has(host) ? { level: 100, heavy: false } : null;
  const level = levelOf(host);
  if (!level) return null;
  const bold = BOLD_HOSTS.has(host);
  return { level, heavy: bold };
}

function wrapChild(child: unknown, plan: Plan, index: number): unknown {
  if (typeof child !== 'string' || !hasLetters(child)) return child;
  return base.jsx(ReadableText, { text: child, ...plan }, `rs${index}`);
}

/** Returns `props` with string children replaced by `ReadableText` elements (untouched when there is nothing to do). */
export function wrapProps(type: unknown, props: Record<string, unknown>): Record<string, unknown> {
  const children = props.children;
  if (typeof type !== 'string' && !LINK_COMPONENTS.has(type)) return props;
  if (typeof children === 'string') {
    if (!hasLetters(children)) return props;
    const plan = planOf(type);
    return plan ? { ...props, children: wrapChild(children, plan, 0) } : props;
  }
  if (!Array.isArray(children) || !children.some((c) => typeof c === 'string')) return props;
  const plan = planOf(type);
  if (!plan) return props;
  return { ...props, children: children.map((c, i) => wrapChild(c, plan, i)) };
}
