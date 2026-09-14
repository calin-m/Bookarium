import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
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

  it('should stage era selection and commit on Show Results click', () => {
    const handleEraChange = vi.fn();
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        onEraChange={handleEraChange}
        onApplyFilters={handleApply}
        selectedSort="popular"
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onResetAll={vi.fn()}
        activeFilterCount={0}
      />
    );

    const antiquityChip = screen.getByTestId('era-option-antiquity');
    expect(antiquityChip).toHaveAttribute('role', 'checkbox');
    fireEvent.click(antiquityChip);
    expect(handleApply).not.toHaveBeenCalled();
    expect(handleEraChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ era: 'antiquity' }));
  });

  it('should support multi-era selection and reset via All Historical Eras chip', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra="victorian"
        selectedSort="popular"
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    // Toggle early-20th in addition to victorian
    const early20thChip = screen.getByTestId('era-option-early-20th');
    fireEvent.click(early20thChip);

    // Verify counter badge appears
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Reset via All Historical Eras chip
    const allEraChip = screen.getByTestId('era-option-all');
    fireEvent.click(allEraChip);

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ era: '' }));
  });

  it('should stage sort order change and commit on Show Results click', () => {
    const handleSortChange = vi.fn();
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra="victorian"
        selectedSort="popular"
        onSortChange={handleSortChange}
        onApplyFilters={handleApply}
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    const sortChip = screen.getByTestId('sort-option-descending');
    expect(sortChip).toBeInTheDocument();
    expect(sortChip).toHaveAttribute('role', 'radio');
    expect(sortChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(sortChip);
    expect(handleApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ sort: 'descending' }));
  });

  it('should stage genre facet selection and commit on Show Results click', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={0}
      />
    );

    const gothicChip = screen.getByTestId('genre-facet-gothic');
    expect(gothicChip).toHaveAttribute('role', 'checkbox');
    fireEvent.click(gothicChip);
    expect(handleApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ topic: 'gothic' }));
  });

  it('should support multi-topic selection and reset via All Subjects chip', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic="philosophy"
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    // Toggle science in addition to philosophy
    const scienceChip = screen.getByTestId('genre-facet-science');
    fireEvent.click(scienceChip);

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ topic: 'philosophy,science' }));
  });

  it('should stage format selection change and commit on Show Results click', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic="philosophy"
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    const formatChip = screen.getByTestId('format-option-text-html');
    expect(formatChip).toBeInTheDocument();
    expect(formatChip).toHaveAttribute('role', 'checkbox');
    expect(formatChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(formatChip);
    expect(handleApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ format: 'text/html' }));
  });

  it('should support multi-format selection and reset via All Formats chip', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={0}
      />
    );

    const epubChip = screen.getByTestId('format-option-application-epub-zip');
    const htmlChip = screen.getByTestId('format-option-text-html');

    fireEvent.click(epubChip);
    fireEvent.click(htmlChip);

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'application/epub+zip,text/html' })
    );
  });

  it('should support multi-language selection via touch chips and commit on Show Results', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={0}
      />
    );

    const enChip = screen.getByTestId('language-option-en');
    const frChip = screen.getByTestId('language-option-fr');

    expect(enChip).toBeInTheDocument();
    expect(frChip).toBeInTheDocument();

    fireEvent.click(enChip);
    fireEvent.click(frChip);

    expect(handleApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ language: 'en,fr' }));
  });

  it('should reset languages to empty string when clicking All Languages chip', () => {
    const handleApply = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic=""
        selectedLanguage="en,fr"
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={2}
      />
    );

    const allLangChip = screen.getByTestId('language-option-all');
    fireEvent.click(allLangChip);

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleApply).toHaveBeenCalledWith(expect.objectContaining({ language: '' }));
  });

  it('should discard uncommitted draft changes when closing drawer without applying', () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={handleClose}
        selectedEra="victorian"
        selectedSort="popular"
        selectedTopic=""
        selectedLanguage=""
        selectedFormat=""
        onApplyFilters={handleApply}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.click(screen.getByTestId('era-option-antiquity'));

    fireEvent.click(screen.getByRole('button', { name: /Close filters/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleApply).not.toHaveBeenCalled();
  });

  it('should reset all filters on reset button click', () => {
    const handleReset = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra=""
        selectedSort=""
        selectedTopic=""
        selectedLanguage="en"
        selectedFormat=""
        onResetAll={handleReset}
        activeFilterCount={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Reset all filters/i }));
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('should apply filters and close drawer on apply button click', () => {
    const handleClose = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={handleClose}
        selectedEra=""
        selectedSort=""
        selectedTopic=""
        selectedLanguage="en"
        selectedFormat=""
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
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

  it('renders header icon container with theme-aware solid border-border without fractional opacity', () => {
    render(
      <AdvancedFilterDrawer
        isOpen={true}
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

    const titleEl = screen.getByText('Advanced Archive Filters');
    const headerLeft = titleEl.closest('.flex.items-center.gap-2\\.5');
    expect(headerLeft).toBeInTheDocument();

    const iconContainer = headerLeft?.firstElementChild;
    expect(iconContainer).toHaveClass('border-border');
    expect(iconContainer?.className).not.toContain('border-primary/20');
  });

  describe('Mobile Scroll Locking & Layout Shift Prevention', () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
    });

    it('locks both document.body and document.documentElement overflow on mobile (<1280px) and restores on unmount', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'scroll';

      const { unmount } = render(
        <AdvancedFilterDrawer
          isOpen={true}
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

      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('auto');
      expect(document.documentElement.style.overflow).toBe('scroll');
    });

    it('compensates for scrollbar width using paddingRight and restores on unmount', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      Object.defineProperty(document.documentElement, 'clientWidth', { writable: true, configurable: true, value: 753 }); // 15px scrollbar

      const { unmount } = render(
        <AdvancedFilterDrawer
          isOpen={true}
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

      expect(document.body.style.paddingRight).toBe('15px');

      unmount();

      expect(document.body.style.paddingRight).toBe('');
    });

    it('does not lock overflow when on desktop viewports (>= 1280px)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
      document.body.style.overflow = 'visible';
      document.documentElement.style.overflow = 'visible';

      render(
        <AdvancedFilterDrawer
          isOpen={true}
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

      expect(document.body.style.overflow).toBe('visible');
      expect(document.documentElement.style.overflow).toBe('visible');
    });

    it('renders backdrop with touch-none and prevents default on touchmove to eliminate scroll bleed', () => {
      render(
        <AdvancedFilterDrawer
          isOpen={true}
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

      const backdrop = screen.getByTestId('filter-backdrop');
      expect(backdrop).toHaveClass('touch-none');

      const touchMoveEvent = createEvent.touchMove(backdrop);
      const preventDefaultSpy = vi.spyOn(touchMoveEvent, 'preventDefault');
      fireEvent(backdrop, touchMoveEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('renders scrollable filter options container with overscroll-contain', () => {
      render(
        <AdvancedFilterDrawer
          isOpen={true}
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

      const titleEl = screen.getByText('Advanced Archive Filters');
      const drawerContainer = titleEl.closest('[data-testid="advanced-filter-drawer"]');
      const scrollableContainer = drawerContainer?.querySelector('.overflow-y-auto');

      expect(scrollableContainer).toBeInTheDocument();
      expect(scrollableContainer).toHaveClass('overscroll-contain');
    });
  });
});

