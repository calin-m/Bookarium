import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StickyCatalogToolbar } from './StickyCatalogToolbar';

describe('StickyCatalogToolbar component', () => {
  it('should render filter trigger, active chips, view switcher, pagination controls, 2-part API badge, and page size selector', () => {
    const handlePageChange = vi.fn();
    const handleViewModeChange = vi.fn();
    const handleOpenFilters = vi.fn();
    const handleClearAll = vi.fn();
    const handleRemoveChip = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <StickyCatalogToolbar
        page={1}
        onPageChange={handlePageChange}
        hasNextPage={true}
        viewMode="grid"
        onViewModeChange={handleViewModeChange}
        onOpenFilters={handleOpenFilters}
        activeFilterCount={2}
        activeFilterChips={[
          { id: 'era', label: 'Victorian', onRemove: handleRemoveChip },
          { id: 'lang', label: 'French', onRemove: handleRemoveChip },
        ]}
        onClearAllFilters={handleClearAll}
        isFetching={false}
        latencyMs={85}
        pageSize={16}
        onPageSizeChange={handlePageSizeChange}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Victorian')).toBeInTheDocument();
    expect(screen.getByText('French')).toBeInTheDocument();
    
    // 2-Part API badge checks
    expect(screen.getByTestId('api-status-badge')).toHaveTextContent('Live');
    expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('85ms');

    // Page size selector checks
    expect(screen.getByText('Show:')).toBeInTheDocument();
    const size32Btn = screen.getByLabelText('Show 32 books per page');
    fireEvent.click(size32Btn);
    expect(handlePageSizeChange).toHaveBeenCalledWith(32);

    fireEvent.click(screen.getByRole('button', { name: /Open advanced filters/i }));
    expect(handleOpenFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Remove filter Victorian/i }));
    expect(handleRemoveChip).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Clear all'));
    expect(handleClearAll).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Shelf view'));
    expect(handleViewModeChange).toHaveBeenCalledWith('shelf');

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
});
