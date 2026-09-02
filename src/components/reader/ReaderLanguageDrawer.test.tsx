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

  it('renders dual-tier layout with archival editions and instant translation', () => {
    const onClose = vi.fn();
    const onSelectTranslation = vi.fn();
    const onSelectDynamicLanguage = vi.fn();

    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={onClose}
        translations={mockTranslations}
        onSelectTranslation={onSelectTranslation}
        onSelectDynamicLanguage={onSelectDynamicLanguage}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Language Editions & Translations' })).toBeInTheDocument();
    expect(screen.getByText('Languages & Translations')).toBeInTheDocument();
    expect(screen.getByText('Archival Editions (3)')).toBeInTheDocument();
    expect(screen.getByText('Instant AI Translation')).toBeInTheDocument();

    // Click Archival French edition
    fireEvent.click(screen.getByText('French (Français)'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectTranslation).toHaveBeenCalledWith(25946);
  });

  it('allows selecting popular translation quick-picks and dropdown', () => {
    const onSelectDynamicLanguage = vi.fn();

    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={mockTranslations}
        onSelectDynamicLanguage={onSelectDynamicLanguage}
      />
    );

    // Click Spanish quick-pick chip
    const spanishChip = screen.getByRole('button', { name: /Spanish/i });
    fireEvent.click(spanishChip);
    expect(onSelectDynamicLanguage).toHaveBeenCalledWith('es');

    // Select language from dropdown
    const select = screen.getByRole('combobox', { name: 'Select translation language' });
    fireEvent.change(select, { target: { value: 'ro' } });
    expect(onSelectDynamicLanguage).toHaveBeenCalledWith('ro');
  });

  it('supports toggling reading display mode and reverting to original', () => {
    const onSelectDisplayMode = vi.fn();
    const onSelectDynamicLanguage = vi.fn();

    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={mockTranslations}
        dynamicTargetLanguage="es"
        onSelectDynamicLanguage={onSelectDynamicLanguage}
        displayMode="translated"
        onSelectDisplayMode={onSelectDisplayMode}
        isTranslating={true}
      />
    );

    expect(screen.getByText(/Translating to Spanish/i)).toBeInTheDocument();
    expect(screen.getByText('Translating page content...')).toBeInTheDocument();

    // Click bilingual mode
    const bilingualBtn = screen.getByRole('button', { name: /Bilingual Parallel/i });
    fireEvent.click(bilingualBtn);
    expect(onSelectDisplayMode).toHaveBeenCalledWith('bilingual');

    // Click translated only
    const translatedBtn = screen.getByRole('button', { name: /Translated Only/i });
    fireEvent.click(translatedBtn);
    expect(onSelectDisplayMode).toHaveBeenCalledWith('translated');

    // Click revert to original
    const revertBtn = screen.getByRole('button', { name: 'Revert to original language' });
    fireEvent.click(revertBtn);
    expect(onSelectDynamicLanguage).toHaveBeenCalledWith(null);
  });

  it('unselects dynamic language when clicking the active quick-pick chip', () => {
    const onSelectDynamicLanguage = vi.fn();

    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={mockTranslations}
        dynamicTargetLanguage="es"
        onSelectDynamicLanguage={onSelectDynamicLanguage}
      />
    );

    const spanishChip = screen.getByRole('button', { name: /Spanish/i });
    fireEvent.click(spanishChip);
    expect(onSelectDynamicLanguage).toHaveBeenCalledWith(null);
  });

  it('renders fallback message when archival translations array is empty', () => {
    render(
      <ReaderLanguageDrawer
        isOpen={true}
        onClose={vi.fn()}
        translations={[]}
      />
    );

    expect(
      screen.getByText('No other archival editions available in Gutenberg.')
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
