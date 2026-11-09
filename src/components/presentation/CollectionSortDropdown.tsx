'use client';

import React from 'react';
import { ArrowUpDown, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';

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
  icon?: React.ReactNode;
  hideLeadingIcon?: boolean;
  sortDirection?: 'asc' | 'desc';
  onDirectionToggle?: () => void;
  isDirectionDisabled?: boolean;
  directionAriaLabel?: string;
  dataTestId?: string;
  selectTestId?: string;
}

export const CollectionSortDropdown: React.FC<CollectionSortDropdownProps> = ({
  value,
  onChange,
  options,
  ariaLabel = 'Sort items',
  className = '',
  icon,
  hideLeadingIcon,
  sortDirection = 'desc',
  onDirectionToggle,
  isDirectionDisabled = false,
  directionAriaLabel,
  dataTestId = 'collection-sort-dropdown',
  selectTestId = 'collection-sort-select',
}) => {
  const shouldHideLeadingIcon = hideLeadingIcon ?? Boolean(onDirectionToggle);

  return (
    <div
      className={`inline-flex items-center gap-1.5 flex-1 ${
        onDirectionToggle
          ? 'min-w-[145px] max-w-[215px] sm:flex-none sm:min-w-[185px] sm:max-w-[260px]'
          : 'min-w-[130px] max-w-[215px] sm:flex-none sm:min-w-[170px] sm:max-w-[260px]'
      } ${className}`}
      data-testid={dataTestId}
    >
      <div className="relative inline-flex items-center flex-1 min-w-0">
        {!shouldHideLeadingIcon && (
          <div className="absolute left-2.5 sm:left-3 pointer-events-none flex items-center justify-center text-muted-foreground">
            {icon || <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />}
          </div>
        )}

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          title={ariaLabel}
          data-testid={selectTestId}
          className={`w-full h-8 ${
            shouldHideLeadingIcon ? 'pl-2.5 sm:pl-3' : 'pl-8 sm:pl-9'
          } pr-7 sm:pr-8 py-1 text-xs font-sans font-medium rounded-lg bg-card border border-border hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground cursor-pointer transition-all shadow-booksaw appearance-none select-none truncate`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-background text-foreground py-1 text-xs">
              {opt.label}
            </option>
          ))}
        </select>

        <div className="absolute right-2.5 sm:right-3 pointer-events-none flex items-center justify-center text-muted-foreground">
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
      </div>

      {onDirectionToggle && (
        <button
          type="button"
          data-testid="collection-sort-direction-btn"
          onClick={onDirectionToggle}
          disabled={isDirectionDisabled}
          aria-label={
            directionAriaLabel ||
            (isDirectionDisabled
              ? 'Sorting direction is fixed'
              : sortDirection === 'asc'
              ? 'Sort Ascending (click to sort Descending)'
              : 'Sort Descending (click to sort Ascending)')
          }
          title={
            directionAriaLabel ||
            (isDirectionDisabled
              ? 'Sorting direction is fixed'
              : sortDirection === 'asc'
              ? 'Sort Ascending (click to sort Descending)'
              : 'Sort Descending (click to sort Ascending)')
          }
          className={`h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card transition-all shadow-booksaw shrink-0 ${
            isDirectionDisabled
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : 'hover:border-primary/40 hover:text-primary text-foreground cursor-pointer active:scale-95'
          }`}
        >
          {isDirectionDisabled ? (
            <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : sortDirection === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
};
