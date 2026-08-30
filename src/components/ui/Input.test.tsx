import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Input } from './Input';

describe('Input component', () => {
  it('should render input and handle text changes', () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Search books..." onChange={handleChange} />);

    const input = screen.getByPlaceholderText('Search books...');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Frankenstein' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('should render clear button when onClear is provided and value is not empty', () => {
    const handleClear = vi.fn();
    render(<Input value="Plato" onChange={() => {}} onClear={handleClear} />);

    const clearButton = screen.getByLabelText('Clear input');
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});

