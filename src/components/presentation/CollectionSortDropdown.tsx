'use client';

import React from 'react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';

export interface SortOption {
  value: string;
  label: string;
}

export interface CollectionSortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  ariaLabel?: string;
  className?: string;
}

export const CollectionSortDropdown: React.FC<CollectionSortDropdownProps> = ({
  value,
  onChange,
  options,
  ariaLabel = 'Sort items',
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center min-w-[125px] sm:min-w-[155px] ${className}`}
      data-testid="collection-sort-dropdown"
    >
      <div className="absolute left-2.5 sm:left-3 pointer-events-none flex items-center justify-center text-muted-foreground">
        <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        data-testid="collection-sort-select"
        className="w-full min-h-[38px] sm:min-h-[40px] pl-7.5 sm:pl-8 pr-6 sm:pr-7 py-1.5 sm:py-2 text-base sm:text-xs font-mono font-medium rounded-xl bg-card border border-border hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground cursor-pointer transition-all shadow-booksaw appearance-none select-none truncate"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-background text-foreground py-1">
            {opt.label}
          </option>
        ))}
      </select>

      <div className="absolute right-2.5 pointer-events-none flex items-center justify-center text-muted-foreground">
        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
      </div>
    </div>
  );
};
