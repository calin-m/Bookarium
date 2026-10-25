import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LiteraryQuotes } from './LiteraryQuotes';

describe('LiteraryQuotes component', () => {
  it('should render section heading, kicker, and 3 literary quote cards', () => {
    render(<LiteraryQuotes />);

    expect(screen.getByText(/Words That Shaped Humanity/i)).toBeInTheDocument();
    expect(screen.getByText(/TIMELESS VOICES & PASSAGES/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Discover more literary quotes/i)).toBeInTheDocument();

    const readLinks = screen.getAllByRole('link', { name: /Read/i });
    expect(readLinks.length).toBe(3);
  });

  it('should shuffle quotes when clicking Discover More button', () => {
    render(<LiteraryQuotes />);

    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);
    fireEvent.click(shuffleBtn);

    const readLinks = screen.getAllByRole('link', { name: /Read/i });
    expect(readLinks.length).toBe(3);
  });

  it('should have links pointing to valid /read/[id] routes', () => {
    render(<LiteraryQuotes />);

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/\/read\/\d+/);
    });
  });

  it('should cleanly unmount without errors during active shuffle', () => {
    const { unmount } = render(<LiteraryQuotes />);
    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);
    fireEvent.click(shuffleBtn);
    expect(() => unmount()).not.toThrow();
  });

  it('filters out quotes from protected authors in Life+100 jurisdiction (Mexico)', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { act } = await import('@testing-library/react');

    act(() => {
      useJurisdictionStore.getState().setCountry('MX');
    });

    render(<LiteraryQuotes />);

    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);

    // Shuffle 5 times under Mexico jurisdiction; Gatsby and Sherlock Holmes must never appear
    for (let i = 0; i < 5; i++) {
      act(() => {
        fireEvent.click(shuffleBtn);
      });
      expect(screen.queryByText(/The Great Gatsby/i)).toBeNull();
      expect(screen.queryByText(/The Adventures of Sherlock Holmes/i)).toBeNull();
    }

    // Reset back to US
    act(() => {
      useJurisdictionStore.getState().setCountry('US');
    });
  });

  it('maintains strictly unique quote IDs and Project Gutenberg bookIds across all anthology entries', async () => {
    const { LITERARY_QUOTES } = await import('@/config/literary-quotes');
    const quoteIds = LITERARY_QUOTES.map((q) => q.id);
    const bookIds = LITERARY_QUOTES.map((q) => q.bookId);

    expect(new Set(quoteIds).size).toBe(LITERARY_QUOTES.length);
    expect(new Set(bookIds).size).toBe(LITERARY_QUOTES.length);
  });

  it('applies responsive section and balanced header divider spacing classes', () => {
    const { container } = render(<LiteraryQuotes />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('py-10', 'sm:py-16');

    const headerDivider = container.querySelector('.border-b');
    expect(headerDivider).toHaveClass('pb-6', 'sm:pb-8');
  });
});

