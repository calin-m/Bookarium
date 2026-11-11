import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentCrossfade } from './ContentCrossfade';

describe('ContentCrossfade Primitive', () => {
  it('renders children with default page-turn variant and overflow-anchor:none', () => {
    render(
      <ContentCrossfade transitionKey="test-key-1" dataTestId="test-crossfade">
        <p>Tactile Content</p>
      </ContentCrossfade>
    );

    const el = screen.getByTestId('test-crossfade');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-page-turn', '[overflow-anchor:none]');
    expect(screen.getByText('Tactile Content')).toBeInTheDocument();
  });

  it('supports custom variants: fade, slide-left, and slide-right', () => {
    const { rerender } = render(
      <ContentCrossfade transitionKey="fade-key" variant="fade" dataTestId="test-variant">
        <span>Fade Content</span>
      </ContentCrossfade>
    );
    expect(screen.getByTestId('test-variant')).toHaveClass('animate-in', 'fade-in');

    rerender(
      <ContentCrossfade transitionKey="slide-left-key" variant="slide-left" dataTestId="test-variant">
        <span>Slide Left</span>
      </ContentCrossfade>
    );
    expect(screen.getByTestId('test-variant')).toHaveClass('animate-view-slide-left');

    rerender(
      <ContentCrossfade transitionKey="slide-right-key" variant="slide-right" dataTestId="test-variant">
        <span>Slide Right</span>
      </ContentCrossfade>
    );
    expect(screen.getByTestId('test-variant')).toHaveClass('animate-view-slide-right');
  });

  it('merges custom className and passes inline styles', () => {
    render(
      <ContentCrossfade
        transitionKey="styled-key"
        className="custom-layout-class space-y-4"
        style={{ minHeight: '120px' }}
        dataTestId="styled-crossfade"
      >
        <div>Styled Content</div>
      </ContentCrossfade>
    );

    const el = screen.getByTestId('styled-crossfade');
    expect(el).toHaveClass('custom-layout-class', 'space-y-4');
    expect(el).toHaveStyle({ minHeight: '120px' });
  });
});
