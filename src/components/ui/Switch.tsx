'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  /** Whether the switch is currently toggled on. */
  checked: boolean;
  /** Callback fired with the next checked boolean state. */
  onCheckedChange: (checked: boolean) => void;
  /** Rendering mode: `'button'` emits `<button role="switch">`; `'checkbox'` emits a checkbox-backed peer switch. */
  mode?: 'button' | 'checkbox';
  /** Optional element id (applied to `<input>` in checkbox mode or `<button>` in button mode). */
  id?: string;
  /** Accessible label for the switch control. */
  ariaLabel?: string;
  /** Standard `aria-label` alias for HTML attribute compatibility. */
  'aria-label'?: string;
  /** Optional `data-testid` for testing. */
  dataTestId?: string;
  /** Standard `data-testid` alias for HTML attribute compatibility. */
  'data-testid'?: string;
  /** Disables user interaction when true. */
  disabled?: boolean;
  /** Optional class override for the root button or outer `<label>` in checkbox mode. */
  className?: string;
  /** Optional class override for the sliding track in checkbox mode. */
  trackClassName?: string;
  /** Optional class override for the circular thumb in button mode. */
  thumbClassName?: string;
}

/**
 * Shared accessible `role="switch"` toggle supporting both `<button>` pill switches
 * and checkbox-backed `peer` switches without altering DOM semantics or `.toBeChecked()` expectations.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  mode = 'button',
  id,
  ariaLabel,
  'aria-label': ariaLabelAttr,
  dataTestId,
  'data-testid': dataTestIdAttr,
  disabled = false,
  className,
  trackClassName,
  thumbClassName,
}) => {
  const resolvedAriaLabel = ariaLabelAttr ?? ariaLabel;
  const resolvedTestId = dataTestIdAttr ?? dataTestId;

  if (mode === 'checkbox') {
    return (
      <label className={cn('relative inline-flex items-center cursor-pointer shrink-0', className)}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-label={resolvedAriaLabel}
          data-testid={resolvedTestId}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={cn(
            "w-11 h-6 bg-muted peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary",
            trackClassName
          )}
        />
      </label>
    );
  }

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={resolvedAriaLabel}
      data-testid={resolvedTestId}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
          thumbClassName
        )}
      />
    </button>
  );
};
