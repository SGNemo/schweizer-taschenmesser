// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PAGE_LAYOUTS } from '@/core/modules/types';
import { PageContainer } from './PageContainer';

describe('PageContainer', () => {
  it('carries its layout as class and as data-layout, for every layout of the manifest', () => {
    for (const layout of PAGE_LAYOUTS) {
      const { unmount } = render(
        <PageContainer variant={layout}>
          <p>Inhalt</p>
        </PageContainer>,
      );
      const page = screen.getByTestId('page');
      expect(page, layout).toHaveAttribute('data-layout', layout);
      expect(page.className, layout).toMatch(new RegExp(`_${layout}_`));
      unmount();
    }
  });

  it('is a content page unless told otherwise', () => {
    render(
      <PageContainer>
        <p>Inhalt</p>
      </PageContainer>,
    );
    expect(screen.getByTestId('page')).toHaveAttribute('data-layout', 'content');
  });
});
