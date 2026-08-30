import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StaggerGroup } from './StaggerGroup';

describe('StaggerGroup component', () => {
  it('should render staggered child nodes', () => {
    render(
      <StaggerGroup data-testid="stagger-group">
        <div>Item 1</div>
        <div>Item 2</div>
      </StaggerGroup>
    );

    expect(screen.getByTestId('stagger-group')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});

