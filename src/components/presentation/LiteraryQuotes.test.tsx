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
});

