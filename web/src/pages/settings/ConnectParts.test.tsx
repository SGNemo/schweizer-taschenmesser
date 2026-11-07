// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Actions, Facts, StateBanner, Step } from './ConnectParts';

describe('ConnectParts', () => {
  it('the banner says the state in words and keeps its test id', () => {
    render(
      <StateBanner
        icon="cloudOff"
        title="Nicht verbunden"
        line="Lokal"
        testId="x"
        tone="attention"
      />,
    );
    const banner = screen.getByTestId('x');
    expect(banner).toHaveTextContent('Nicht verbunden');
    expect(banner.getAttribute('data-tone')).toBe('attention');
  });

  it('a step is a named region with a heading and no drawn number (identity v3.1)', () => {
    render(
      <Step n={2} title="Gerät" hint="Name">
        <input aria-label="feld" />
      </Step>,
    );
    expect(screen.getByRole('region', { name: 'Gerät' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gerät', level: 3 })).toBeInTheDocument();
    expect(screen.queryByText('2')).toBeNull();
  });

  it('the banner is the shared status card: tinted unless told otherwise', () => {
    render(
      <>
        <StateBanner title="Eins" testId="a" />
        <StateBanner title="Zwei" testId="b" tinted={false} />
      </>,
    );
    expect(screen.getByTestId('a').getAttribute('data-tinted')).toBe('true');
    expect(screen.getByTestId('b').getAttribute('data-tinted')).toBe('false');
  });

  it('facts are label/value pairs; a fact keeps its test id', () => {
    render(
      <>
        <Facts label="Stand" items={[{ label: 'Zuletzt', value: 'heute', testId: 'v' }]} />
        <Actions>
          <button>Ok</button>
        </Actions>
      </>,
    );
    expect(screen.getByTestId('v')).toHaveTextContent('heute');
    expect(screen.getByText('Zuletzt').tagName).toBe('DT');
  });
});
