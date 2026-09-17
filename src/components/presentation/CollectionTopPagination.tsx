'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CollectionTopPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  className?: string;
  ariaLabel?: string;
}

export const CollectionTopPagination: React.FC<CollectionTopPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  ariaLabel = 'Top collection pagination',
}) => {
  if (totalPages <= 1) {
    return null;
  }

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

  return (
    <nav
      aria-label={ariaLabel}
      data-testid="collection-top-pagination"
      className={`inline-flex items-center gap-1 bg-card/60 backdrop-blur-xs border border-border rounded-xl p-0.5 shadow-2xs ${className}`}
    >
      <button
        type="button"
        onClick={handlePrev}
        disabled={currentPage <= 1}
        aria-label="Previous page"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <span className="text-[11px] font-mono px-1.5 text-muted-foreground select-none" data-testid="top-pagination-indicator">
        <strong className="text-foreground font-semibold">{currentPage}</strong>
        <span className="mx-1 opacity-60">/</span>
        <span>{totalPages}</span>
      </span>

      <button
        type="button"
        onClick={handleNext}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </nav>
  );
};

