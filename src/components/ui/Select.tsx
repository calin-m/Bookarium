import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Optional leading decorative icon rendered inside a relative wrapper. */
  leftIcon?: React.ReactNode;
  /** Optional trailing chevron element rendered inside a relative wrapper. */
  rightChevron?: React.ReactNode;
  /** Wrapper class applied when `leftIcon`, `rightChevron`, or `wrapperClassName` is provided. */
  wrapperClassName?: string;
}

/**
 * Forwarded-ref native `<select>` primitive. Renders a bare `<select>` with zero extra
 * wrapper elements when no `leftIcon`, `rightChevron`, or `wrapperClassName` is specified
 * so direct-flex-child layouts preserve identical sizing.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, leftIcon, rightChevron, wrapperClassName, children, ...props }, ref) => {
    const selectNode = (
      <select
        ref={ref}
        className={cn('cursor-pointer', className)}
        {...props}
      >
        {children}
      </select>
    );

    if (!leftIcon && !rightChevron && !wrapperClassName) {
      return selectNode;
    }

    return (
      <div className={cn('relative', wrapperClassName)}>
        {leftIcon}
        {selectNode}
        {rightChevron}
      </div>
    );
  }
);

Select.displayName = 'Select';
