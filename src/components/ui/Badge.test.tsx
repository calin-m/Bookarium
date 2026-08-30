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
  });
});

