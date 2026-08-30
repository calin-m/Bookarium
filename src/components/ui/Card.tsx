import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'sepia' | 'outline';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm',
      glass: 'bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-stone-200/50 dark:border-stone-800/50 shadow-md',
      sepia: 'bg-sepia-surface border border-sepia-border text-sepia-text shadow-sm',
      outline: 'bg-transparent border border-stone-200 dark:border-stone-800',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-xl overflow-hidden transition-all', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

