import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'sepia';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
      secondary: 'bg-stone-800 text-stone-100 hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600',
      outline: 'border border-stone-300 dark:border-stone-700 bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-900 dark:text-stone-100',
      ghost: 'bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
      sepia: 'bg-sepia-surface text-sepia-text border border-sepia-border hover:bg-[#ebd9b1]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

