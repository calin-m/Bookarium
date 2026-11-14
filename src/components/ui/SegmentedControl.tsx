import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string | number> {
  /** Underlying value emitted when this segment is clicked. */
  value: T;
  /** Visible segment text or custom node content. */
  label?: React.ReactNode;
  /** Optional leading icon node rendered before `label`. */
  icon?: React.ReactNode;
  /** Optional accessible `aria-label`. */
  ariaLabel?: string;
  /** Optional tooltip `title` attribute. */
  title?: string;
  /** Optional `data-testid` applied to the button. */
  testId?: string;
  /** Optional persistent per-option classes (e.g. font family preview). */
  className?: string;
  /** Optional per-option active classes overriding `activeClassName`. */
  activeClassName?: string;
  /** Optional per-option inactive classes overriding `inactiveClassName`. */
  inactiveClassName?: string;
}

export interface SegmentedControlProps<T extends string | number> {
  /** Options rendered left-to-right inside the segmented container. */
  options: readonly SegmentedOption<T>[];
  /** Currently active option value. */
  value: T;
  /** Handler invoked with the clicked option's `value`. */
  onChange: (value: T) => void;
  /** Optional custom predicate for fuzzy selection checks (e.g. floating-point line height). */
  isSelected?: (optionValue: T) => boolean;
  /** Container layout & theme classes (`grid` or `flex`). */
  className?: string;
  /** Shared base classes applied to every segment `<button>`. */
  optionClassName?: string;
  /** Shared active state classes applied when selected. */
  activeClassName?: string;
  /** Shared inactive state classes applied when unselected. */
  inactiveClassName?: string;
  /** Optional dynamic class resolver receiving `(option, selected)`. */
  getOptionClassName?: (option: SegmentedOption<T>, selected: boolean) => string;
  /** Optional `role` attribute on the outer container (defaults to `'group'` when `ariaLabel` is set). */
  role?: string;
  /** Optional accessible `aria-label` on the outer container. */
  ariaLabel?: string;
  /** Whether to emit `aria-pressed={selected}` on each `<button>` (default: `true`). */
  emitAriaPressed?: boolean;
}

/**
 * Typed segmented toggle button group parameterized by container/pill styling so disparate
 * surfaces (Preferences, ReaderControls, ShareModal, StickyCatalogToolbar, BookGrid) share
 * selection behavior with zero visual change.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  isSelected,
  className,
  optionClassName,
  activeClassName,
  inactiveClassName,
  getOptionClassName,
  role,
  ariaLabel,
  emitAriaPressed = true,
}: SegmentedControlProps<T>): React.ReactElement {
  const resolvedRole = role ?? (ariaLabel ? 'group' : undefined);

  return (
    <div role={resolvedRole} aria-label={ariaLabel} className={className}>
      {options.map((option) => {
        const selected = isSelected ? isSelected(option.value) : option.value === value;
        const resolvedClasses = getOptionClassName
          ? getOptionClassName(option, selected)
          : cn(
              optionClassName,
              option.className,
              selected
                ? option.activeClassName ?? activeClassName
                : option.inactiveClassName ?? inactiveClassName
            );

        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={option.ariaLabel}
            title={option.title}
            data-testid={option.testId}
            aria-pressed={emitAriaPressed ? selected : undefined}
            className={resolvedClasses}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
