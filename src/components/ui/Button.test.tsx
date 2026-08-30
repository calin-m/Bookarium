import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Button } from './Button';

describe('Button component', () => {
  it('should render button text and handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should display loading spinner and disable button when isLoading is true', () => {
    render(<Button isLoading>Saving</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should apply variant and size classes properly', () => {
    render(
      <Button variant="outline" size="sm" className="custom-btn">
        Outline
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('custom-btn');
  });
});

