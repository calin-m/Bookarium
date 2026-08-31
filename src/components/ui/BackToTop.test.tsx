import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BackToTop } from './BackToTop';

describe('BackToTop Component', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when scrollY is below threshold', () => {
    render(<BackToTop threshold={300} />);
    expect(screen.queryByTestId('back-to-top-btn')).toBeNull();
  });

  it('renders when scrolled past threshold', () => {
    render(<BackToTop threshold={300} />);

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    const btn = screen.getByTestId('back-to-top-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label', 'Back to top');
  });

  it('scrolls smoothly to top when clicked', () => {
    render(<BackToTop threshold={200} />);

    act(() => {
      window.scrollY = 500;
      window.dispatchEvent(new Event('scroll'));
    });

    const btn = screen.getByTestId('back-to-top-btn');
    fireEvent.click(btn);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('hides when scrolling back below threshold', () => {
    render(<BackToTop threshold={300} />);

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByTestId('back-to-top-btn')).toBeInTheDocument();

    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(screen.queryByTestId('back-to-top-btn')).toBeNull();
  });
});