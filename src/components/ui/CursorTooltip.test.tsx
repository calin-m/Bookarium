import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CursorTooltip } from './CursorTooltip';

describe('CursorTooltip', () => {
  it('renders null when not visible', () => {
    const { container } = render(
      <CursorTooltip isVisible={false} mousePos={{ x: 100, y: 100 }}>
        <span>Tooltip Content</span>
      </CursorTooltip>
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('renders null when mousePos is null', () => {
    const { container } = render(
      <CursorTooltip isVisible={true} mousePos={null}>
        <span>Tooltip Content</span>
      </CursorTooltip>
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('renders in document.body with applied coordinate offsets', () => {
    render(
      <CursorTooltip isVisible={true} mousePos={{ x: 200, y: 300 }}>
        <span>Preview Mode</span>
      </CursorTooltip>
    );

    const tooltip = screen.getByTestId('cursor-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Preview Mode');
    expect(tooltip.style.left).toBe('200px');
    expect(tooltip.style.top).toBe('300px');
    expect(tooltip.style.transform).toBe('translate3d(12px, 14px, 0)');
  });
});

