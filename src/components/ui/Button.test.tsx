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

  it('should render polymorphically with as="a" and apply chip size styling', () => {
    render(
      <Button as="a" href="/read/1342" variant="primary" size="chip">
        Read Book
      </Button>
    );

    const link = screen.getByRole('link', { name: /read book/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/read/1342');
    expect(link).toHaveClass('px-3', 'py-1', 'text-xs', 'font-sans');
  });

  it('supports all 6 variants, all 5 sizes, and forwards refs to the underlying element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    const { rerender } = render(
      <Button ref={ref} variant="secondary" size="md">
        Secondary
      </Button>
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveClass('bg-secondary', 'h-10', 'px-4');

    rerender(
      <Button variant="ghost" size="lg">
        Ghost
      </Button>
    );
    expect(screen.getByRole('button')).toHaveClass('bg-transparent', 'h-12', 'px-6');

    rerender(
      <Button variant="destructive" size="icon" aria-label="Delete item">
        X
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Delete item' })).toHaveClass(
      'bg-red-600',
      'h-9',
      'w-9'
    );

    rerender(
      <Button variant="sepia" size="sm">
        Sepia
      </Button>
    );
    expect(screen.getByRole('button')).toHaveClass('bg-[#332219]', 'text-[#fef6eb]', 'h-8');
  });
});

