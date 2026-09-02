import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderDrawerShell } from './ReaderDrawerShell';

describe('ReaderDrawerShell Component', () => {
  it('renders children when open', () => {
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Settings"
        ariaLabel="Settings Drawer"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Drawer Content')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Settings Drawer' })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ReaderDrawerShell
        isOpen={false}
        onClose={vi.fn()}
        title="Settings"
        ariaLabel="Settings Drawer"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    expect(screen.queryByText('Drawer Content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Settings"
        ariaLabel="Settings Drawer"
        closeAriaLabel="Close Settings"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    const closeBtn = screen.getByRole('button', { name: 'Close Settings' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Settings"
        ariaLabel="Settings Drawer"
        backdropTestId="test-backdrop"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    const backdrop = screen.getByTestId('test-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Settings"
        ariaLabel="Settings Drawer"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

