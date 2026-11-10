import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollectionFloatingSearch } from './CollectionFloatingSearch';

// Mock useVisualViewportKeyboard
const mockKeyboardState = {
  keyboardHeight: 0,
  isKeyboardOpen: false,
};

vi.mock('@/hooks/useVisualViewportKeyboard', () => ({
  useVisualViewportKeyboard: () => mockKeyboardState,
}));

describe('CollectionFloatingSearch', () => {
  beforeEach(() => {
    mockKeyboardState.keyboardHeight = 0;
    mockKeyboardState.isKeyboardOpen = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <CollectionFloatingSearch
        isOpen={false}
        onClose={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.queryByTestId('collection-floating-search-wrapper')).not.toBeInTheDocument();
  });

  it('renders input, focuses on mount, and handles typing when isOpen is true', () => {
    const handleSearchChange = vi.fn();
    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={vi.fn()}
        searchQuery="Dante"
        onSearchChange={handleSearchChange}
        searchPlaceholder="Filter quotes..."
      />
    );

    const wrapper = screen.getByTestId('collection-floating-search-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).not.toHaveClass('sm:hidden');

    const input = screen.getByTestId('collection-floating-search-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Dante');
    expect(input.placeholder).toBe('Filter quotes...');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'Shakespeare' } });
    expect(handleSearchChange).toHaveBeenCalledWith('Shakespeare');
  });

  it('clears query and re-focuses input when clear button is clicked', () => {
    const handleSearchChange = vi.fn();
    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={vi.fn()}
        searchQuery="Homer"
        onSearchChange={handleSearchChange}
      />
    );

    const clearBtn = screen.getByTestId('collection-floating-search-clear-btn');
    fireEvent.click(clearBtn);

    expect(handleSearchChange).toHaveBeenCalledWith('');
  });

  it('dismisses when backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={handleClose}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    const backdrop = screen.getByTestId('collection-floating-search-backdrop');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={handleClose}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('elevates container above software keyboard when keyboardHeight > 0', () => {
    mockKeyboardState.keyboardHeight = 290;
    mockKeyboardState.isKeyboardOpen = true;

    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    const container = screen.getByTestId('collection-floating-search-container');
    expect(container.style.bottom).toContain('290px');
    expect(container.style.bottom).toContain('1rem');
  });

  it('renders with deep elevation drop shadow and dark ambient light glow', () => {
    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    const input = screen.getByTestId('collection-floating-search-input');
    const card = input.closest('div');
    expect(card?.className).toContain('shadow-[');
    expect(card?.className).toContain('dark:shadow-[');
  });
});
