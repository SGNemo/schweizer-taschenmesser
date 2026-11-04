// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupedList } from './GroupedList';

const groups = [
  { id: 'a', label: 'Nachrichten', count: 2, children: <p>Eins</p> },
  { id: 'b', label: 'Podcasts', count: 1, children: <p>Zwei</p> },
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
});
