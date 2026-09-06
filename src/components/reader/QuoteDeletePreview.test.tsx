import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QuoteDeletePreview } from './QuoteDeletePreview';

describe('QuoteDeletePreview', () => {
  it('renders selectedText within quotes', () => {
    render(<QuoteDeletePreview selectedText="All human wisdom is contained in these two words." />);

    expect(
      screen.getByText(/All human wisdom is contained in these two words\./)
    ).toBeInTheDocument();
  });

  it('renders note when provided', () => {
    render(
      <QuoteDeletePreview
        selectedText="To be or not to be"
        note="Famous soliloquy"
      />
    );

    expect(screen.getByText(/To be or not to be/)).toBeInTheDocument();
    expect(screen.getByText('Note:')).toBeInTheDocument();
    expect(screen.getByText(/Famous soliloquy/)).toBeInTheDocument();
  });

  it('does not render note section when note is null or omitted', () => {
    render(<QuoteDeletePreview selectedText="A simple quote" note={null} />);

    expect(screen.getByText(/A simple quote/)).toBeInTheDocument();
    expect(screen.queryByText('Note:')).not.toBeInTheDocument();
  });
});
