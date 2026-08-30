import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AdvancedFilterDrawer } from './AdvancedFilterDrawer';

describe('AdvancedFilterDrawer component', () => {
  it('should render drawer with all filter sections when open', () => {
    const handleClose = vi.fn();
    const handleEraChange = vi.fn();
    const handleSortChange = vi.fn();
    const handleTopicChange = vi.fn();
    const handleLangChange = vi.fn();
    const handleFormatChange = vi.fn();
    const handleReset = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={handleClose}
        selectedEra="victorian"
        onEraChange={handleEraChange}
        selectedSort="popular"
        onSortChange={handleSortChange}
        selectedTopic="philosophy"
        onTopicChange={handleTopicChange}
        selectedLanguage="en"
        onLanguageChange={handleLangChange}
        selectedFormat=""
        onFormatChange={handleFormatChange}
        onResetAll={handleReset}
        activeFilterCount={3}
      />
    );

    expect(screen.getByText('Advanced Archive Filters')).toBeInTheDocument();
    expect(screen.getByText('3 active filters')).toBeInTheDocument();
    expect(screen.getByText(/19th Century Victorian & Romantic/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('era-option-antiquity'));
    expect(handleEraChange).toHaveBeenCalledWith('antiquity');

    fireEvent.change(screen.getByTestId('sort-select'), { target: { value: 'descending' } });
    expect(handleSortChange).toHaveBeenCalledWith('descending');

    fireEvent.click(screen.getByTestId('genre-facet-gothic'));
    expect(handleTopicChange).toHaveBeenCalledWith('gothic');

    fireEvent.change(screen.getByTestId('language-drawer-select'), { target: { value: 'fr' } });
    expect(handleLangChange).toHaveBeenCalledWith('fr');

    fireEvent.change(screen.getByTestId('format-drawer-select'), { target: { value: 'text/html' } });
    expect(handleFormatChange).toHaveBeenCalledWith('text/html');

    fireEvent.click(screen.getByRole('button', { name: /Reset all filters/i }));
    expect(handleReset).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('should not render anything when isOpen is false', () => {
    const { container } = render(
      <AdvancedFilterDrawer
        isOpen={false}
        onClose={vi.fn()}
        selectedEra=""
        onEraChange={vi.fn()}
        selectedSort=""
        onSortChange={vi.fn()}
        selectedTopic=""
        onTopicChange={vi.fn()}
        selectedLanguage=""
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={vi.fn()}
        onResetAll={vi.fn()}
        activeFilterCount={0}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

