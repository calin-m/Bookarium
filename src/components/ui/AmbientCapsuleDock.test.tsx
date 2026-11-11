import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmbientCapsuleDock } from './AmbientCapsuleDock';

describe('AmbientCapsuleDock', () => {
  it('renders the floating capsule dock, ambient aura, and pointer interaction handlers', () => {
    const onPointerEnter = vi.fn();
    const onPointerLeave = vi.fn();
    const onPointerDown = vi.fn();

    const { rerender } = render(
      <AmbientCapsuleDock
        effectiveVisible={true}
        isDockDimmed={false}
        asideTestId="test-ambient-dock"
        auraTestId="test-ambient-aura"
        ariaLabel="Collection quick actions"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
      >
        <span>Search</span>
        <span>Filters</span>
      </AmbientCapsuleDock>
    );

    const dock = screen.getByTestId('test-ambient-dock');
    expect(dock).toHaveAttribute('aria-label', 'Collection quick actions');
    expect(screen.getByTestId('test-ambient-aura')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();

    fireEvent.pointerEnter(dock);
    expect(onPointerEnter).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(dock);
    expect(onPointerLeave).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(dock);
    expect(onPointerDown).toHaveBeenCalledTimes(1);

    rerender(
      <AmbientCapsuleDock
        effectiveVisible={false}
        isDockDimmed={true}
        asideTestId="test-ambient-dock"
        auraTestId="test-ambient-aura"
        ariaLabel="Collection quick actions"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
      >
        <span>Search</span>
      </AmbientCapsuleDock>
    );

    expect(dock.className).toContain('translate-y-24');
  });
});
