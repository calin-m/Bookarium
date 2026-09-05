import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Footer } from './Footer';

describe('Footer component', () => {
  it('should render legal manifesto, links, and attribution', () => {
    render(<Footer />);
    expect(screen.getAllByText(/CC0 Public Domain/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Sources & Credits/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Gutenberg Archive/i)).toBeInTheDocument();
    expect(screen.getByText(/Gutendex REST API/i)).toBeInTheDocument();
    expect(screen.getByText(/Booksaw UI Template \(CC BY 4\.0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Antigravity \(AI Co-Engineer\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero API Keys Required/i)).toBeInTheDocument();

    const booksawLink = screen.getByRole('link', { name: /Booksaw UI Template/i });
    expect(booksawLink).toHaveAttribute(
      'href',
      'https://www.figma.com/community/file/1521831984874247291/booksaw-bookstore-ecommerce-website-design-template'
    );
    expect(booksawLink).toHaveAttribute('target', '_blank');

    const antigravityLink = screen.getByRole('link', { name: /Google Antigravity/i });
    expect(antigravityLink).toHaveAttribute('href', 'https://antigravity.google');
    expect(antigravityLink).toHaveAttribute('target', '_blank');

    const githubLinks = screen.getAllByRole('link', { name: /bookarium/i });
    expect(githubLinks.length).toBeGreaterThanOrEqual(1);
    expect(githubLinks[0]).toHaveAttribute('href', 'https://github.com/calin-m/Bookarium');

    const privacyLink = screen.getByRole('link', { name: /Privacy & Data Architecture/i });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });
});
