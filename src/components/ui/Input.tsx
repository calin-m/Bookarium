import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', icon, onClear, value, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-3.5 text-stone-400 dark:text-stone-500 pointer-events-none flex items-center">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          ref={ref}
          className={cn(
            'flex h-11 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 text-sm text-stone-900 dark:text-stone-100 shadow-sm transition-colors placeholder:text-stone-400 dark:placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
            icon && 'pl-10',
            onClear && Boolean(value) && 'pr-10',
            className
          )}
          {...props}
        />
        {onClear && Boolean(value) && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            aria-label="Clear input"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

