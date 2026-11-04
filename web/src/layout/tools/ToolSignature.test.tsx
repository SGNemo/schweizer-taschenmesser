// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { allTools } from '@/core/tools/registry';
import { TOOL_SIGNATURES } from '@/core/tools/types';
import { ToolSignature } from './ToolSignature';
import { ToolPlate } from './ToolPlate';

describe('tool signatures', () => {
  it.each(TOOL_SIGNATURES.filter((x) => x !== 'none'))('%s draws a hidden decoration', (id) => {
    const { container } = render(<ToolSignature id={id} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.childElementCount).toBeGreaterThan(0);
  });

  it('"none" draws nothing', () => {
    expect(render(<ToolSignature id="none" />).container.innerHTML).toBe('');
  });

  it('a plate carries the tool hue and stays out of the accessibility tree', () => {
    for (const tool of allTools) {
      const { container } = render(<ToolPlate tool={tool} />);
      const plate = container.firstElementChild!;
      expect(plate.getAttribute('data-hue'), tool.id).toBe(tool.identity.hue);
      expect(plate.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
