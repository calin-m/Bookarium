'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, ChevronDown, Check } from 'lucide-react';
import { Select } from '@/components/ui/Select';

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
  compactOnMobile?: boolean;
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
  compactOnMobile = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const shouldHideLeadingIcon = hideLeadingIcon ?? Boolean(onDirectionToggle);
  const isCustomSort = options.length > 0 && value !== options[0].value;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-1.5 ${
        compactOnMobile ? 'w-auto' : 'flex-1'
      } ${
        onDirectionToggle
          ? compactOnMobile
            ? 'sm:min-w-[185px] sm:max-w-[260px]'
            : 'min-w-[145px] max-w-[215px] sm:flex-none sm:min-w-[185px] sm:max-w-[260px]'
          : compactOnMobile
          ? 'sm:min-w-[170px] sm:max-w-[260px]'
          : 'min-w-[130px] max-w-[215px] sm:flex-none sm:min-w-[170px] sm:max-w-[260px]'
      } ${className}`}
      data-testid={dataTestId}
    >
      <div className={`relative inline-flex items-center ${compactOnMobile ? 'w-8 h-8 sm:w-full sm:flex-1' : 'flex-1'} min-w-0`}>
        {/* Compact Mobile Visible Square Icon Trigger Button */}
        {compactOnMobile && (
          <button
            ref={triggerRef}
            type="button"
            data-testid="compact-sort-trigger"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={`${ariaLabel} menu`}
            title={ariaLabel}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`sm:hidden w-8 h-8 flex items-center justify-center rounded-lg border transition-all shadow-booksaw cursor-pointer shrink-0 select-none active:scale-90 ${
              isOpen
                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                : isCustomSort
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {icon ? (
              <span className={`inline-flex transition-transform duration-200 ${isOpen ? 'scale-110 text-primary' : ''}`}>
                {icon}
              </span>
            ) : (
              <ArrowUpDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-primary' : ''
                }`}
                aria-hidden="true"
              />
            )}
          </button>
        )}

        {/* Compact Mobile Animated Inward Dropdown Popover */}
        {compactOnMobile && (
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={popoverRef}
                data-testid="compact-sort-popover"
                role="listbox"
                aria-label={ariaLabel}
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="sm:hidden absolute right-0 top-full mt-1.5 w-48 sm:w-56 p-1.5 bg-card border border-border rounded-xl shadow-booksaw-hover z-50 text-xs space-y-0.5 origin-top-right focus:outline-none"
              >
                {options.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs font-mono transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-bold shadow-xs'
                          : 'text-foreground hover:bg-muted/80'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" aria-hidden="true" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Standard / Desktop Leading Icon */}
        {!shouldHideLeadingIcon && (
          <div
            className={`${
              compactOnMobile ? 'hidden sm:flex' : 'flex'
            } absolute left-2.5 sm:left-3 pointer-events-none items-center justify-center text-muted-foreground`}
          >
            {icon || <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />}
          </div>
        )}

        {/* Standard Select (Desktop on compactOnMobile, or universal when compactOnMobile=false) */}
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          title={ariaLabel}
          data-testid={selectTestId}
          className={`${
            compactOnMobile ? 'sr-only sm:not-sr-only sm:relative sm:w-full sm:h-8' : 'w-full h-8'
          } ${
            shouldHideLeadingIcon ? 'pl-2.5 sm:pl-3' : 'pl-8 sm:pl-9'
          } pr-7 sm:pr-8 py-1 text-xs font-sans font-medium rounded-lg bg-card border border-border hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground transition-all shadow-booksaw appearance-none select-none truncate`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-background text-foreground py-1 text-xs">
              {opt.label}
            </option>
          ))}
        </Select>

        <div className={`absolute right-2.5 sm:right-3 pointer-events-none ${compactOnMobile ? 'hidden sm:flex' : 'flex'} items-center justify-center text-muted-foreground`}>
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
          className={`group/sortdir h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card shadow-booksaw shrink-0 ${
            isDirectionDisabled
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : 'hover:border-primary/40 hover:text-primary text-foreground cursor-pointer active:scale-95 transition-all'
          }`}
        >
          <ArrowUpDown
            className={`w-3.5 h-3.5 pointer-events-none transition-transform duration-300 ease-in-out ${
              isDirectionDisabled
                ? 'text-muted-foreground'
                : 'text-primary ' +
                  (sortDirection === 'asc'
                    ? 'rotate-180 group-hover/sortdir:rotate-[360deg]'
                    : 'rotate-0 group-hover/sortdir:rotate-180')
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
};
