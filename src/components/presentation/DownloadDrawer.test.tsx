import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { DownloadDrawer } from './DownloadDrawer';
import { mockBooks } from '@/mocks/handlers';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import type { GutendexBook } from '@/types/book.types';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBookIds: vi.fn().mockResolvedValue([]),
  getAllOfflineBookMetas: vi.fn().mockResolvedValue([]),
  getOfflineBook: vi.fn().mockResolvedValue(null),
  saveOfflineBook: vi.fn().mockResolvedValue(undefined),
  removeOfflineBook: vi.fn().mockResolvedValue(undefined),
  getStorageQuota: vi.fn().mockResolvedValue(null),
  OFFLINE_BOOKS_UPDATED_EVENT: 'bookarium:offline-updated',
  notifyOfflineStorageChanged: vi.fn(),
}));

describe('DownloadDrawer component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const storage = await import('@/lib/offline-storage');
    vi.mocked(storage.getOfflineBookIds).mockResolvedValue([]);
    vi.mocked(storage.getOfflineBook).mockResolvedValue(null);
    useJurisdictionStore.setState({
      country: 'US',
      rule: 'US_PUBLIC_DOMAIN',
      overrideCountry: null,
    });
  });

  it('should render active plain-text export and disabled Coming Soon formats with zero external Gutenberg hotlinks', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <DownloadDrawer
        book={mockBooks[0]}
        isOpen={true}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('Download Hub')).toBeInTheDocument();
    const titleEl = screen.getByText('Pride and Prejudice');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl).toHaveClass('line-clamp-2');
    const copyMeta = screen.getByTestId(`download-drawer-copy-meta-${mockBooks[0].id}`);
    expect(copyMeta).toHaveAttribute('data-tooltip', 'Pride and Prejudice — by Jane Austen');
    expect(screen.getByText('EPUB E-Reader')).toBeInTheDocument();
    expect(screen.getByText('Clean Plain Text')).toBeInTheDocument();
    expect(screen.getByText('Public Domain')).toBeInTheDocument();

    const formatsGrid = screen.getByTestId('download-formats-grid');
    expect(formatsGrid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2');
    expect(within(formatsGrid).queryAllByRole('link')).toHaveLength(0);
    expect(container.querySelectorAll('a[href*="gutenberg"]')).toHaveLength(0);

    const txtRow = screen.getByTestId('download-format-row-.txt');
    expect(within(txtRow).getByText('Default')).toBeInTheDocument();
    expect(
      within(txtRow).getByRole('button', { name: `Download ${mockBooks[0].title} as plain text (.txt)` })
    ).not.toBeDisabled();

    const epubRow = screen.getByTestId('download-format-row-.epub');
    const mobiRow = screen.getByTestId('download-format-row-.mobi');
    const htmlRow = screen.getByTestId('download-format-row-.html');
    [epubRow, mobiRow, htmlRow].forEach((row) => {
      const btn = within(row).getByRole('button', { name: /coming soon/i });
      expect(btn).toBeDisabled();
      expect(within(row).queryByText('Default')).not.toBeInTheDocument();
    });
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

  it('should expose same-origin plain-text download and Coming Soon states even when book.formats is empty', () => {
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

    const downloadButtons = screen.getAllByRole('button', { name: /as plain text \(\.txt\)/i });
    expect(downloadButtons).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /coming soon/i })).toHaveLength(3);
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
  });

  it('fetches plain text via /api/books/content and triggers sanitized Blob download on click', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('It is a truth universally acknowledged.', { status: 200 }));
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:https://bookarium.app/mock-txt');
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlSpy,
    });

    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    const clickSpy = vi.fn();
    HTMLAnchorElement.prototype.click = clickSpy;
    let appendedDownloadName = '';
    const originalAppendChild = document.body.appendChild.bind(document.body);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        appendedDownloadName = node.download;
      }
      return originalAppendChild(node);
    });

    try {
      render(
        <DownloadDrawer
          book={mockBooks[0]}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const txtDownloadBtn = screen.getByRole('button', {
        name: `Download ${mockBooks[0].title} as plain text (.txt)`,
      });

      await act(async () => {
        fireEvent.click(txtDownloadBtn);
      });

      expect(fetchSpy).toHaveBeenCalledWith(`/api/books/content?id=${mockBooks[0].id}`);
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
      expect(appendedDownloadName).toBe('pride-and-prejudice-pg1342.txt');
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:https://bookarium.app/mock-txt');
      expect(screen.getByTestId('download-txt-success')).toHaveTextContent(
        'Plain text (.txt) download started.'
      );
    } finally {
      HTMLAnchorElement.prototype.click = originalAnchorClick;
      appendSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it('displays inline error banner without downloading when /api/books/content returns 404', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Plain text unavailable in R2.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(
      <DownloadDrawer
        book={mockBooks[0]}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const txtDownloadBtn = screen.getByRole('button', {
      name: `Download ${mockBooks[0].title} as plain text (.txt)`,
    });

    await act(async () => {
      fireEvent.click(txtDownloadBtn);
    });

    const errBanner = screen.getByTestId('download-txt-error');
    expect(errBanner).toHaveTextContent('Plain text unavailable in R2.');
    expect(screen.queryByTestId('download-txt-success')).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('should render content advisory banner when book contains mature subjects', () => {
    const matureBook: GutendexBook = {
      ...mockBooks[0],
      id: 99999,
      title: 'Memoirs of a Woman of Pleasure',
      subjects: ['Erotic literature', 'Prostitution -- England -- Fiction'],
      bookshelves: ['Banned Books'],
    };

    render(
      <DownloadDrawer
        book={matureBook}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Historical Content Advisory')).toBeInTheDocument();
    expect(screen.getByText(/Erotic literature/i)).toBeInTheDocument();
  });

  it('renders Browser Offline Cache card and allows saving and removing book for offline reading', async () => {
    const { getOfflineBookIds, saveOfflineBook, removeOfflineBook } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('Full text for offline cache', { status: 200 }));

    render(
      <DownloadDrawer
        book={mockBooks[0]}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByTestId('download-drawer-offline-card')).toBeInTheDocument();
    const saveOfflineBtn = screen.getByRole('button', { name: `Save ${mockBooks[0].title} for offline reading` });
    expect(saveOfflineBtn).toBeInTheDocument();

    vi.mocked(getOfflineBookIds).mockResolvedValue([mockBooks[0].id]);

    await act(async () => {
      fireEvent.click(saveOfflineBtn);
    });

    expect(saveOfflineBook).toHaveBeenCalledWith(
      mockBooks[0].id,
      mockBooks[0].title,
      'Full text for offline cache',
      mockBooks[0].authors
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: `Remove offline copy of ${mockBooks[0].title}` })).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: `Remove offline copy of ${mockBooks[0].title}` });
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    await act(async () => {
      fireEvent.click(removeBtn);
    });

    const confirmModal = screen.getByTestId('remove-offline-book-dialog');
    expect(confirmModal).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(confirmModal).getByRole('button', { name: /remove download/i }));
    });

    expect(removeOfflineBook).toHaveBeenCalledWith(mockBooks[0].id);
    fetchSpy.mockRestore();
  });

  it('displays Offline Mode Notice Banner, disables external format links and Save Offline when offline and book is not cached', async () => {
    const { getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    const networkModule = await import('@/hooks/useNetworkStatus');
    const networkSpy = vi.spyOn(networkModule, 'useNetworkStatus').mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    render(
      <DownloadDrawer
        book={mockBooks[0]}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const banner = screen.getByTestId('download-drawer-offline-mode-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Offline Mode Active/i);
    expect(banner).toHaveTextContent(/You can only remove already-downloaded books/i);

    const saveOfflineBtn = screen.getByRole('button', { name: `Save ${mockBooks[0].title} for offline reading` });
    expect(saveOfflineBtn).toBeDisabled();

    // Uncached plain text shows disabled Offline button while unbuilt formats remain Coming Soon
    expect(screen.queryByRole('link', { name: /Download/i })).not.toBeInTheDocument();
    const offlineFormatButtons = screen.getAllByRole('button', { name: 'Offline' });
    expect(offlineFormatButtons.length).toBe(1);
    expect(offlineFormatButtons[0]).toBeDisabled();
    const comingSoonButtons = screen.getAllByRole('button', { name: /coming soon/i });
    expect(comingSoonButtons).toHaveLength(3);
    comingSoonButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    networkSpy.mockRestore();
  });

  it('keeps Remove and cached Plain Text export active when offline and book is already downloaded', async () => {
    const { getOfflineBookIds, getOfflineBook, removeOfflineBook } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockResolvedValue([mockBooks[0].id]);
    vi.mocked(getOfflineBook).mockResolvedValue('Offline cached Pride and Prejudice text');

    const networkModule = await import('@/hooks/useNetworkStatus');
    const networkSpy = vi.spyOn(networkModule, 'useNetworkStatus').mockReturnValue({
      isOnline: false,
      isOffline: true,
    });
    const fetchSpy = vi.spyOn(global, 'fetch');
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:https://bookarium.app/offline-txt');
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlSpy,
    });
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = vi.fn();

    try {
      render(
        <DownloadDrawer
          book={mockBooks[0]}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByTestId('download-drawer-offline-mode-banner')).toBeInTheDocument();

      const offlineTxtBtn = await screen.findByRole('button', {
        name: `Download ${mockBooks[0].title} as plain text (.txt)`,
      });
      expect(offlineTxtBtn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(offlineTxtBtn);
      });

      expect(getOfflineBook).toHaveBeenCalledWith(mockBooks[0].id);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);

      const removeBtn = await screen.findByRole('button', { name: `Remove offline copy of ${mockBooks[0].title}` });
      expect(removeBtn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(removeBtn);
      });

      const confirmModal = screen.getByTestId('remove-offline-book-dialog');
      await act(async () => {
        fireEvent.click(within(confirmModal).getByRole('button', { name: /remove download/i }));
      });

      expect(removeOfflineBook).toHaveBeenCalledWith(mockBooks[0].id);
    } finally {
      HTMLAnchorElement.prototype.click = originalAnchorClick;
      fetchSpy.mockRestore();
      networkSpy.mockRestore();
    }
  });

  it('copies book share link when clicking unified Title + Author block in DownloadDrawer', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(
      <DownloadDrawer
        book={mockBooks[0]}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const copyBlock = await screen.findByTestId(`download-drawer-copy-meta-${mockBooks[0].id}`);
    expect(copyBlock).toHaveAttribute('data-copy-book-id', String(mockBooks[0].id));
    expect(copyBlock).toHaveAttribute(
      'data-tooltip',
      'Pride and Prejudice — by Jane Austen'
    );
    fireEvent.click(copyBlock);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/1342$/));
    expect(screen.getByTestId(`copy-book-link-indicator-${mockBooks[0].id}`)).toHaveTextContent(
      'Copied!'
    );
  });
});
