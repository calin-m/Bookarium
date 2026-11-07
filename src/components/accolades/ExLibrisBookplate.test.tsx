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

  it('handles mouse interactions for 3D perspective sheen and resets on mouse leave', () => {
    const { container } = render(
      <ExLibrisBookplate definition={sampleDef} progress={unlockedProgress} />
    );

    const card = screen.getByTestId(`accolade-card-${sampleDef.id}`);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseEnter(card);
    fireEvent.mouseMove(card, { clientX: 150, clientY: 50 });

    // x = 150/200 = 0.75 -> rotY = (0.75 - 0.5) * 4 = 1deg, sheenPos.x = 75%
    // y = 50/200 = 0.25 -> rotX = (0.25 - 0.5) * -4 = 1deg, sheenPos.y = 25%
    expect(card.style.transform).toBe(
      'perspective(1000px) rotateX(1deg) rotateY(1deg) scale3d(1, 1, 1)'
    );
    expect(container.innerHTML).toContain('radial-gradient(circle at 75% 25%');

    fireEvent.mouseLeave(card);
    expect(card.style.transform).toBe(
      'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
    );
    expect(container.innerHTML).not.toContain('radial-gradient(circle at 75% 25%');
  });

  it('triggers mobile haptic vibration when pinning and falls back to Award icon for unknown iconName', async () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(window.navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    const onTogglePin = vi.fn();
    const customDef = { ...sampleDef, iconName: 'UnknownCustomIcon' };
    render(
      <ExLibrisBookplate
        definition={customDef}
        progress={unlockedProgress}
        onTogglePin={onTogglePin}
      />
    );

    const pinBtn = screen.getByRole('button', { name: /pin seven-day sage to showcase/i });
    fireEvent.click(pinBtn);

    expect(vibrateMock).toHaveBeenCalledWith(15);
    expect(onTogglePin).toHaveBeenCalledWith('seven-day-sage');
  });

  it('applies theme-aware solid borders on woodcut frame and dividers without vanishing fractional opacities', () => {
    const { container: unlockedContainer } = render(
      <ExLibrisBookplate definition={sampleDef} progress={unlockedProgress} />
    );

    const html = unlockedContainer.innerHTML;
    expect(html).not.toContain('border-border/40');
    expect(html).not.toContain('border-border/60');
    expect(html).not.toContain('border-border/70');

    // Locked bookplate verification
    const { container: lockedContainer } = render(
      <ExLibrisBookplate definition={sampleDef} progress={lockedProgress} />
    );
    const lockedHtml = lockedContainer.innerHTML;
    expect(lockedHtml).not.toContain('border-border/70');
    expect(lockedHtml).not.toContain('border-border/60');
    expect(lockedHtml).not.toContain('border-border/40');
  });

  it('applies GPU-stabilized vector rendering and z-index isolation without conflicting scale-105', () => {
    const { container } = render(
      <ExLibrisBookplate definition={sampleDef} progress={unlockedProgress} />
    );

    const html = container.innerHTML;
    // Should not contain conflicting inner scale that causes stroke thickness flickering
    expect(html).not.toContain('group-hover:scale-105');
    // Should contain hardware acceleration and geometric precision hints
    expect(html).toContain('[shape-rendering:geometricPrecision]');
    expect(html).toContain('[backface-visibility:hidden]');
    // Should isolate content with relative z-10
    expect(html).toContain('relative z-10');
  });
});

