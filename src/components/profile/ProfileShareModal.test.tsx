import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { ProfileShareModal } from './ProfileShareModal';
import * as profileCardExport from '@/lib/profile-card-export';
import * as sharePrimitives from '@/lib/share-card-primitives';
import { useThemeStore } from '@/stores/useThemeStore';

describe('ProfileShareModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    username: 'jane_austen',
    displayName: 'Jane Austen',
    initials: 'JA',
    memberSince: 'June 2025',
    bio: 'Vanity and pride are different things.',
    bioBookTitle: 'Pride and Prejudice',
    bioBookAuthor: 'Jane Austen',
    statsPills: ['14d Streak', '10/25 Goal'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useThemeStore.setState({ theme: 'sepia' });
    });
    vi.spyOn(profileCardExport, 'renderProfileCardToCanvas').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useThemeStore.setState({ theme: 'light' });
    });
  });

  it('initializes canvas preview from active app theme and renders bio attribution plus stats toggle', () => {
    render(<ProfileShareModal {...defaultProps} />);

    expect(screen.getByTestId('profile-share-modal')).toBeInTheDocument();
    expect(screen.getByTestId('profile-card-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('share-card-theme-sepia')).toHaveAttribute('aria-pressed', 'true');
    expect(profileCardExport.renderProfileCardToCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        username: 'jane_austen',
        displayName: 'Jane Austen',
        initials: 'JA',
        bio: 'Vanity and pride are different things.',
        bioBookTitle: 'Pride and Prejudice',
        bioBookAuthor: 'Jane Austen',
        theme: 'sepia',
        includeStats: true,
        statsPills: ['14d Streak', '10/25 Goal'],
      })
    );
  });

  it('switches card themes, toggles public stats visibility, and copies canonical profile URL', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(<ProfileShareModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('share-card-theme-dark'));
    expect(screen.getByTestId('share-card-theme-dark')).toHaveAttribute('aria-pressed', 'true');
    expect(profileCardExport.renderProfileCardToCanvas).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ theme: 'dark', includeStats: true })
    );

    const statsToggle = screen.getByTestId('profile-share-include-stats-toggle');
    expect(statsToggle).toBeChecked();
    fireEvent.click(statsToggle);
    expect(statsToggle).not.toBeChecked();
    expect(profileCardExport.renderProfileCardToCanvas).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ theme: 'dark', includeStats: false, statsPills: [] })
    );

    fireEvent.click(screen.getByTestId('share-copy-link-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/u\/jane_austen\?s=[A-Za-z0-9_-]+$/)
      );
    });
  });

  it('hides stats toggle when privacy settings expose zero metric pills and resets theme override on close', () => {
    const onCloseMock = vi.fn();
    render(<ProfileShareModal {...defaultProps} statsPills={[]} onClose={onCloseMock} />);

    expect(screen.queryByTestId('profile-share-include-stats-toggle')).toBeNull();
    expect(screen.getByTestId('profile-share-stats-hidden-note')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('share-card-theme-light'));
    expect(screen.getByTestId('share-card-theme-light')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('profile-share-backdrop'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('exports PNG blob via shared primitives when copying card image', async () => {
    const fakeBlob = new Blob(['png'], { type: 'image/png' });
    const exportSpy = vi.spyOn(sharePrimitives, 'exportCardBlob').mockResolvedValue(fakeBlob);
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

    render(<ProfileShareModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('share-copy-image-btn'));

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalled();
      expect(writeMock).toHaveBeenCalledTimes(1);
    });

    vi.unstubAllGlobals();
  });
});
