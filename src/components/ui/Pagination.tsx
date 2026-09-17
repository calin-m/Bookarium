'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Generate page numbers for desktop (window around currentPage)
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      aria-label="Pagination Navigation"
      data-testid="pagination-nav"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 pb-4 border-t border-border ${className}`}
    >
      {/* Item Count Indicator */}
      <div className="text-xs font-mono text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
        {totalItems !== undefined && pageSize !== undefined ? (
          <span>
            Showing <strong className="text-foreground">{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</strong>–
            <strong className="text-foreground">{Math.min(currentPage * pageSize, totalItems)}</strong> of{' '}
            <strong className="text-foreground">{totalItems}</strong> items
          </span>
        ) : (
          <span>
            Page <strong className="text-foreground">{currentPage}</strong> of{' '}
            <strong className="text-foreground">{totalPages}</strong>
          </span>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          aria-label="Go to previous page"
          className="min-h-[40px] sm:min-h-[36px] px-3 gap-1 text-xs font-mono font-medium cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Prev</span>
        </Button>

        {/* Mobile Compact Page Indicator (< 640px) */}
        <div className="sm:hidden px-3 py-2 text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg border border-border select-none">
          {currentPage} / {totalPages}
        </div>

        {/* Desktop Numbered Pills (>= 640px) */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((pageItem, index) => {
            if (pageItem === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-1 text-xs font-mono text-muted-foreground select-none"
                >
                  …
                </span>
              );
            }

            const isCurrent = pageItem === currentPage;
            return (
              <button
                key={`page-${pageItem}`}
                type="button"
                onClick={() => onPageChange(pageItem)}
                aria-label={`Go to page ${pageItem}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`min-w-[36px] h-9 px-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
                }`}
              >
                {pageItem}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          aria-label="Go to next page"
          className="min-h-[40px] sm:min-h-[36px] px-3 gap-1 text-xs font-mono font-medium cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  );
};

