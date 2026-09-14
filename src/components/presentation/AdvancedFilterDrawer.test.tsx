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

  it('should handle era selection on click', () => {
    const handleEraChange = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra="victorian"
        onEraChange={handleEraChange}
        selectedSort="popular"
        onSortChange={vi.fn()}
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
  });

  it('should handle sort order change', () => {
    const handleSortChange = vi.fn();

    render(
      <AdvancedFilterDrawer
        isOpen={true}
        onClose={vi.fn()}
        selectedEra="victorian"
        onEraChange={vi.fn()}
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

    fireEvent.change(screen.getByTestId('sort-select'), { target: { value: 'descending' } });
    expect(handleSortChange).toHaveBeenCalledWith('descending');
  });

  it('should handle genre facet selection on chip click', () => {
    const handleTopicChange = vi.fn();

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
        onFormatChange={vi.fn()}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.click(screen.getByTestId('genre-facet-gothic'));
    expect(handleTopicChange).toHaveBeenCalledWith('gothic');
  });

  it('should handle format selection change', () => {
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
        onTopicChange={vi.fn()}
        selectedLanguage=""
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={handleFormatChange}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.change(screen.getByTestId('format-drawer-select'), { target: { value: 'text/html' } });
    expect(handleFormatChange).toHaveBeenCalledWith('text/html');
  });

  it('should handle language selection change', () => {
    const handleLangChange = vi.fn();

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
        selectedLanguage="en"
        onLanguageChange={handleLangChange}
        selectedFormat=""
        onFormatChange={vi.fn()}
        onResetAll={vi.fn()}
        activeFilterCount={1}
      />
    );

    fireEvent.change(screen.getByTestId('language-drawer-select'), { target: { value: 'fr' } });
    expect(handleLangChange).toHaveBeenCalledWith('fr');
  });

  it('should reset all filters on reset button click', () => {
    const handleReset = vi.fn();

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
        selectedLanguage="en"
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={vi.fn()}
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
        onEraChange={vi.fn()}
        selectedSort=""
        onSortChange={vi.fn()}
        selectedTopic=""
        onTopicChange={vi.fn()}
        selectedLanguage="en"
        onLanguageChange={vi.fn()}
        selectedFormat=""
        onFormatChange={vi.fn()}
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

