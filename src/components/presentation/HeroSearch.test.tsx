import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HeroSearch } from './HeroSearch';

describe('HeroSearch component', () => {
  it('should render headline, search input, and topics', () => {
    const handleSearchChange = vi.fn();
    const handleTopicChange = vi.fn();
    const handleLangChange = vi.fn();

    render(
      <HeroSearch
        search=""
        onSearchChange={handleSearchChange}
        selectedTopic=""
        onTopicChange={handleTopicChange}
        selectedLanguage=""
        onLanguageChange={handleLangChange}
      />
    );

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('topic-chip-philosophy')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Austen' } });
    expect(handleSearchChange).toHaveBeenCalledWith('Austen');

    fireEvent.click(screen.getByTestId('topic-chip-philosophy'));
    expect(handleTopicChange).toHaveBeenCalledWith('philosophy');

    fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'fr' } });
    expect(handleLangChange).toHaveBeenCalledWith('fr');
  });
});

