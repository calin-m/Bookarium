import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExLibrisBookplate } from './ExLibrisBookplate';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';
import { AccoladeProgress } from '@/types/accolades.types';

describe('ExLibrisBookplate', () => {
  const sampleDef = ACCOLADES_CATALOG[0]; // 'seven-day-sage'

  const unlockedProgress: AccoladeProgress = {
    id: 'seven-day-sage',
    current: 7,
    target: 7,
    percent: 100,
    isUnlocked: true,
    unlockedAt: '2026-09-07T12:00:00.000Z',
    isPinned: false,
  };

  const lockedProgress: AccoladeProgress = {
    id: 'seven-day-sage',
    current: 3,
    target: 7,
    percent: 43,
    isUnlocked: false,
    isPinned: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, Latin motto, and description', () => {
    render(<ExLibrisBookplate definition={sampleDef} progress={unlockedProgress} />);

    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    expect(screen.getByText('“Nulla Dies Sine Linea”')).toBeInTheDocument();
    expect(screen.getByText(sampleDef.description)).toBeInTheDocument();
    expect(screen.getByText('Parchment Bronze')).toBeInTheDocument();
  });

  it('displays unlocked state with date and interactive pin button', () => {
    const onTogglePin = vi.fn();
    render(
      <ExLibrisBookplate
        definition={sampleDef}
        progress={unlockedProgress}
        onTogglePin={onTogglePin}
      />
    );

    expect(screen.getByText('Unlocked')).toBeInTheDocument();
    const pinBtn = screen.getByRole('button', { name: /pin seven-day sage to showcase/i });
    expect(pinBtn).toBeInTheDocument();

    fireEvent.click(pinBtn);
    expect(onTogglePin).toHaveBeenCalledWith('seven-day-sage');
  });

  it('displays pinned state when isPinned is true', () => {
    const onTogglePin = vi.fn();
    render(
      <ExLibrisBookplate
        definition={sampleDef}
        progress={{ ...unlockedProgress, isPinned: true }}
        onTogglePin={onTogglePin}
      />
    );

    const unpinBtn = screen.getByRole('button', { name: /unpin seven-day sage/i });
    expect(unpinBtn).toBeInTheDocument();
    expect(unpinBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('displays locked state with progress indicator and lock icon', () => {
    render(<ExLibrisBookplate definition={sampleDef} progress={lockedProgress} />);

    expect(screen.queryByText('Unlocked')).not.toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('3 / 7 days')).toBeInTheDocument();
    // Pin button should not exist for locked accolades
    expect(screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
  });

  it('disables pinning when isPinningDisabled is true and item is not already pinned', () => {
    const onTogglePin = vi.fn();
    render(
      <ExLibrisBookplate
        definition={sampleDef}
        progress={unlockedProgress}
        onTogglePin={onTogglePin}
        isPinningDisabled={true}
      />
    );

    const pinBtn = screen.getByRole('button', { name: /pin seven-day sage to showcase/i });
    expect(pinBtn).toBeDisabled();
  });

  it('handles mouse interactions for 3D perspective sheen without crashing', () => {
    const { container } = render(
      <ExLibrisBookplate definition={sampleDef} progress={unlockedProgress} />
    );

    const card = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(card);
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });
    fireEvent.mouseLeave(card);
  });
});

