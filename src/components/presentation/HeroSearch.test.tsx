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

  it('should handle search input changes', () => {
    const handleSearchChange = vi.fn();
    render(<HeroSearch search="" onSearchChange={handleSearchChange} />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Austen' } });
    expect(handleSearchChange).toHaveBeenCalledWith('Austen');
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

    const readBtn = screen.getByRole('button', { name: /Read Volume/i });
    fireEvent.click(readBtn);
    expect(handleReadFeatured).toHaveBeenCalled();
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

    const shuffleBtn = screen.getByLabelText(/Shuffle to Next Featured Masterpiece/i);
    expect(shuffleBtn).toBeInTheDocument();
    fireEvent.click(shuffleBtn);
  });
});
