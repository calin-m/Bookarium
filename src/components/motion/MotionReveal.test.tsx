import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MotionReveal } from './MotionReveal';

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
});

