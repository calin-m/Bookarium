import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl component', () => {
  it('renders accessible toggle group, emits selected values, and applies custom per-option styles', () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl<'light' | 'sepia' | 'dark'>
        ariaLabel="Reading surface"
        value="sepia"
        onChange={onChange}
        className="grid grid-cols-3 gap-2"
        optionClassName="p-2 rounded border"
        inactiveClassName="bg-muted"
        options={[
          { value: 'light', label: 'Light', activeClassName: 'border-primary-600' },
          {
            value: 'sepia',
            label: 'Sepia',
            activeClassName: 'border-amber-500 font-bold',
            testId: 'surface-sepia',
          },
          { value: 'dark', label: 'Dark', activeClassName: 'border-primary-500' },
        ]}
      />
    );

    expect(screen.getByRole('group', { name: 'Reading surface' })).toBeInTheDocument();

    const sepiaBtn = screen.getByTestId('surface-sepia');
    expect(sepiaBtn).toHaveAttribute('aria-pressed', 'true');
    expect(sepiaBtn).toHaveClass('border-amber-500', 'font-bold');

    const darkBtn = screen.getByRole('button', { name: 'Dark' });
    expect(darkBtn).toHaveAttribute('aria-pressed', 'false');
    expect(darkBtn).toHaveClass('bg-muted');

    fireEvent.click(darkBtn);
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('supports custom isSelected tolerance predicates and omitting aria-pressed when disabled', () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl<number>
        value={1.74}
        onChange={onChange}
        isSelected={(opt) => Math.abs(1.74 - opt) < 0.03}
        emitAriaPressed={false}
        activeClassName="selected"
        inactiveClassName="idle"
        options={[
          { value: 1.4, label: '1.4x' },
          { value: 1.75, label: '1.75x' },
        ]}
      />
    );

    const matched = screen.getByRole('button', { name: '1.75x' });
    expect(matched).toHaveClass('selected');
    expect(matched).not.toHaveAttribute('aria-pressed');
  });
});
