import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Card } from './Card';

describe('Card component', () => {
  it('should render card children properly', () => {
    render(
      <Card variant="glass" data-testid="card-element">
        <p>Book Details</p>
      </Card>
    );

    expect(screen.getByTestId('card-element')).toBeInTheDocument();
    expect(screen.getByText('Book Details')).toBeInTheDocument();
    expect(screen.getByTestId('card-element')).toHaveClass('backdrop-blur-md');
  });
});

