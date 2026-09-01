import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StickyCatalogToolbar } from './StickyCatalogToolbar';

describe('StickyCatalogToolbar component', () => {
  it('should render filter trigger, active chips, and 2-part API status badge', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={2}
        activeFilterChips={[
          { id: 'era', label: 'Victorian', onRemove: vi.fn() },
          { id: 'lang', label: 'French', onRemove: vi.fn() },
        ]}
        onClearAllFilters={vi.fn()}
        latencyMs={85}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Victorian')).toBeInTheDocument();
    expect(screen.getByText('French')).toBeInTheDocument();
    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('Live');
    expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('85ms');
  });

  it('should handle page size selection', () => {
    const handlePageSizeChange = vi.fn();
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        pageSize={16}
        onPageSizeChange={handlePageSizeChange}
      />
    );

    expect(screen.getByText('Show:')).toBeInTheDocument();
    const size32Btn = screen.getByLabelText('Show 32 books per page');
    fireEvent.click(size32Btn);
    expect(handlePageSizeChange).toHaveBeenCalledWith(32);
  });

  it('should trigger filter opening, remove individual chips, and clear all filters', () => {
    const handleOpenFilters = vi.fn();
    const handleRemoveChip = vi.fn();
    const handleClearAll = vi.fn();

    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={handleOpenFilters}
        activeFilterCount={2}
        activeFilterChips={[
          { id: 'era', label: 'Victorian', onRemove: handleRemoveChip },
          { id: 'lang', label: 'French', onRemove: vi.fn() },
        ]}
        onClearAllFilters={handleClearAll}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open advanced filters/i }));
    expect(handleOpenFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Remove filter Victorian/i }));
    expect(handleRemoveChip).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Clear all'));
    expect(handleClearAll).toHaveBeenCalled();
  });

  it('should handle view mode switching between grid and shelf', () => {
    const handleViewModeChange = vi.fn();
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={handleViewModeChange}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Shelf view'));
    expect(handleViewModeChange).toHaveBeenCalledWith('shelf');
  });

  it('should handle pagination next button and direct page jump form', () => {
    const handlePageChange = vi.fn();
    render(
      <StickyCatalogToolbar
        page={1}
        onPageChange={handlePageChange}
        hasNextPage={true}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /Next page/i });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);

    const jumpInput = screen.getByLabelText('Jump to page');
    fireEvent.change(jumpInput, { target: { value: '5' } });
    fireEvent.submit(jumpInput.closest('form')!);
    expect(handlePageChange).toHaveBeenCalledWith(5);
  });

  it('should display error indicator in status badge when isError is true', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isError={true}
      />
    );

    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('Offline');
  });

  it('applies translate-y-0 when isHeaderVisible is true and -translate-y-16 when false', () => {
    const { rerender } = render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isHeaderVisible={true}
      />
    );

    const toolbar = screen.getByTestId('sticky-catalog-toolbar');
    expect(toolbar).toHaveClass('top-16');
    expect(toolbar).toHaveClass('translate-y-0');

    rerender(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isHeaderVisible={false}
      />
    );

    expect(toolbar).toHaveClass('top-16');
    expect(toolbar).toHaveClass('-translate-y-16');
  });

  it('applies -translate-y-[calc(100%+4rem)] and pointer-events-none when isVisible is false', () => {
    render(
      <StickyCatalogToolbar
        page={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        onOpenFilters={vi.fn()}
        activeFilterCount={0}
        activeFilterChips={[]}
        onClearAllFilters={vi.fn()}
        isVisible={false}
      />
    );

    const toolbar = screen.getByTestId('sticky-catalog-toolbar');
    expect(toolbar).toHaveClass('-translate-y-[calc(100%+4rem)]');
    expect(toolbar).toHaveClass('pointer-events-none');
  });
});
