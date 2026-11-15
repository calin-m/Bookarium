import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ReaderShareModal } from './ReaderShareModal';
import { SITE_CONFIG } from '@/config/site-config';
import * as readingCardExport from '@/lib/reading-card-export';

describe('ReaderShareModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    bookId: 1342,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    theme: 'sepia' as const,
    progress: 48,
    currentChapterIndex: 11,
    totalChapters: 61,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(readingCardExport, 'renderReadingCardToCanvas').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the live canvas reading card preview, customization controls, and all 8 social share links', () => {
    render(<ReaderShareModal {...defaultProps} />);

    expect(screen.getByTestId('reader-share-modal')).toBeInTheDocument();
    expect(screen.getByTestId('reading-card-canvas')).toBeInTheDocument();
    expect(readingCardExport.renderReadingCardToCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'sepia',
        progress: 48,
        currentSection: 12,
        totalSections: 61,
        includeProgress: true,
      })
    );

    // Switch card theme to Dark and Light
    fireEvent.click(screen.getByTestId('share-card-theme-dark'));
    expect(screen.getByTestId('share-card-theme-dark')).toHaveAttribute('aria-pressed', 'true');
    expect(readingCardExport.renderReadingCardToCanvas).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ theme: 'dark' })
    );

    fireEvent.click(screen.getByTestId('share-card-theme-light'));
    expect(screen.getByTestId('share-card-theme-light')).toHaveAttribute('aria-pressed', 'true');

    // Toggle Include Progress off
    const progressToggle = screen.getByTestId('share-include-progress-toggle');
    expect(progressToggle).toBeChecked();
    fireEvent.click(progressToggle);
    expect(progressToggle).not.toBeChecked();
    expect(screen.getByTestId('share-caption-preview')).toHaveTextContent(
      'Reading “Pride and Prejudice” by Jane Austen on Bookarium — free public domain library.'
    );

    // Verify all 8 social platform links have rel="noopener noreferrer" and brand icons
    const platformIds = [
      'x',
      'reddit',
      'whatsapp',
      'telegram',
      'bluesky',
      'facebook',
      'linkedin',
      'email',
    ];
    for (const id of platformIds) {
      const link = screen.getByTestId(`share-platform-${id}`);
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');

      const icon = screen.getByTestId(`share-platform-icon-${id}`);
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('copies the share link and share caption to the clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(<ReaderShareModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('share-copy-link-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/read\/1342\?s=[A-Za-z0-9_-]+$/)
      );
    });
    expect(screen.getByText('Link Copied!')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('share-copy-caption-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining('Currently reading “Pride and Prejudice” by Jane Austen (48% completed)')
      );
    });
  });

  it('initializes the reading card theme to match the active reader theme on open', () => {
    const { rerender } = render(<ReaderShareModal {...defaultProps} theme="dark" />);
    expect(screen.getByTestId('share-card-theme-dark')).toHaveAttribute('aria-pressed', 'true');

    rerender(<ReaderShareModal {...defaultProps} theme="light" />);
    expect(screen.getByTestId('share-card-theme-light')).toHaveAttribute('aria-pressed', 'true');
  });

  it('copies the rendered PNG card image to the clipboard when ClipboardItem is supported', async () => {
    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    vi.spyOn(readingCardExport, 'exportReadingCardBlob').mockResolvedValue(fakeBlob);

    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: writeMock },
    });

    class MockClipboardItem {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }
    vi.stubGlobal('ClipboardItem', MockClipboardItem);

    render(<ReaderShareModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('share-copy-image-btn'));

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Card Copied!')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('handles unsupported ClipboardItem gracefully when copying card image', async () => {
    vi.spyOn(readingCardExport, 'exportReadingCardBlob').mockResolvedValue(null);

    render(<ReaderShareModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('share-copy-image-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('share-modal-status')).toHaveTextContent(
        /Image copy not supported in this browser/i
      );
    });
  });

  it('downloads the reading card as a PNG file', async () => {
    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    vi.spyOn(readingCardExport, 'exportReadingCardBlob').mockResolvedValue(fakeBlob);

    const createObjectURLMock = vi.fn().mockReturnValue('blob:reading-card-1342');
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ReaderShareModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('share-download-image-btn'));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledWith(fakeBlob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:reading-card-1342');
    });
    expect(screen.getByTestId('share-modal-status')).toHaveTextContent(
      'Reading card downloaded as PNG'
    );
  });

  it('triggers native device share with PNG file attachment or falls back to link share', async () => {
    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    vi.spyOn(readingCardExport, 'exportReadingCardBlob').mockResolvedValue(fakeBlob);

    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: canShareMock,
    });

    render(<ReaderShareModal {...defaultProps} />);

    const nativeShareBtn = screen.getByTestId('share-native-os-btn');
    expect(nativeShareBtn).toBeInTheDocument();

    fireEvent.click(nativeShareBtn);

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Pride and Prejudice — Jane Austen',
          files: expect.any(Array),
        })
      );
    });

    // Fallback when canShare({ files }) is false
    canShareMock.mockReturnValue(false);
    fireEvent.click(nativeShareBtn);

    await waitFor(() => {
      expect(shareMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Pride and Prejudice — Jane Austen',
          url: expect.stringMatching(/\/read\/1342\?s=[A-Za-z0-9_-]+$/),
        })
      );
    });
  });

  it('canonicalizes ephemeral preview window origins to SITE_CONFIG.SITE_URL and passes SITE_CONFIG.SITE_HOST', async () => {
    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    vi.spyOn(readingCardExport, 'exportReadingCardBlob').mockResolvedValue(fakeBlob);

    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(false);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: canShareMock,
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://bookarium-git-feat-calins-projects.vercel.app',
      },
    });

    try {
      render(<ReaderShareModal {...defaultProps} />);

      expect(readingCardExport.renderReadingCardToCanvas).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        expect.objectContaining({
          siteHost: SITE_CONFIG.SITE_HOST,
        })
      );

      fireEvent.click(screen.getByTestId('share-native-os-btn'));

      const escapedSiteUrl = SITE_CONFIG.SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await waitFor(() => {
        expect(shareMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringMatching(new RegExp(`^${escapedSiteUrl}/read/1342\\?s=[A-Za-z0-9_-]+$`)),
          })
        );
      });
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('reports actionable status messages when image clipboard copy, PNG export, or native share fails', async () => {
    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    const exportSpy = vi
      .spyOn(readingCardExport, 'exportReadingCardBlob')
      .mockResolvedValue(fakeBlob);

    const originalClipboardItem = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
    class MockClipboardItem {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: MockClipboardItem,
    });

    const writeMock = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: writeMock },
    });

    const abortError = Object.assign(new Error('User cancelled share'), { name: 'AbortError' });
    const shareMock = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockRejectedValueOnce(new Error('Share target unavailable'));
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    try {
      render(<ReaderShareModal {...defaultProps} />);

      // 1. Clipboard write failure
      fireEvent.click(screen.getByTestId('share-copy-image-btn'));
      expect(
        await screen.findByText('Could not copy card image — use Download PNG')
      ).toBeInTheDocument();

      // 2. PNG export failure when blob resolves null
      exportSpy.mockResolvedValueOnce(null);
      fireEvent.click(screen.getByTestId('share-download-image-btn'));
      expect(await screen.findByText('Could not export reading card image')).toBeInTheDocument();

      // 3. Native share AbortError stays silent (does not overwrite status with error), generic failure updates status
      fireEvent.click(screen.getByTestId('share-native-os-btn'));
      await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Device share could not be completed')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('share-native-os-btn'));
      expect(await screen.findByText('Device share could not be completed')).toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: originalClipboardItem,
      });
    }
  });
});
