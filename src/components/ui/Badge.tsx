import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'sepia';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'secondary',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors';

  const variants = {
    primary: 'bg-primary/15 text-primary border border-primary/30',
    secondary: 'bg-muted text-foreground border border-border',
    outline: 'border border-border text-foreground',
    success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 [html.sepia_&]:bg-emerald-950/50 [html.sepia_&]:text-emerald-300 border border-emerald-200 dark:border-emerald-800 [html.sepia_&]:border-emerald-800',
    sepia: 'bg-sepia-surface text-sepia-text border border-sepia-border',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
