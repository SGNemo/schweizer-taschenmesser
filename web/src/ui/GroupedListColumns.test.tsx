// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupedList } from './GroupedList';
import { ItemRow } from './Patterns';

// Under `columns` a group's children are its rows (`ItemRow`, an `<li>` each).
const groups = [
  { id: 'a', label: 'Nachrichten', count: 1, children: <ItemRow title="Eins" /> },
  { id: 'b', label: 'Podcasts', count: 1, children: <ItemRow title="Zwei" /> },
];

describe('GroupedList columns', () => {
  it('adds the column layout only when asked and keeps every group, heading and body', () => {
    const plain = render(<GroupedList listId="t-plain" groups={groups} label="Feeds" />);
    const plainClass = screen.getByRole('group', { name: 'Feeds' }).className;
    plain.unmount();
    render(<GroupedList listId="t-cols" groups={groups} label="Feeds" columns />);
    const root = screen.getByRole('group', { name: 'Feeds' });
    expect(root.className).not.toBe(plainClass);
    expect(root.className).toContain(plainClass);
    expect(screen.getByRole('heading', { name: /Nachrichten/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Podcasts/ })).toBeInTheDocument();
    expect(screen.getByText('Eins')).toBeInTheDocument();
    expect(screen.getByText('Zwei')).toBeInTheDocument();
  });

  it('puts the rows of a column group into a list, so no <li> stands alone (U23b, axe "listitem")', () => {
    const { container } = render(
      <GroupedList
        listId="t-rows"
        label="Feeds"
        columns
        groups={[
          {
            id: 'a',
            label: 'Nachrichten',
            count: 2,
            children: [
              <ItemRow key="1" title="Tagesschau" href="https://example.org/a" />,
              <ItemRow key="2" title="Heise" href="https://example.org/b" />,
            ],
          },
        ]}
      />,
    );
    const items = [...container.querySelectorAll('li')];
    expect(items).toHaveLength(2);
    for (const li of items) expect(['UL', 'OL']).toContain(li.parentElement?.tagName);
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });
});
