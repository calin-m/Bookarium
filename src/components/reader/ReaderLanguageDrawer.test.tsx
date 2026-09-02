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

  it('renders translations list and handles edition selection', () => {
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
    expect(screen.getByText('Language Editions')).toBeInTheDocument();
    expect(screen.getByText('3 Editions Available')).toBeInTheDocument();

    // Current edition (English)
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('French (Français)')).toBeInTheDocument();

    // Click French edition
    fireEvent.click(screen.getByText('French (Français)'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectTranslation).toHaveBeenCalledWith(25946);
  });

  it('does not trigger onSelectTranslation when clicking current edition', () => {
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

    fireEvent.click(screen.getByText('English'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectTranslation).not.toHaveBeenCalled();
  });

  it('closes when clicking close button, backdrop, or pressing Escape', () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={onClose}
        translations={mockTranslations}
      />
    );

    // Close button
    fireEvent.click(screen.getByLabelText('Close Language Editions Drawer'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop click
    const backdrop = screen.getByTestId('language-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);

    // Escape key when closed does not trigger onClose
    rerender(
      <ReaderLanguageDrawer
        isOpen={false}
        onClose={onClose}
        translations={mockTranslations}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('renders fallback message when translations array is empty', () => {
    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={[]}
      />
    );

    expect(
      screen.getByText('No other language editions available for this title.')
    ).toBeInTheDocument();
  });

  it('renders properly in Sepia theme', () => {
    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={mockTranslations}
        theme="sepia"
      />
    );

    expect(screen.getByRole('dialog', { name: 'Language Editions & Translations' })).toBeInTheDocument();
  });
});
