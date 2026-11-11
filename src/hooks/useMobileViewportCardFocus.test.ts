import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobileViewportCardFocus } from './useMobileViewportCardFocus';

describe('useMobileViewportCardFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', {
      value: 390,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
      configurable: true,
    });
  });

  it('focuses the first card near the top of the page on mobile and clears on outside pointerdown', () => {
    const container = document.createElement('div');
    container.id = 'test-cards-container';
    const card1 = document.createElement('div');
    card1.setAttribute('data-test-card-id', '1342');
    const card2 = document.createElement('div');
    card2.setAttribute('data-test-card-id', '84');
    container.appendChild(card1);
    container.appendChild(card2);
    document.body.appendChild(container);

    const onActiveIdChange = vi.fn();

    renderHook(() =>
      useMobileViewportCardFocus<number>({
        containerId: 'test-cards-container',
        cardDataAttribute: 'data-test-card-id',
        parseCardId: (raw) => (raw ? Number(raw) : null),
        onActiveIdChange,
      })
    );

    expect(onActiveIdChange).toHaveBeenCalledWith(1342);

    // Clicking outside cards clears active focus
    act(() => {
      document.body.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true })
      );
    });

    expect(onActiveIdChange).toHaveBeenLastCalledWith(null);
  });
});
