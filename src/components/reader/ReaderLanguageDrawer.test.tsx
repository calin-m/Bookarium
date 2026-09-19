import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderLanguageDrawer } from './ReaderLanguageDrawer';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';

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
});
