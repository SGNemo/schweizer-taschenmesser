import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import { feedKey, groupFeeds, hostOf, normalizeFeedUrl } from '../logic';
import manifest from '../manifest';
import { feedSchema } from '../schema';

describe('feeds module', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('validates feeds: a name and an http(s) address are required', () => {
    expect(feedSchema.safeParse({ title: '', url: 'https://a.example' }).success).toBe(false);
    expect(feedSchema.safeParse({ title: 'x', url: 'ftp://a.example/f' }).success).toBe(false);
    expect(feedSchema.safeParse({ title: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(feedSchema.parse({ title: ' x ', url: 'https://a.example/f' })).toMatchObject({
      title: 'x',
      category: '',
    });
  });
});

describe('feed addresses', () => {
  it('adds https, refuses everything that is not a web address', () => {
    expect(normalizeFeedUrl('example.org/feed.xml')).toBe('https://example.org/feed.xml');
    expect(normalizeFeedUrl(' http://example.org/a ')).toBe('http://example.org/a');
    expect(normalizeFeedUrl('')).toBeUndefined();
    expect(normalizeFeedUrl('not a url')).toBeUndefined();
    expect(normalizeFeedUrl('ftp://example.org/f')).toBeUndefined();
    expect(normalizeFeedUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeFeedUrl('localhost')).toBeUndefined();
  });

  it('recognises the same feed written differently', () => {
    expect(feedKey('https://www.Example.org/feed/')).toBe(feedKey('http://example.org/feed'));
    expect(feedKey('https://example.org/feed')).not.toBe(feedKey('https://example.org/other'));
    expect(hostOf('https://www.example.org/x')).toBe('example.org');
  });

  it('groups by category, named groups A–Z first and ungrouped last', () => {
    const c = new Intl.Collator('de');
    const groups = groupFeeds(
      [
        { title: 'Zeta', category: '' },
        { title: 'Beta', category: 'Podcasts' },
        { title: 'Äpfel', category: 'Nachrichten' },
        { title: 'Alpha', category: 'Podcasts' },
      ],
      c,
    );
    expect(groups.map((g) => g.category)).toEqual(['Nachrichten', 'Podcasts', '']);
    expect(groups[1]!.feeds.map((f) => f.title)).toEqual(['Alpha', 'Beta']);
  });
});
