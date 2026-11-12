import { describe, expect, it } from 'vitest';
import { resolveInput } from '../lib/omnibox';
import { reopenTarget } from '../lib/reopen';
import { SEARCH_ENGINES, engineTemplate, isValidTemplate } from '../lib/searchEngines';
import { displayUrl, hostOf, isWebUrl, offerName, urlKind } from '../lib/urlPolicy';

const T = SEARCH_ENGINES[0]!.template;

describe('omnibox', () => {
  it('opens addresses, searches the rest', () => {
    expect(resolveInput('example.org', T)).toEqual({ kind: 'url', url: 'https://example.org/' });
    expect(resolveInput('http://example.org/a', T)).toEqual({
      kind: 'url',
      url: 'http://example.org/a',
    });
    expect(resolveInput('localhost:8080/x', T)?.url).toBe('https://localhost:8080/x');
    expect(resolveInput('wetter in bern', T)).toEqual({
      kind: 'search',
      url: 'https://duckduckgo.com/?q=wetter%20in%20bern',
    });
    expect(resolveInput('   ', T)).toBeNull();
  });
  it('never turns dangerous schemes into addresses', () => {
    for (const x of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,x',
      'tauri://localhost',
    ]) {
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
    expect(offerName('https://a.test/files/mein%20buch.pdf?x=1')).toBe('mein buch.pdf');
    expect(offerName('https://a.test/')).toBe('a.test');
  });
});

describe('reopenTarget ("Tab neu öffnen" on the start view)', () => {
  const closed = { url: 'https://closed.example.org/', title: 'Closed' };
  const visit = { url: 'https://visit.example.org/', title: 'Visit' };
  const base = {
    lastClosed: null,
    inPrivateTab: false,
    anyOpen: false,
    historyOn: true,
    lastVisit: visit,
  };

  it('offers the tab closed last before anything from the history', () => {
    expect(reopenTarget({ ...base, lastClosed: closed, anyOpen: true })).toEqual(closed);
  });

  it('after a restart (no page open) offers the last page of the history', () => {
    expect(reopenTarget(base)).toEqual(visit);
  });

  it('never offers a page of the history while a page is open in some tab', () => {
    expect(reopenTarget({ ...base, anyOpen: true })).toBeNull();
  });

  it('offers nothing with the history off, without a visit, or inside a private tab', () => {
    expect(reopenTarget({ ...base, historyOn: false })).toBeNull();
    expect(reopenTarget({ ...base, lastVisit: undefined })).toBeNull();
    expect(reopenTarget({ ...base, lastClosed: closed, inPrivateTab: true })).toBeNull();
  });
});
