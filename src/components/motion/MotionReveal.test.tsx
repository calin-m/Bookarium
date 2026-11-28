import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MotionReveal } from './MotionReveal';
import { StaggerGroup } from './StaggerGroup';

describe('MotionReveal component', () => {
  it('should render children elements properly', () => {
    render(
      <MotionReveal className="custom-test-class">
        <span>Animated Content</span>
      </MotionReveal>
    );

    expect(screen.getByText('Animated Content')).toBeInTheDocument();
    expect(screen.getByText('Animated Content').parentElement).toHaveClass('custom-test-class');
  });

  it('supports staggerChild and disabled modes cleanly inside StaggerGroup', () => {
    render(
      <StaggerGroup data-testid="stagger-wrap" disabled>
        <MotionReveal staggerChild disabled className="stagger-item">
          <span>Child Reveal</span>
        </MotionReveal>
        <MotionReveal disabled>
          <span>Standalone Disabled</span>
        </MotionReveal>
      </StaggerGroup>
    );

    expect(screen.getByTestId('stagger-wrap')).toBeInTheDocument();
    expect(screen.getByText('Child Reveal').parentElement).toHaveClass('stagger-item');
    expect(screen.getByText('Standalone Disabled')).toBeInTheDocument();
  });
});

