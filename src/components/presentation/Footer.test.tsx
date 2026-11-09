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
    expect(screen.getByText(/Wikidata Knowledge Graph/i)).toBeInTheDocument();
    expect(screen.getByText(/Booksaw UI Template \(CC BY 4\.0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Antigravity \(AI Co-Engineer\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero API Keys Required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/streaming 70,000\+ public domain volumes from Project Gutenberg/i)
    ).toBeInTheDocument();

    const wikidataLink = screen.getByRole('link', { name: /Wikidata Knowledge Graph/i });
    expect(wikidataLink).toHaveAttribute('href', 'https://www.wikidata.org');
    expect(wikidataLink).toHaveAttribute('target', '_blank');

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
    expect(privacyLink).toHaveClass('py-1');

    const copyrightLink = screen.getByRole('link', { name: /Copyright & Licensing/i });
    expect(copyrightLink).toHaveAttribute('href', '/copyright');
    expect(copyrightLink).toHaveClass('py-1');
  });

  it('should apply responsive footer padding and centered copyright text alignment', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    expect(footer).toHaveClass(
      'pt-10',
      'sm:pt-14',
      'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
      'sm:pb-5'
    );

    const copyrightText = screen.getByText(/Designed for Literature/i);
    expect(copyrightText).toHaveClass('text-center', 'sm:text-left');

    const wikidataLink = screen.getByRole('link', { name: /Wikidata Knowledge Graph/i });
    expect(wikidataLink).toHaveClass('py-1');
    expect(screen.getByTestId('brand-monogram-icon')).toHaveAttribute('viewBox', '30 38 456 456');
  });
});
