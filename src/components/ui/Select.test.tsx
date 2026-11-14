import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

describe('Select component', () => {
  it('renders a bare <select> with zero wrapper div by default and forwards ref + optgroups', () => {
    const ref = createRef<HTMLSelectElement>();
    const onChange = vi.fn();

    const { container } = render(
      <Select ref={ref} aria-label="Narrator voice" value="en-1" onChange={onChange}>
        <optgroup label="Natural">
          <option value="en-1">Clara (en-US)</option>
        </optgroup>
        <option value="en-2">Arthur (en-GB)</option>
      </Select>
    );

    const selectEl = screen.getByRole('combobox', { name: 'Narrator voice' });
    expect(ref.current).toBe(selectEl);
    expect(container.firstElementChild).toBe(selectEl);

    fireEvent.change(selectEl, { target: { value: 'en-2' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders relative wrapper, leading icon, and trailing chevron only when configured', () => {
    const { container } = render(
      <Select
        aria-label="Volume selector"
        wrapperClassName="mt-1"
        leftIcon={<span data-testid="select-icon">I</span>}
        rightChevron={<span data-testid="select-chevron">V</span>}
        className="w-full"
      >
        <option value="1342">Pride and Prejudice</option>
      </Select>
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe('DIV');
    expect(wrapper).toHaveClass('relative', 'mt-1');
    expect(screen.getByTestId('select-icon')).toBeInTheDocument();
    expect(screen.getByTestId('select-chevron')).toBeInTheDocument();
  });
});
