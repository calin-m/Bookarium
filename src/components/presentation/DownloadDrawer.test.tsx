import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DownloadDrawer } from './DownloadDrawer';
import { mockBooks } from '@/mocks/handlers';

describe('DownloadDrawer component', () => {
  it('should render download formats when opened with a book', () => {
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
  });

  it('should return null when book is null', () => {
    const { container } = render(
      <DownloadDrawer book={null} isOpen={true} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
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

