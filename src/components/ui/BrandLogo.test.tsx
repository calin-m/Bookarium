import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrandLogo } from './BrandLogo';

describe('BrandLogo component', () => {
  it('renders default soaring book emblem with optically centered viewBox and default attributes', () => {
    render(<BrandLogo />);

    const logo = screen.getByTestId('brand-monogram-icon');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('viewBox', '30 38 456 456');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo).toHaveClass('w-8', 'h-8');

    // Default idPrefix 'brand'
    const leftWing = logo.querySelector('#brand-outer-left-wing');
    expect(leftWing).toBeInTheDocument();
    expect(leftWing).toHaveAttribute('fill', 'url(#brand-grad-wing-left)');

    const centerRight = logo.querySelector('#brand-center-right');
    expect(centerRight).toBeInTheDocument();
    expect(centerRight).toHaveAttribute('fill', 'url(#brand-grad-center-right)');
  });

  it('correctly namespaces gradient IDs and fill references using custom idPrefix', () => {
    const { container } = render(<BrandLogo idPrefix="navbar" testId="navbar-logo" />);

    const logo = screen.getByTestId('navbar-logo');
    expect(logo).toBeInTheDocument();

    const defs = container.querySelector('defs');
    expect(defs).toBeInTheDocument();

    // Verify all gradient IDs start with 'navbar-'
    const wingGrad = defs?.querySelector('#navbar-grad-wing-left');
    expect(wingGrad).toBeInTheDocument();

    const shadowMiddle = defs?.querySelector('#navbar-shadow-middle-left');
    expect(shadowMiddle).toBeInTheDocument();

    const gutterCenter = defs?.querySelector('#navbar-gutter-center-left');
    expect(gutterCenter).toBeInTheDocument();

    // Verify path fill attributes reference 'navbar-'
    const middleLeftPath = logo.querySelector('#navbar-middle-left');
    expect(middleLeftPath).toHaveAttribute('fill', 'url(#navbar-grad-middle-left)');
  });

  it('applies custom className and forwards extra SVG attributes', () => {
    render(
      <BrandLogo
        className="w-16 h-16 animate-pulse"
        testId="custom-emblem"
        idPrefix="loading"
        data-custom-attribute="bookarium-v6"
      />
    );

    const logo = screen.getByTestId('custom-emblem');
    expect(logo).toHaveClass('w-16', 'h-16', 'animate-pulse');
    expect(logo).toHaveAttribute('data-custom-attribute', 'bookarium-v6');
  });

  it('removes aria-hidden when an explicit aria-label is provided for accessibility', () => {
    render(
      <BrandLogo
        aria-label="Bookarium brand emblem"
        role="img"
        testId="accessible-logo"
      />
    );

    const logo = screen.getByRole('img', { name: 'Bookarium brand emblem' });
    expect(logo).toBeInTheDocument();
    expect(logo).not.toHaveAttribute('aria-hidden');
  });
});
