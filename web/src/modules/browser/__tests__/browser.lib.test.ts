import { describe, expect, it } from 'vitest';
import { resolveInput } from '../lib/omnibox';
import { SEARCH_ENGINES, engineTemplate, isValidTemplate } from '../lib/searchEngines';
import { displayUrl, hostOf, isWebUrl, urlKind } from '../lib/urlPolicy';

const T = SEARCH_ENGINES[0]!.template;

describe('omnibox', () => {
  it('opens addresses, searches the rest', () => {
    expect(resolveInput('example.org', T)).toEqual({ kind: 'url', url: 'https://example.org/' });
    expect(resolveInput('http://example.org/a', T)).toEqual({ kind: 'url', url: 'http://example.org/a' });
    expect(resolveInput('localhost:8080/x', T)?.url).toBe('https://localhost:8080/x');
    expect(resolveInput('wetter in bern', T)).toEqual({
      kind: 'search',
      url: 'https://duckduckgo.com/?q=wetter%20in%20bern',
    });
    expect(resolveInput('   ', T)).toBeNull();
  });
  it('never turns dangerous schemes into addresses', () => {
    for (const x of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'tauri://localhost']) {
      expect(resolveInput(x, T)?.kind).toBe('search');
    }
  });
});

describe('search engines', () => {
  it('validates custom templates and falls back', () => {
    expect(isValidTemplate('https://s.example/?q={q}')).toBe(true);
    expect(isValidTemplate('http://s.example/?q={q}')).toBe(false);
    expect(isValidTemplate('https://s.example/')).toBe(false);
    expect(engineTemplate('custom', 'nope')).toBe(T);
    expect(engineTemplate('unknown', '')).toBe(T);
    expect(engineTemplate('custom', 'https://s.example/?q={q}')).toBe('https://s.example/?q={q}');
  });
});

describe('urlPolicy', () => {
  it('classifies and shortens', () => {
    expect(urlKind('https://a.test')).toBe('https');
    expect(urlKind('http://a.test')).toBe('http');
    expect(urlKind('file:///x')).toBe('other');
    expect(isWebUrl('javascript:1')).toBe(false);
    expect(hostOf('https://www.a.test/x')).toBe('www.a.test');
    expect(displayUrl('https://www.a.test/')).toBe('a.test');
    expect(displayUrl('https://www.a.test/p/q')).toBe('a.test/p/q');
  });
});
