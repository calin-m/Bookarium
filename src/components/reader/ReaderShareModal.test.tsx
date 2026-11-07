import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ReaderShareModal } from './ReaderShareModal';
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
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/1342$/));
    });
    expect(screen.getByText('Link Copied!')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('share-copy-caption-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining('Currently reading “Pride and Prejudice” by Jane Austen (48% completed)')
      );
    });
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
          url: expect.stringMatching(/\/read\/1342$/),
        })
      );
    });
  });
});
