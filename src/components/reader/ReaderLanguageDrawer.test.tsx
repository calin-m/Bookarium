import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderLanguageDrawer } from './ReaderLanguageDrawer';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';

let mockLanguageOfflineIds: number[] = [];
vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBookIds: mockLanguageOfflineIds,
    isBookOffline: (id: number) => mockLanguageOfflineIds.includes(id),
  }),
}));

const mockTranslations: BookTranslationOption[] = [
  {
    bookId: 1342,
    languageCode: 'en',
    languageLabel: 'English',
    title: 'Pride and Prejudice',
    isCurrent: true,
  },
  {
    bookId: 25946,
    languageCode: 'fr',
    languageLabel: 'French (Français)',
    title: 'Orgueil et Préjugé',
    isCurrent: false,
  },
  {
    bookId: 35000,
    languageCode: 'de',
    languageLabel: 'German (Deutsch)',
    title: 'Stolz und Vorurteil',
    isCurrent: false,
  },
];

describe('ReaderLanguageDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguageOfflineIds = [];
  });
  it('does not render content when isOpen is false', () => {
    render(
      <ReaderLanguageDrawer
        isOpen={false}
        onClose={vi.fn()}
        translations={mockTranslations}
      />
    );

    expect(screen.queryByRole('dialog', { name: 'Language Editions & Translations' })).not.toBeInTheDocument();
  });

  it('renders archival editions with language badges and current indicator', () => {
    const onClose = vi.fn();
    const onSelectTranslation = vi.fn();

    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={onClose}
        translations={mockTranslations}
        onSelectTranslation={onSelectTranslation}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Language Editions & Translations' })).toBeInTheDocument();
    expect(screen.getByText('Languages & Translations')).toBeInTheDocument();
    expect(screen.getByText('Archival Editions (3)')).toBeInTheDocument();
    expect(screen.getByText('French (Français)')).toBeInTheDocument();
    expect(screen.getByText('German (Deutsch)')).toBeInTheDocument();

    // Click Archival French edition
    fireEvent.click(screen.getByText('French (Français)'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectTranslation).toHaveBeenCalledWith(25946);
  });

  it('does not trigger onSelectTranslation when clicking current active edition', () => {
    const onClose = vi.fn();
    const onSelectTranslation = vi.fn();

    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={onClose}
        translations={mockTranslations}
        onSelectTranslation={onSelectTranslation}
      />
    );

    // English is marked isCurrent: true
    fireEvent.click(screen.getByText('English'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectTranslation).not.toHaveBeenCalled();
  });

  it('displays empty state when no translations exist', () => {
    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={[]}
      />
    );

    expect(screen.getByText('Archival Editions (0)')).toBeInTheDocument();
    expect(screen.getByText('No other archival editions available in Gutenberg.')).toBeInTheDocument();
    expect(screen.getByText('Looking for other languages?')).toBeInTheDocument();
  });

  it('renders with sepia and dark themes correctly', () => {
    const { rerender } = render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={mockTranslations}
        theme="sepia"
      />
    );

    expect(screen.getByRole('dialog', { name: 'Language Editions & Translations' })).toBeInTheDocument();

    rerender(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={mockTranslations}
        theme="dark"
      />
    );

    expect(screen.getByRole('dialog', { name: 'Language Editions & Translations' })).toBeInTheDocument();
  });

  it('enforces offline parity: disables uncached editions and allows cached editions when offline', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    // French (25946) is cached, German (35000) is NOT cached
    mockLanguageOfflineIds = [25946];

    const onClose = vi.fn();
    const onSelectTranslation = vi.fn();

    try {
      render(
        <ReaderLanguageDrawer
          isOpen={true}
          onClose={onClose}
          translations={mockTranslations}
          onSelectTranslation={onSelectTranslation}
        />
      );

      // Uncached German edition shows Not Downloaded badge
      const offlineBadge = screen.getByTestId('translation-offline-badge-35000');
      expect(offlineBadge).toHaveTextContent('Not Downloaded');

      // Uncached German edition button is disabled
      const germanButton = screen.getByText('German (Deutsch)').closest('button');
      expect(germanButton).toBeDisabled();

      // Clicking disabled German button does nothing
      if (germanButton) fireEvent.click(germanButton);
      expect(onClose).not.toHaveBeenCalled();
      expect(onSelectTranslation).not.toHaveBeenCalled();

      // Cached French edition shows Downloaded badge
      const downloadedBadge = screen.getByTestId('translation-downloaded-badge-25946');
      expect(downloadedBadge).toHaveTextContent('Downloaded');

      // Cached French edition button is enabled
      const frenchButton = screen.getByText('French (Français)').closest('button');
      expect(frenchButton).not.toBeDisabled();

      // Clicking cached French button activates it
      if (frenchButton) fireEvent.click(frenchButton);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelectTranslation).toHaveBeenCalledWith(25946);
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });
});
