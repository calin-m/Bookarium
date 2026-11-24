import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SocialSharePanel } from './SocialSharePanel';

describe('SocialSharePanel Component', () => {
  const exportCardBlobMock = vi.fn<() => Promise<Blob | null>>();

  const defaultProps = {
    shareUrl: 'https://bookarium.app/u/jane_austen?s=abc123token',
    shareText: 'Explore Jane Austen (@jane_austen) on Bookarium.',
    socialTitle: 'Jane Austen (@jane_austen) | Bookarium',
    nativeShareTitle: 'Jane Austen (@jane_austen)',
    downloadFilename: 'bookarium-jane_austen-scholar-card.png',
    nativeShareFilename: 'bookarium-jane_austen-card.png',
    exportCardBlob: exportCardBlobMock,
    themeClasses: {
      buttonClass: 'btn-class',
      activePillClass: 'active-pill',
      pillClass: 'pill-class',
      textMutedClass: 'muted-class',
      iconAccentClass: 'accent-class',
    },
    copyLinkLabel: 'Copy Profile Link',
    cardKindLabel: 'scholar card',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    exportCardBlobMock.mockResolvedValue(new Blob(['png-bytes'], { type: 'image/png' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders primary share actions, copyable caption, and 8 rel="noopener noreferrer" social intent links', () => {
    render(<SocialSharePanel {...defaultProps} />);

    expect(screen.getByTestId('share-copy-link-btn')).toHaveTextContent('Copy Profile Link');
    expect(screen.getByTestId('share-caption-preview')).toHaveTextContent(defaultProps.shareText);

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
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByTestId(`share-platform-icon-${id}`)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('copies profile link, caption, and PNG card image via clipboard APIs with user feedback', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock, write: writeMock },
    });

    class MockClipboardItem {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }
    vi.stubGlobal('ClipboardItem', MockClipboardItem);

    render(<SocialSharePanel {...defaultProps} />);

    fireEvent.click(screen.getByTestId('share-copy-link-btn'));
    expect(writeTextMock).toHaveBeenCalledWith(defaultProps.shareUrl);
    expect(screen.getByText('Link Copied!')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('share-copy-caption-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(`${defaultProps.shareText} ${defaultProps.shareUrl}`);
      expect(screen.getByTestId('share-modal-status')).toHaveTextContent('Caption and link copied');
    });

    fireEvent.click(screen.getByTestId('share-copy-image-btn'));
    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Card Copied!')).toBeInTheDocument();
  });

  it('downloads rendered PNG image and surfaces actionable fallback messages on errors or AbortError', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:scholar-card');
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

    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const shareMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(abortErr)
      .mockRejectedValueOnce(new Error('Share unavailable'));
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });

    render(<SocialSharePanel {...defaultProps} />);

    fireEvent.click(screen.getByTestId('share-download-image-btn'));
    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:scholar-card');
    });
    expect(screen.getByTestId('share-modal-status')).toHaveTextContent(
      'Scholar card downloaded as PNG'
    );

    fireEvent.click(screen.getByTestId('share-native-os-btn'));
    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('share-modal-status')).toHaveTextContent(
        'Shared scholar card via device'
      );
    });

    // AbortError stays silent
    fireEvent.click(screen.getByTestId('share-native-os-btn'));
    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(2));

    // Unexpected share failure reports status message
    fireEvent.click(screen.getByTestId('share-native-os-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('share-modal-status')).toHaveTextContent(
        'Device share could not be completed'
      );
    });

    // Null blob export gracefully surfaces unsupported message
    exportCardBlobMock.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByTestId('share-download-image-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('share-modal-status')).toHaveTextContent(
        'Could not export scholar card image'
      );
    });
  });
});
