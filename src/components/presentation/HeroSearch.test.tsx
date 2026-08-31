import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HeroSearch } from './HeroSearch';

describe('HeroSearch component', () => {
  it('should render headline, featured classic, and 4-pillar benefit strip', () => {
    render(<HeroSearch search="" selectedTopic="" selectedLanguage="" />);

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Forever/i)).toBeInTheDocument();
    expect(screen.getByText(/Featured Classic/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Public Domain/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Setup or Keys/i)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('topic-chip-philosophy')).toBeInTheDocument();
  });

  it('should handle search input changes with debounce', () => {
    vi.useFakeTimers();
    const handleSearchChange = vi.fn();
    render(<HeroSearch search="" onSearchChange={handleSearchChange} />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Austen' } });
    expect(handleSearchChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(handleSearchChange).toHaveBeenCalledWith('Austen');
    vi.useRealTimers();
  });

  it('should handle topic chip and language selection', () => {
    const handleTopicChange = vi.fn();
    const handleLangChange = vi.fn();

    render(
      <HeroSearch
        search=""
        selectedTopic=""
        onTopicChange={handleTopicChange}
        selectedLanguage=""
        onLanguageChange={handleLangChange}
      />
    );

    fireEvent.click(screen.getByTestId('topic-chip-philosophy'));
    expect(handleTopicChange).toHaveBeenCalledWith('philosophy');

    fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'fr' } });
    expect(handleLangChange).toHaveBeenCalledWith('fr');
  });

  it('should handle read featured book button click', () => {
    const handleReadFeatured = vi.fn();
    render(<HeroSearch search="" onReadFeaturedBook={handleReadFeatured} />);

    const readBtns = screen.getAllByRole('button', { name: /Read Volume/i });
    expect(readBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(readBtns[0]);
    expect(handleReadFeatured).toHaveBeenCalled();
  });

  it('should render open-book spread with left and right page quotes on featured spotlight', () => {
    render(<HeroSearch search="" />);

    expect(screen.getAllByText(/Pride and Prejudice/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/no enjoyment like reading/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/truth universally acknowledged/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Notable Passage/i)).toBeInTheDocument();
    expect(screen.getByText(/p\. 1/i)).toBeInTheDocument();
  });

  it('should clear search input and submit search correctly', () => {
    const handleSearch = vi.fn();
    const handleSearchChange = vi.fn();

    render(
      <HeroSearch
        search="Shelley"
        onSearch={handleSearch}
        onSearchChange={handleSearchChange}
      />
    );

    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'Plato' } });
    const searchBtn = screen.getByRole('button', { name: /^Search$/i });
    fireEvent.click(searchBtn);
    expect(handleSearch).toHaveBeenCalledWith('Plato');
  });

  it('should shuffle to next featured classic when rotate button is clicked', () => {
    render(<HeroSearch search="" />);

    const shuffleBtns = screen.getAllByLabelText(/Shuffle to Next Featured Masterpiece/i);
    expect(shuffleBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(shuffleBtns[0]);
  });

  it('should toggle pinned open and closed states on click and keyboard events', () => {
    render(<HeroSearch search="" />);

    const bookStage = screen.getByRole('button', { name: /Click to pin open volume/i });
    expect(bookStage).toHaveClass('book-3d-stage');
    expect(bookStage).not.toHaveClass('book-open');

    // Click to pin open
    fireEvent.click(bookStage);
    expect(bookStage).toHaveClass('book-open');

    // Click to pin closed
    fireEvent.click(bookStage);
    expect(bookStage).toHaveClass('book-closed');

    // Mouse leave resets pinState so next hover opens
    fireEvent.mouseLeave(bookStage);
    expect(bookStage).not.toHaveClass('book-closed');

    // Hover in, click again
    fireEvent.mouseEnter(bookStage);
    fireEvent.keyDown(bookStage, { key: 'Enter' });
    expect(bookStage).toHaveClass('book-closed');

    // Keyboard Space to toggle
    fireEvent.keyDown(bookStage, { key: ' ' });
    expect(bookStage).toHaveClass('book-open');
  });
});
