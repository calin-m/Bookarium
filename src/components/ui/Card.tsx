import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'sepia' | 'outline';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-card text-card-foreground border border-border shadow-xs',
      glass: 'bg-card border border-border shadow-md text-foreground',
      sepia: 'bg-sepia-surface border border-sepia-border text-sepia-text shadow-xs',
      outline: 'bg-transparent border border-border text-foreground',
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
