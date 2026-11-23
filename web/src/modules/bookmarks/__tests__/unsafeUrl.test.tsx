// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemList } from '@/ui';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkRow } from '../components/BookmarkRow';

// Q3 (launch review 2026-11): a bookmark from sync or a share file is not validated by the add
// form. Whatever its `url` says, only http(s) ever becomes a link.
const item = (url: string) =>
  ({
    id: 'x',
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'd',
    deletedAt: null,
    _f: {},
    title: 'Merkposten',
    kind: 'link',
    tags: [],
    done: false,
    started: false,
    url,
  }) as never;

const HOSTILE = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<b>x</b>',
  'file:///C:/x',
  'vbscript:x',
];

describe('bookmark url scheme', () => {
  it('row and card never turn a non-http(s) address into a link', () => {
    for (const url of HOSTILE) {
      const { container, unmount } = render(
        <>
          <ItemList label="Merkliste">
            <BookmarkRow item={item(url)} onEdit={() => {}} onFilterTag={() => {}} />
          </ItemList>
          <BookmarkCard item={item(url)} onEdit={() => {}} onFilterTag={() => {}} />
        </>,
      );
      for (const a of container.querySelectorAll('a')) {
        expect(a.getAttribute('href') ?? '', url).toMatch(/^(https?:|$)/);
      }
      unmount();
    }
  });

  it('http(s) addresses stay links', () => {
    const { container } = render(
      <BookmarkCard
        item={item('https://example.org/a')}
        onEdit={() => {}}
        onFilterTag={() => {}}
      />,
    );
    expect(container.querySelector('a[href="https://example.org/a"]')).not.toBeNull();
  });
});
