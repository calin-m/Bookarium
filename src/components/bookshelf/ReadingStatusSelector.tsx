'use client';

import React from 'react';
import { Bookmark, BookOpen, CheckCircle2, X } from 'lucide-react';
import type { ReadingStatus } from '@/types/book.types';

export interface ReadingStatusSelectorProps {
  status: ReadingStatus | null;
  onChange: (status: ReadingStatus | null) => void;
  size?: 'sm' | 'md';
  showClear?: boolean;
  className?: string;
}

interface StatusOption {
  id: ReadingStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClasses: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    id: 'want_to_read',
    label: 'Want to Read',
    icon: Bookmark,
    activeClasses: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 font-bold shadow-sm',
  },
  {
    id: 'currently_reading',
    label: 'Currently Reading',
    icon: BookOpen,
    activeClasses: 'bg-primary/15 text-primary border-primary/40 font-bold shadow-sm',
  },
  {
    id: 'finished',
    label: 'Finished',
    icon: CheckCircle2,
    activeClasses: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-sm',
  },
];

export const ReadingStatusSelector: React.FC<ReadingStatusSelectorProps> = ({
  status,
  onChange,
  size = 'md',
  showClear = true,
  className = '',
}) => {
  const isSm = size === 'sm';

  const handleToggleStatus = (targetStatus: ReadingStatus) => {
    if (status === targetStatus) {
      onChange(null); // Click active status to clear
    } else {
      onChange(targetStatus);
    }
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      role="group"
      aria-label="Reading status selector"
    >
      {STATUS_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = status === opt.id;

        return (
          <React.Fragment key={opt.id}>
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={opt.label}
              onClick={() => handleToggleStatus(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSm ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
              } ${
                isActive
                  ? opt.activeClasses
                  : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0 ${isActive ? 'fill-current' : ''}`} />
              <span>{opt.label}</span>
            </button>

            {showClear && isActive && (
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label="Clear reading status"
                title="Clear reading status"
                className={`inline-flex items-center justify-center rounded-lg border border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer ${
                  isSm ? 'p-1' : 'p-1.5'
                }`}
              >
                <X className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

