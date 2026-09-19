import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderHeader } from './ReaderHeader';
import { useReaderStore } from '@/stores/useReaderStore';

describe('ReaderHeader', () => {
  beforeEach(() => {
    useReaderStore.getState().setMobileTrayOpen(false);
  });

  const defaultProps = {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    bookId: 1342,
    progress: 45,
    onBack: vi.fn(),
    isTocOpen: false,
    onToggleToc: vi.fn(),
    isControlsOpen: false,
    onToggleControls: vi.fn(),
    totalChapters: 61,
    currentChapterIndex: 5,
    theme: 'sepia' as const,
    onThemeChange: vi.fn(),
  };

  it('renders book title, author, and progress metrics correctly', () => {
    render(<ReaderHeader {...defaultProps} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('by Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('6/61')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('triggers onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<ReaderHeader {...defaultProps} onBack={onBack} />);

    fireEvent.click(screen.getByLabelText('Back to Catalog'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleToc and onToggleControls when respective buttons are clicked', () => {
    const onToggleToc = vi.fn();
    const onToggleControls = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        onToggleToc={onToggleToc}
        onToggleControls={onToggleControls}
      />
    );

    fireEvent.click(screen.getAllByLabelText('Table of Contents')[0]);
    expect(onToggleToc).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByLabelText('Typography & Theme Controls')[0]);
    expect(onToggleControls).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleSearch when search button is clicked', () => {
    const onToggleSearch = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        isSearchOpen={false}
        onToggleSearch={onToggleSearch}
      />
    );

    const searchBtns = screen.getAllByLabelText('Search in Book');
    expect(searchBtns[0]).toBeInTheDocument();
    fireEvent.click(searchBtns[0]);
    expect(onToggleSearch).toHaveBeenCalledTimes(1);
  });

  it('triggers right-side theme cycling for light, sepia, and dark', () => {
    const onThemeChange = vi.fn();

    const { rerender } = render(
      <ReaderHeader
        {...defaultProps}
        theme="light"
        onThemeChange={onThemeChange}
      />
    );

    // Light -> Sepia
    const themeBtns = screen.getAllByLabelText(/Current theme: light/i);
    fireEvent.click(themeBtns[0]);
    expect(onThemeChange).toHaveBeenCalledWith('sepia');

    // Sepia -> Dark
    rerender(
      <ReaderHeader
        {...defaultProps}
        theme="sepia"
        onThemeChange={onThemeChange}
      />
    );
    fireEvent.click(screen.getAllByLabelText(/Current theme: sepia/i)[0]);
    expect(onThemeChange).toHaveBeenCalledWith('dark');

    // Dark -> Light
    rerender(
      <ReaderHeader
        {...defaultProps}
        theme="dark"
        onThemeChange={onThemeChange}
      />
    );
    fireEvent.click(screen.getAllByLabelText(/Current theme: dark/i)[0]);
    expect(onThemeChange).toHaveBeenCalledWith('light');
  });

  it('opens and closes the Gutenberg Archive volume info modal', () => {
    render(<ReaderHeader {...defaultProps} />);

    // Default: Literary title and author visible
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('by Jane Austen')).toBeInTheDocument();

    const infoBtn = screen.getByLabelText(/View Gutenberg Archive Volume Info/i);
    fireEvent.click(infoBtn);

    // Modal opens with detailed metadata
    expect(screen.getByText('Public Domain Masterwork')).toBeInTheDocument();
    expect(screen.getByText('View on Gutenberg.org')).toBeInTheDocument();

    // Close modal via close button
    const closeBtn = screen.getByLabelText('Close Information Modal');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Public Domain Masterwork')).not.toBeInTheDocument();
  });

  it('sanitizes and renders extra long titles and multiline strings gracefully', () => {
    const longTitle = 'The German Classics of the Nineteenth and Twentieth Centuries,\r\nMasterpieces of German Literature Translated into English. in Twenty Volumes, Volume 01';
    const longAuthor = 'Kuno Francke\r\nand William Guild Howard';

    render(
      <ReaderHeader
        {...defaultProps}
        title={longTitle}
        author={longAuthor}
        bookId={59828}
      />
    );

    const expectedCleanTitle = 'The German Classics of the Nineteenth and Twentieth Centuries, Masterpieces of German Literature Translated into English. in Twenty Volumes, Volume 01';
    const expectedCleanAuthor = 'by Kuno Francke and William Guild Howard';

    expect(screen.getByText(expectedCleanTitle)).toBeInTheDocument();
    expect(screen.getByText(expectedCleanAuthor)).toBeInTheDocument();
  });

  it('filters out placeholder author strings and falls back to featured fixture', () => {
    render(
      <ReaderHeader
        {...defaultProps}
        author="Classic Masterwork"
        bookId={64317}
      />
    );

    expect(screen.getByText('by F. Scott Fitzgerald')).toBeInTheDocument();
    expect(screen.queryByText('Classic Masterwork')).not.toBeInTheDocument();
  });

  it('renders the dedicated sub-header metadata ribbon with Book ID, Section, and Progress', () => {
    render(<ReaderHeader {...defaultProps} bookId={1342} currentChapterIndex={4} totalChapters={20} progress={50} />);

    // Gutenberg Archive ID badge in sub-header
    expect(screen.getByRole('button', { name: /View Gutenberg Archive Volume Info/i })).toBeInTheDocument();
    expect(screen.getByText('#1342')).toBeInTheDocument();

    // Section indicator
    expect(screen.getByText('5/20')).toBeInTheDocument();

    // Progress indicator
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders integrated resume notice ribbon in sub-header and handles restart and dismiss', () => {
    const onRestart = vi.fn();
    const onDismissResume = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        resumeNotice={{ chapterTitle: 'Chapter III', page: 4 }}
        onRestart={onRestart}
        onDismissResume={onDismissResume}
      />
    );

    const notice = screen.getByTestId('resume-notice');
    expect(notice).toBeInTheDocument();
    expect(screen.getByText(/Resumed at Chapter III, Page 4/i)).toBeInTheDocument();

    // Click Restart
    const restartBtn = screen.getByRole('button', { name: /Restart/i });
    fireEvent.click(restartBtn);
    expect(onRestart).toHaveBeenCalledTimes(1);

    // Click Dismiss
    const dismissBtn = screen.getByLabelText('Dismiss resume notice');
    fireEvent.click(dismissBtn);
    expect(onDismissResume).toHaveBeenCalledTimes(1);
  });

  it('renders language and translation switcher and handles edition selection', () => {
    const mockTranslations = [
      {
        bookId: 1342,
        title: 'Pride and Prejudice',
        languageCode: 'en',
        languageLabel: 'English',
        isCurrent: true,
      },
      {
        bookId: 67890,
        title: 'Orgueil et Préjugés',
        languageCode: 'fr',
        languageLabel: 'French (Français)',
        isCurrent: false,
      },
      {
        bookId: 54321,
        title: 'Orgullo y Prejuicio',
        languageCode: 'es',
        languageLabel: 'Spanish (Español)',
        isCurrent: false,
      },
    ];

    const onToggleTranslations = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        translations={mockTranslations}
        onToggleTranslations={onToggleTranslations}
        isTranslationsOpen={false}
      />
    );

    // Button should be visible with badge
    const langBtn = screen.getAllByLabelText('Language Editions & Translations')[0];
    expect(langBtn).toBeInTheDocument();
    expect(langBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('3')).toBeInTheDocument();

    // Click to trigger toggle
    fireEvent.click(langBtn);
    expect(onToggleTranslations).toHaveBeenCalledTimes(1);
  });

  it('renders language button with current language label for single edition', () => {
    const onToggleTranslations = vi.fn();
    render(
      <ReaderHeader
        {...defaultProps}
        translations={[
          {
            bookId: 1342,
            title: 'Pride and Prejudice',
            languageCode: 'en',
            languageLabel: 'English',
            isCurrent: true,
          },
        ]}
        onToggleTranslations={onToggleTranslations}
      />
    );

    const langBtn = screen.getByTestId('lang-dropdown-button');
    expect(langBtn).toBeInTheDocument();
    expect(langBtn).toHaveTextContent('EN');
    expect(langBtn).toHaveAttribute('title', 'Language Editions (EN)');
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('renders language button with count badge when multiple editions exist', () => {
    const onToggleTranslations = vi.fn();
    render(
      <ReaderHeader
        {...defaultProps}
        translations={[
          {
            bookId: 1342,
            title: 'Pride and Prejudice',
            languageCode: 'en',
            languageLabel: 'English',
            isCurrent: true,
          },
          {
            bookId: 67890,
            title: 'Orgueil et Préjugés',
            languageCode: 'fr',
            languageLabel: 'French (Français)',
            isCurrent: false,
          },
        ]}
        onToggleTranslations={onToggleTranslations}
      />
    );

    const langBtn = screen.getByTestId('lang-dropdown-button');
    expect(langBtn).toBeInTheDocument();
    expect(langBtn).toHaveTextContent('EN');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('handles link copying when share button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<ReaderHeader {...defaultProps} />);

    const shareBtn = screen.getByTestId('reader-share-button');
    expect(shareBtn).toBeInTheDocument();
    expect(shareBtn).toHaveAttribute('aria-label', 'Share Book Link');

    fireEvent.click(shareBtn);

    expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
    const copiedBtns = await screen.findAllByLabelText('Link Copied to Clipboard');
    expect(copiedBtns[0]).toBeInTheDocument();
  });

  it('renders mobile quick share button and handles link copying', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<ReaderHeader {...defaultProps} />);

    const mobileShareBtn = screen.getByTestId('mobile-reader-share-btn');
    expect(mobileShareBtn).toBeInTheDocument();
    expect(mobileShareBtn).toHaveAttribute('aria-label', 'Share Book Link');

    fireEvent.click(mobileShareBtn);
    expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
    const copiedBtns = await screen.findAllByLabelText('Link Copied to Clipboard');
    expect(copiedBtns[0]).toBeInTheDocument();
  });

  it('dispatches TOC, Search, and Controls actions from desktop tool row', () => {
    const onToggleToc = vi.fn();
    const onToggleSearch = vi.fn();
    const onToggleControls = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        onToggleToc={onToggleToc}
        onToggleSearch={onToggleSearch}
        onToggleControls={onToggleControls}
      />
    );

    const tocBtn = screen.getByLabelText('Table of Contents');
    fireEvent.click(tocBtn);
    expect(onToggleToc).toHaveBeenCalledTimes(1);

    const searchBtn = screen.getByLabelText('Search in Book');
    fireEvent.click(searchBtn);
    expect(onToggleSearch).toHaveBeenCalledTimes(1);

    const controlsBtn = screen.getByLabelText('Typography & Theme Controls');
    fireEvent.click(controlsBtn);
    expect(onToggleControls).toHaveBeenCalledTimes(1);
  });

  it('renders and dispatches Annotations toggle with count badge', () => {
    const onToggleAnnotations = vi.fn();
    render(
      <ReaderHeader
        {...defaultProps}
        onToggleAnnotations={onToggleAnnotations}
        annotationsCount={3}
      />
    );

    const notesBtn = screen.getByTestId('reader-annotations-toggle-btn');
    expect(notesBtn).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    fireEvent.click(notesBtn);
    expect(onToggleAnnotations).toHaveBeenCalledTimes(1);
  });

  it('renders Read Aloud button and handles click toggles', () => {
    const onToggleSpeech = vi.fn();
    render(
      <ReaderHeader
        {...defaultProps}
        isSpeechOpen={false}
        onToggleSpeech={onToggleSpeech}
      />
    );

    const speechBtns = screen.getAllByLabelText('Read Aloud Narration');
    expect(speechBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(speechBtns[0]);
    expect(onToggleSpeech).toHaveBeenCalledTimes(1);
  });
});
