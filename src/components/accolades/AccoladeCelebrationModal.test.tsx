import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccoladeCelebrationModal } from './AccoladeCelebrationModal';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';

describe('AccoladeCelebrationModal', () => {
  const sampleAccolade = ACCOLADES_CATALOG[0]; // Seven-Day Sage

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when activeAccolade is null', () => {
    const { container } = render(<AccoladeCelebrationModal accolade={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders celebration details when an accolade is provided', () => {
    render(<AccoladeCelebrationModal accolade={sampleAccolade} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ex-Libris Accolade Bestowed')).toBeInTheDocument();
    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    expect(screen.getByText('“Nulla Dies Sine Linea”')).toBeInTheDocument();
    expect(screen.getByText(sampleAccolade.description)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /place in ex-libris collection/i })).toBeInTheDocument();
  });

  it('dismisses when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<AccoladeCelebrationModal accolade={sampleAccolade} onDismiss={onDismiss} />);

    const closeBtn = screen.getByRole('button', { name: /dismiss celebration/i });
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when backdrop is clicked', () => {
    const onDismiss = vi.fn();
    render(<AccoladeCelebrationModal accolade={sampleAccolade} onDismiss={onDismiss} />);

    const backdrop = screen.getByTestId('accolade-celebration-modal');
    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when Escape key is pressed', () => {
    const onDismiss = vi.fn();
    render(<AccoladeCelebrationModal accolade={sampleAccolade} onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

