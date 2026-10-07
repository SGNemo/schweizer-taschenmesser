import { describe, expect, it } from 'vitest';
import { fullFormPath } from './fullForm';

describe('fullFormPath', () => {
  it('prefills the pages that read the query', () => {
    expect(fullFormPath('todo', { title: 'Zahnbürsten kaufen' }, 'Zahnbürsten kaufen')).toBe(
      '/todos?new=1&title=Zahnb%C3%BCrsten%20kaufen',
    );
    expect(fullFormPath('note', { title: 'Idee' }, 'Idee')).toBe('/notes?new=1&title=Idee');
    expect(fullFormPath('bookmark', { title: 'x' }, 'lesen https://a.example/x')).toBe(
      '/bookmarks?new=1&text=lesen%20https%3A%2F%2Fa.example%2Fx',
    );
  });
  it('falls back to the typed text and has no path for the other types', () => {
    expect(fullFormPath('todo', { title: '' }, ' Rest ')).toBe('/todos?new=1&title=Rest');
    expect(fullFormPath('event', { title: 'x' }, 'x')).toBeUndefined();
    expect(fullFormPath('finance', { title: 'x' }, 'x')).toBeUndefined();
  });
});
