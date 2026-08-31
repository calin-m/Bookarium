import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Footer } from './Footer';

describe('Footer component', () => {
  it('should render legal manifesto, links, and attribution', () => {
    render(<Footer />);
    expect(screen.getAllByText(/CC0 Public Domain/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Project Gutenberg Archive/i)).toBeInTheDocument();
    expect(screen.getByText(/Gutendex REST API/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero API Keys Required/i)).toBeInTheDocument();
  });
});
