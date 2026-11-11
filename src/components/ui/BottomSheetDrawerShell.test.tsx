import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Filter } from 'lucide-react';
import {
  BottomSheetDrawerShell,
  splitCsvTokens,
  toggleCsvToken,
} from './BottomSheetDrawerShell';

describe('BottomSheetDrawerShell & CSV token helpers', () => {
  it('splits and toggles CSV filter tokens accurately', () => {
    expect(splitCsvTokens('fiction, philosophy , poetry')).toEqual([
      'fiction',
      'philosophy',
      'poetry',
    ]);
    expect(toggleCsvToken('fiction,poetry', 'philosophy')).toBe(
      'fiction,poetry,philosophy'
    );
    expect(toggleCsvToken('fiction,poetry', 'fiction')).toBe('poetry');
    expect(toggleCsvToken('fiction,poetry', '')).toBe('');
  });

  it('renders nothing when closed and handles Escape, backdrop click, reset, and apply actions when open', () => {
    const onClose = vi.fn();
    const onResetAll = vi.fn();
    const onApply = vi.fn();

    const { rerender } = render(
      <BottomSheetDrawerShell
        isOpen={false}
        onClose={onClose}
        titleId="test-drawer-title"
        title="Advanced Filters"
        subtitle="Refine catalog"
        icon={<Filter className="w-4 h-4" />}
        dialogTestId="drawer-dialog"
        backdropTestId="drawer-backdrop"
        resetBtnTestId="drawer-reset"
        applyBtnTestId="drawer-apply"
        onResetAll={onResetAll}
        onApply={onApply}
      >
        <div>Body Content</div>
      </BottomSheetDrawerShell>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <BottomSheetDrawerShell
        isOpen={true}
        onClose={onClose}
        titleId="test-drawer-title"
        title="Advanced Filters"
        subtitle="Refine catalog"
        icon={<Filter className="w-4 h-4" />}
        dialogTestId="drawer-dialog"
        backdropTestId="drawer-backdrop"
        closeBtnTestId="drawer-close"
        resetBtnTestId="drawer-reset"
        applyBtnTestId="drawer-apply"
        activeCount={3}
        onResetAll={onResetAll}
        onApply={onApply}
      >
        <div>Body Content</div>
      </BottomSheetDrawerShell>
    );

    expect(
      screen.getByRole('dialog', { name: 'Advanced Filters' })
    ).toBeInTheDocument();
    expect(screen.getByText('Body Content')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('drawer-reset'));
    expect(onResetAll).toHaveBeenCalledTimes(1);

    const applyBtn = screen.getByTestId('drawer-apply');
    expect(applyBtn).toHaveTextContent('Show Results (3)');
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
