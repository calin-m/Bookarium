import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import RouteError from './error';

describe('RouteError Component', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const message = args.map(String).join(' ');
      if (message.includes('[AppRouter:FatalBoundary]')) {
        return;
      }
      console.warn(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders heading, description, and action buttons', () => {
    const resetMock = vi.fn();
    const testError = new Error('Test rendering fault');

    render(<RouteError error={testError} reset={resetMock} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a disturbance in the library/i })).toBeInTheDocument();
    expect(screen.getByText(/the volume or section you requested/i)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('[AppRouter:FatalBoundary]', testError);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to catalog/i })).toHaveAttribute('href', '/');
  });

  it('renders error digest when provided', () => {
    const resetMock = vi.fn();
    const testError = Object.assign(new Error('Cryptic fault'), { digest: '12345abcdef' });

    render(<RouteError error={testError} reset={resetMock} />);

    expect(screen.getByText(/error digest: 12345abcdef/i)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('[AppRouter:FatalBoundary]', testError);
  });

  it('calls reset handler when Try Again button is clicked', () => {
    const resetMock = vi.fn();
    const testError = new Error('Recoverable fault');

    render(<RouteError error={testError} reset={resetMock} />);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[AppRouter:FatalBoundary]', testError);
  });
});

