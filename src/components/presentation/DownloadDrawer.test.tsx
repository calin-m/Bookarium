import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { DownloadDrawer } from './DownloadDrawer';
import { mockBooks } from '@/mocks/handlers';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import type { GutendexBook } from '@/types/book.types';

describe('DownloadDrawer component', () => {
  beforeEach(() => {
    useJurisdictionStore.setState({
      country: 'US',
      rule: 'US_PUBLIC_DOMAIN',
      overrideCountry: null,
    });
  });

  it('should render download formats when opened with a public domain book in US', () => {
    const handleClose = vi.fn();
    render(
      <DownloadDrawer
        book={mockBooks[0]}
        isOpen={true}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('Zero-Copyright Download Hub')).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('EPUB E-Reader')).toBeInTheDocument();
    expect(screen.getByText('Clean Plain Text')).toBeInTheDocument();
    expect(screen.getAllByText('Download').length).toBeGreaterThan(0);
    expect(screen.getByText('Public Domain')).toBeInTheDocument();
  });

  it('should return null when book is null', () => {
    const { container } = render(
      <DownloadDrawer book={null} isOpen={true} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should neutralize download links and show legal banner when book is protected in UK', () => {
    act(() => {
      useJurisdictionStore.getState().setCountry('GB');
    });

    const christieBook: GutendexBook = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      subjects: ['Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: { 'application/epub+zip': 'https://example.com/epub' },
      download_count: 500,
    };

    render(
      <DownloadDrawer
        book={christieBook}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Regional Copyright Notice')).toBeInTheDocument();
    expect(screen.getByText(/Protected in GB/i)).toBeInTheDocument();
    expect(screen.getByText(/Downloads Withheld Under Local Copyright Law/i)).toBeInTheDocument();
    expect(screen.getByText(/January 1, 2047/i)).toBeInTheDocument();
    // Verify zero download buttons are present in the DOM
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });

  it('should provide canonical Gutenberg download links even if book.formats is empty', () => {
    const minimalBook = {
      ...mockBooks[0],
      formats: {},
    };

    render(
      <DownloadDrawer
        book={minimalBook}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const downloadButtons = screen.getAllByText('Download');
    expect(downloadButtons.length).toBe(4);
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
  });
});
