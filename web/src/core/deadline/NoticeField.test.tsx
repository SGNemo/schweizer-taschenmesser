// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { tDeadline } from '@/strings.deadline';
import { NoticeField } from './NoticeField';

describe('NoticeField', () => {
  it('puts the hint under the whole row, so amount and unit line up (U27b)', () => {
    const { container } = render(<NoticeField days={undefined} onChange={vi.fn()} max={730} />);
    const hint = screen.getByText(tDeadline.de.hint);
    const row = container.querySelector('[data-notice-row]');
    expect(row).not.toBeNull();
    expect(row!.contains(hint)).toBe(false);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-describedby', hint.id);
  });
});
