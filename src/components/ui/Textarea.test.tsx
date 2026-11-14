import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea component', () => {
  it('forwards ref, applies variant styles without forcing resize-none on reader variant, and handles change events', () => {
    const ref = createRef<HTMLTextAreaElement>();
    const onChange = vi.fn();

    const { rerender } = render(
      <Textarea
        ref={ref}
        aria-label="Scholar bio"
        placeholder="Write bio..."
        value=""
        onChange={onChange}
      />
    );

    const defaultArea = screen.getByRole('textbox', { name: 'Scholar bio' });
    expect(ref.current).toBe(defaultArea);
    expect(defaultArea).toHaveClass('rounded-xl', 'resize-none', 'bg-card');

    fireEvent.change(defaultArea, { target: { value: 'Montaigne reader' } });
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(
      <Textarea
        variant="subtle"
        aria-label="Reflection note"
        value=""
        onChange={onChange}
      />
    );
    expect(screen.getByRole('textbox', { name: 'Reflection note' })).toHaveClass(
      'p-2.5',
      'rounded-lg',
      'resize-none'
    );

    rerender(
      <Textarea
        variant="reader"
        aria-label="Reader marginalia"
        value=""
        onChange={onChange}
      />
    );
    const readerArea = screen.getByRole('textbox', { name: 'Reader marginalia' });
    expect(readerArea).toHaveClass('p-2', 'rounded-md', 'bg-white');
    expect(readerArea).not.toHaveClass('resize-none');

    rerender(
      <Textarea
        variant="reader"
        aria-label="Popover marginalia"
        value=""
        onChange={onChange}
        className="bg-stone-50/50 resize-none"
      />
    );
    const popoverArea = screen.getByRole('textbox', { name: 'Popover marginalia' });
    expect(popoverArea).toHaveClass('bg-stone-50/50', 'resize-none');
    expect(popoverArea).not.toHaveClass('bg-white');
  });
});
