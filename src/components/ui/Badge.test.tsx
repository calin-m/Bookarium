import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Badge } from './Badge';

describe('Badge component', () => {
  it('should render badge content with variant and size classes', () => {
    render(
      <Badge variant="primary" size="sm" className="custom-badge">
        Public Domain
      </Badge>
    );

    const badge = screen.getByText('Public Domain');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('custom-badge');
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('bg-primary-500/15');
  });

  it('should render success variant correctly', () => {
    render(<Badge variant="success">Completed</Badge>);
    const badge = screen.getByText('Completed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-emerald-500/10');
    expect(badge).toHaveClass('border-emerald-500/30');
  });

  it('should render default secondary variant and md size', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-muted');
    expect(badge).toHaveClass('px-2.5');
  });
});

