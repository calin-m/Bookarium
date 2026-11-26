import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuickColorSwatchPopover } from './QuickColorSwatchPopover';

describe('QuickColorSwatchPopover', () => {
  it('toggles color picker popover and invokes onSelectColor when a swatch is chosen', async () => {
    const onSelectColor = vi.fn();

    render(
      <QuickColorSwatchPopover
        annotationId="ann-1"
        activeColor="yellow"
        savedColor="yellow"
        isEditing={false}
        onSelectColor={onSelectColor}
      />
    );

    const trigger = screen.getByTestId('color-badge-btn-ann-1');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('quick-color-popover-ann-1')).toBeInTheDocument();
    expect(screen.getByTestId('quick-color-btn-ann-1-sky')).toBeInTheDocument();
    expect(screen.getByTestId('quick-color-btn-ann-1-lavender')).toBeInTheDocument();
    expect(screen.getByTestId('quick-color-btn-ann-1-indigo')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('quick-color-btn-ann-1-indigo'));
    });
    expect(onSelectColor).toHaveBeenCalledWith('ann-1', 'indigo');
    expect(screen.queryByTestId('quick-color-popover-ann-1')).not.toBeInTheDocument();
  });
});
