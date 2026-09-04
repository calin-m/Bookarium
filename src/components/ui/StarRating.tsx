'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

export interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number | null) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  showLabel?: boolean;
  className?: string;
  'aria-label'?: string;
}

const SIZE_CONFIG = {
  sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', labelWidth: 'w-14' },
  md: { icon: 'w-5 h-5', text: 'text-sm', labelWidth: 'w-16' },
  lg: { icon: 'w-6 h-6', text: 'text-base', labelWidth: 'w-20' },
};

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 'md',
  readOnly = false,
  showLabel = false,
  className = '',
  'aria-label': customAriaLabel,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : value || 0;
  const { icon: iconSize, text: textSize, labelWidth } = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  const handleStarClick = (starIndex: number) => {
    if (readOnly || !onChange) return;
    // Clicking current rating clears it back to null
    if (value === starIndex) {
      onChange(null);
    } else {
      onChange(starIndex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, starIndex: number) => {
    if (readOnly || !onChange) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStarClick(starIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(5, (value || 0) + 1);
      onChange(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(1, (value || 2) - 1);
      onChange(prev);
    } else if (e.key === 'Escape') {
      setHoverRating(null);
    }
  };

  const groupLabel = customAriaLabel || (value ? `Rated ${value} of 5 stars` : 'Rate 1 to 5 stars');

  if (readOnly) {
    return (
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        aria-label={groupLabel}
        role="img"
      >
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`${iconSize} transition-colors ${
                star <= (value || 0)
                  ? 'text-amber-500 fill-amber-400 dark:text-amber-400 dark:fill-amber-400'
                  : 'text-muted-foreground/30 fill-transparent'
              }`}
            />
          ))}
        </div>
        {showLabel && value && (
          <span className={`font-mono font-bold text-muted-foreground ml-1 ${textSize}`}>
            {value}/5
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="radiogroup"
      aria-label={groupLabel}
      onMouseLeave={() => setHoverRating(null)}
    >
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating;
          const isSelected = value === star;

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Rate ${star} of 5 stars`}
              tabIndex={isSelected || (!value && star === 1) ? 0 : -1}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHoverRating(star)}
              onKeyDown={(e) => handleKeyDown(e, star)}
              className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-muted-foreground hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            >
              <Star
                className={`${iconSize} transition-colors duration-150 ${
                  isFilled
                    ? 'text-amber-500 fill-amber-400 dark:text-amber-400 dark:fill-amber-400'
                    : 'text-muted-foreground/30 fill-transparent hover:text-amber-400/60'
                }`}
              />
            </button>
          );
        })}
      </div>

      {showLabel && (
        <span
          className={`inline-block ${labelWidth} font-mono tabular-nums font-medium text-muted-foreground select-none ml-1 ${textSize}`}
        >
          {hoverRating !== null
            ? `${hoverRating}/5`
            : value
              ? `${value}/5`
              : 'Unrated'}
        </span>
      )}
    </div>
  );
};

