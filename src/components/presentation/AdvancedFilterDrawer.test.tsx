import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AdvancedFilterDrawer } from './AdvancedFilterDrawer';

describe('AdvancedFilterDrawer component', () => {
  it('should render drawer with all filter sections when open', () => {
    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra="victorian"
        onEraChange={vi.fn()}
        selectedSort="popular"
        onSortChange={vi.fn()}
        selectedTopic="philosophy"
        onTopicChange={vi.fn()}
        selectedLanguage="en"
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={vi.fn()}
        onResetAll={vi.fn()}
        activeFilterCount={3}
      />
    );

    expect(screen.getByText('Advanced Archive Filters')).toBeInTheDocument();
    expect(screen.getByText('3 active filters')).toBeInTheDocument();
    expect(screen.getByText(/19th Century Victorian & Romantic/i)).toBeInTheDocument();
  });

  it('should handle era selection and sort order change', () => {
    const handleEraChange = vi.fn();
    const handleSortChange = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra="victorian"
        onEraChange={handleEraChange}
        selectedSort="popular"
        onSortChange={handleSortChange}
        selectedTopic=""
        onTopicChange={vi.fn()}
        selectedLanguage=""
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={vi.fn()}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.click(screen.getByTestId('era-option-antiquity'));
    expect(handleEraChange).toHaveBeenCalledWith('antiquity');

    fireEvent.change(screen.getByTestId('sort-select'), { target: { value: 'descending' } });
    expect(handleSortChange).toHaveBeenCalledWith('descending');
  });

  it('should handle genre facet selection and format change', () => {
    const handleTopicChange = vi.fn();
    const handleFormatChange = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        onEraChange={vi.fn()}
        selectedSort=""
        onSortChange={vi.fn()}
        selectedTopic="philosophy"
        onTopicChange={handleTopicChange}
        selectedLanguage=""
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={handleFormatChange}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.click(screen.getByTestId('genre-facet-gothic'));
    expect(handleTopicChange).toHaveBeenCalledWith('gothic');

    fireEvent.change(screen.getByTestId('format-drawer-select'), { target: { value: 'text/html' } });
    expect(handleFormatChange).toHaveBeenCalledWith('text/html');
  });

  it('should handle language selection, reset filters, and apply filters', () => {
    const handleLangChange = vi.fn();
    const handleReset = vi.fn();
    const handleClose = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={handleClose}
        selectedEra=""
        onEraChange={vi.fn()}
        selectedSort=""
        onSortChange={vi.fn()}
        selectedTopic=""
        onTopicChange={vi.fn()}
        selectedLanguage="en"
        onLanguageChange={handleLangChange}
        selectedFormat=""
        onFormatChange={vi.fn()}
        onResetAll={handleReset}
        activeFilterCount={1}
      />
    );

    fireEvent.change(screen.getByTestId('language-drawer-select'), { target: { value: 'fr' } });
    expect(handleLangChange).toHaveBeenCalledWith('fr');

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

  it('should close when pressing the Escape key', () => {
    const handleClose = vi.fn();
    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={handleClose}
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

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

