import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SectionHeader, SectionTitle } from './SectionHeader';

describe('SectionTitle', () => {
  it('renders title text inside default h2 with decorative flank lines', () => {
    const { container } = render(<SectionTitle>Test Title</SectionTitle>);

    const heading = screen.getByRole('heading', { level: 2, name: 'Test Title' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('font-serif');

    const lines = container.querySelectorAll('[aria-hidden="true"]');
    expect(lines).toHaveLength(2);
  });

  it('supports custom semantic heading tag and hiding flank lines', () => {
    const { container } = render(
      <SectionTitle as="h1" showFlankLines={false} className="custom-title-wrapper">
        Main Heading
      </SectionTitle>
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Main Heading' });
    expect(heading).toBeInTheDocument();

    const lines = container.querySelectorAll('[aria-hidden="true"]');
    expect(lines).toHaveLength(0);
  });
});

describe('SectionHeader', () => {
  it('renders eyebrow, title, and subtitle correctly', () => {
    render(
      <SectionHeader
        eyebrow="CATEGORY • ARCHIVE"
        title="Public Domain Books"
        subtitle="Exploring timeless literature preserved for humanity."
      />
    );

    expect(screen.getByText('CATEGORY • ARCHIVE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Public Domain Books' })).toBeInTheDocument();
    expect(screen.getByText('Exploring timeless literature preserved for humanity.')).toBeInTheDocument();
  });

  it('renders optional children like buttons or badges', () => {
    render(
      <SectionHeader title="My Shelf">
        <button type="button">Clear Shelf</button>
      </SectionHeader>
    );

    expect(screen.getByRole('heading', { name: 'My Shelf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Shelf' })).toBeInTheDocument();
  });

  it('applies responsive mobile typography, flank line sizing, and vertical margins', () => {
    const { container } = render(
      <SectionHeader
        title="Responsive Section"
        subtitle="Subtitle text"
      />
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Responsive Section' });
    expect(heading).toHaveClass('text-2xl', 'sm:text-4xl');

    const lines = container.querySelectorAll('[aria-hidden="true"]');
    expect(lines[0]).toHaveClass('w-6', 'sm:w-12', 'shrink');

    const rootContainer = container.firstElementChild;
    expect(rootContainer).toHaveClass('mb-5', 'sm:mb-10');
  });
});

