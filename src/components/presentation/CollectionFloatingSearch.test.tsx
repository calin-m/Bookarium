import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollectionFloatingSearch } from './CollectionFloatingSearch';

// Mock useVisualViewportKeyboard
const mockKeyboardState = {
  keyboardHeight: 0,
  isKeyboardOpen: false,
};

const mockSmartScrollToContent = vi.fn();

vi.mock('@/hooks/useVisualViewportKeyboard', () => ({
  useVisualViewportKeyboard: () => mockKeyboardState,
}));

vi.mock('@/lib/scroll-utils', () => ({
  smartScrollToContent: (...args: unknown[]) => mockSmartScrollToContent(...args),
}));

describe('CollectionFloatingSearch', () => {
  beforeEach(() => {
    mockKeyboardState.keyboardHeight = 0;
    mockKeyboardState.isKeyboardOpen = false;
    mockSmartScrollToContent.mockClear();
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

    // Verifies synchronous focus on mount for mobile WebKit gesture preservation
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

  it('dismisses when pointer down occurs outside the container', () => {
    const handleClose = vi.fn();
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <CollectionFloatingSearch
          isOpen={true}
          onClose={handleClose}
          searchQuery=""
          onSearchChange={vi.fn()}
        />
      </div>
    );

    const outsideEl = screen.getByTestId('outside-element');
    fireEvent.pointerDown(outsideEl);

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
    const form = input.closest('form');
    expect(form?.className).toContain('shadow-[');
    expect(form?.className).toContain('dark:shadow-[');
  });

  it('supports submitOnEnter for Catalog: holds local state and triggers search only on Enter / submit button with 2-char guardrail', () => {
    const handleSearchChange = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={vi.fn()}
        searchQuery=""
        onSearchChange={handleSearchChange}
        submitOnEnter={true}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByTestId('collection-floating-search-input') as HTMLInputElement;
    expect(input.getAttribute('enterkeyhint')).toBe('search');

    // 1. Typing 1 char -> does NOT trigger search or submit button
    fireEvent.change(input, { target: { value: 'a' } });
    expect(handleSearchChange).not.toHaveBeenCalled();
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('collection-floating-search-submit-btn')).not.toBeInTheDocument();

    // Hitting Enter on 1 char -> blocked by 2-character guardrail
    fireEvent.submit(input.closest('form')!);
    expect(handleSearchChange).not.toHaveBeenCalled();
    expect(handleSubmit).not.toHaveBeenCalled();

    // 2. Typing >= 2 chars -> reveals submit button, but does not search until submitted
    fireEvent.change(input, { target: { value: 'tolstoy' } });
    expect(handleSearchChange).not.toHaveBeenCalled();
    expect(handleSubmit).not.toHaveBeenCalled();

    const submitBtn = screen.getByTestId('collection-floating-search-submit-btn');
    expect(submitBtn).toBeInTheDocument();

    // Submit via click
    fireEvent.click(submitBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('tolstoy');
    expect(handleSubmit).toHaveBeenCalledWith('tolstoy');

    // 3. Clear button resets both local and upstream query
    handleSearchChange.mockClear();
    handleSubmit.mockClear();

    const clearBtn = screen.getByTestId('collection-floating-search-clear-btn');
    fireEvent.click(clearBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');
    expect(handleSubmit).toHaveBeenCalledWith('');
    expect(input.value).toBe('');
  });

  it('blurs input and dismisses keyboard on submit, auto-closes, and invokes smartScrollToContent when contentAnchorId is provided', () => {
    const handleSearchChange = vi.fn();
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={handleClose}
        searchQuery="Dostoevsky"
        onSearchChange={handleSearchChange}
        submitOnEnter={false}
        onSubmit={handleSubmit}
        contentAnchorId="test-content-anchor"
      />
    );

    const input = screen.getByTestId('collection-floating-search-input') as HTMLInputElement;
    expect(input.getAttribute('enterkeyhint')).toBe('search');

    const blurSpy = vi.spyOn(input, 'blur');

    // Submit button is present for live collections when text is entered
    const submitBtn = screen.getByTestId('collection-floating-search-submit-btn');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn.getAttribute('title')).toBe('Filter collection (Enter)');

    fireEvent.click(submitBtn);

    // Assert input blurred (dismisses virtual keyboard)
    expect(blurSpy).toHaveBeenCalled();
    // Assert onSubmit called
    expect(handleSubmit).toHaveBeenCalledWith('Dostoevsky');
    // Assert smartScrollToContent called with anchor
    expect(mockSmartScrollToContent).toHaveBeenCalledWith('test-content-anchor', { offsetTop: 80 });
    // Assert autoCloseOnSubmit closed floating search
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('submits on form submit for live collections, blurring input, auto-closing and triggering anchor scroll', () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={handleClose}
        searchQuery="Austen"
        onSearchChange={vi.fn()}
        onSubmit={handleSubmit}
        contentAnchorId="shelf-anchor"
      />
    );

    const input = screen.getByTestId('collection-floating-search-input') as HTMLInputElement;
    const blurSpy = vi.spyOn(input, 'blur');

    fireEvent.submit(input.closest('form')!);

    expect(blurSpy).toHaveBeenCalled();
    expect(handleSubmit).toHaveBeenCalledWith('Austen');
    expect(mockSmartScrollToContent).toHaveBeenCalledWith('shelf-anchor', { offsetTop: 80 });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('preserves open state on submit when autoCloseOnSubmit is explicitly false', () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={handleClose}
        searchQuery="Woolf"
        onSearchChange={vi.fn()}
        onSubmit={handleSubmit}
        autoCloseOnSubmit={false}
      />
    );

    const input = screen.getByTestId('collection-floating-search-input') as HTMLInputElement;
    const blurSpy = vi.spyOn(input, 'blur');

    fireEvent.submit(input.closest('form')!);

    expect(blurSpy).toHaveBeenCalled();
    expect(handleSubmit).toHaveBeenCalledWith('Woolf');
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('proactively blurs virtual keyboard on Enter keydown in the input', () => {
    render(
      <CollectionFloatingSearch
        isOpen={true}
        onClose={vi.fn()}
        searchQuery="Dickens"
        onSearchChange={vi.fn()}
      />
    );

    const input = screen.getByTestId('collection-floating-search-input') as HTMLInputElement;
    const blurSpy = vi.spyOn(input, 'blur');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(blurSpy).toHaveBeenCalled();
  });
});
