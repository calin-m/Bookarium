import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'sepia';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'chip';

export type ButtonProps<C extends React.ElementType = 'button'> = {
  as?: C;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<C>, 'as' | 'variant' | 'size' | 'isLoading'>;

export const Button = React.forwardRef(
  <C extends React.ElementType = 'button'>(
    { as, className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }: ButtonProps<C>,
    ref: React.ForwardedRef<unknown>
  ) => {
    const Component = as || 'button';

    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none active:scale-95';

    const variants: Record<ButtonVariant, string> = {
      primary: 'border border-primary bg-primary text-primary-foreground hover:opacity-90 shadow-xs',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent',
      outline: 'border border-border bg-card hover:bg-muted hover:border-primary text-foreground shadow-2xs',
      ghost: 'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent',
      destructive: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
      sepia: 'bg-[#332219] text-[#fef6eb] border border-[#462e22] hover:bg-[#402a1d]',
    };

    const sizes: Record<ButtonSize, string> = {
      chip: 'px-3 py-1 text-xs font-sans font-medium rounded gap-1.5',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-10 px-4 text-sm gap-2 rounded-lg',
      lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
      icon: 'h-9 w-9 p-0 rounded-lg',
    };

    return (
      <Component
        ref={ref as any}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : null}
        {children}
      </Component>
    );
  }
) as <C extends React.ElementType = 'button'>(
  props: ButtonProps<C> & { ref?: React.Ref<unknown> }
) => React.ReactElement;

