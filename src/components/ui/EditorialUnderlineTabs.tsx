'use client';

import React from 'react';
import {
  createTabScrubberHandlers,
  getAccordionTabFlexClass,
  getAccordionTabLabelClass,
} from '@/lib/scroll-utils';

export interface EditorialUnderlineTabItem<T extends string = string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  count?: number;
  countVariant?: 'default' | 'highlight' | 'amber';
  countTestId?: string;
  hideZeroCount?: boolean;
  ariaLabel?: string;
  title?: string;
  testId?: string;
}

export interface EditorialUnderlineTabsProps<T extends string = string> {
  tabs: readonly EditorialUnderlineTabItem<T>[];
  activeTab: T;
  onSelectTab: ((tabId: T) => void) | ((value: T | ((prevState: T) => T)) => void);
  ariaLabel: string;
  wrapperClassName?: string;
  navRole?: 'tablist' | null;
  buttonRole?: 'tab' | null;
  selectionAttr?: 'aria-selected' | 'aria-pressed';
  inactiveLabelClass?: string;
  hideInactiveCountOnMobile?: boolean;
  compactPadding?: boolean;
}

/**
 * Outward high-angle triangle arrows positioned flush on the active tab's borders.
 * Left arrow points left into the previous tab's space; right arrow points right into the next tab's space.
 * Only shown in the direction(s) that scrubbing is available.
 */
export function ActiveTabBorderArrows({
  canLeft,
  canRight,
  className = 'text-primary',
}: {
  canLeft: boolean;
  canRight: boolean;
  className?: string;
}) {
  return (
    <>
      {canLeft && (
        <span
          data-scrub-chevron="left"
          aria-hidden="true"
          className={`absolute -left-[6px] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none z-10 ${className}`}
        >
          <svg width="6" height="14" viewBox="0 0 6 14" fill="currentColor" aria-hidden="true">
            <path d="M6 0 L0 7 L6 14 Z" />
          </svg>
        </span>
      )}
      {canRight && (
        <span
          data-scrub-chevron="right"
          aria-hidden="true"
          className={`absolute -right-[6px] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none z-10 ${className}`}
        >
          <svg width="6" height="14" viewBox="0 0 6 14" fill="currentColor" aria-hidden="true">
            <path d="M0 0 L6 7 L0 14 Z" />
          </svg>
        </span>
      )}
    </>
  );
}

/**
 * Shared centered editorial underline sub-tab navigation strip with built-in
 * touch/mouse live tab scrubbing (`createTabScrubberHandlers`), `touch-pan-y`
 * gesture protection, and responsive active-only label expansion.
 */
export function EditorialUnderlineTabs<T extends string = string>({
  tabs,
  activeTab,
  onSelectTab,
  ariaLabel,
  wrapperClassName = 'flex items-center justify-center border-b border-border',
  navRole = 'tablist',
  buttonRole = 'tab',
  selectionAttr = 'aria-selected',
  inactiveLabelClass,
  hideInactiveCountOnMobile = false,
  compactPadding = false,
}: EditorialUnderlineTabsProps<T>) {
  const invokeSelect = onSelectTab as (tabId: T) => void;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const paddingClass = compactPadding
    ? 'px-2 sm:px-3.5 py-2 sm:py-2.5'
    : 'px-2.5 sm:px-4 py-2.5';

  return (
    <div className={wrapperClassName}>
      <nav
        role={navRole ?? undefined}
        data-no-swipe
        aria-label={ariaLabel}
        {...createTabScrubberHandlers(onSelectTab)}
        className="flex items-center justify-between w-full gap-1.5 sm:gap-2 overflow-x-auto p-px [scrollbar-width:none] select-none touch-pan-y"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const distance = Math.abs(index - activeIndex);
          const flexClass = getAccordionTabFlexClass(distance, tabs.length, inactiveLabelClass);
          const labelClass = getAccordionTabLabelClass(
            distance,
            tabs.length,
            inactiveLabelClass
          );
          const resolvedAriaLabel = tab.ariaLabel ?? tab.label;
          const resolvedTitle = tab.title ?? resolvedAriaLabel;
          const showCount =
            typeof tab.count === 'number' && (!tab.hideZeroCount || tab.count > 0);

          const selectionProps =
            selectionAttr === 'aria-pressed'
              ? { 'aria-pressed': isActive }
              : { 'aria-selected': isActive };

          const countVisibilityClass = hideInactiveCountOnMobile
            ? isActive
              ? 'inline-flex'
              : 'hidden sm:inline-flex'
            : 'inline-flex';

          const countColorClass =
            tab.countVariant === 'amber'
              ? 'bg-amber-500 text-white shrink-0'
              : tab.countVariant === 'highlight'
                ? 'bg-primary text-primary-foreground'
                : isActive
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground';

          return (
            <button
              key={tab.id}
              type="button"
              role={buttonRole ?? undefined}
              data-tab-id={tab.id}
              data-tab-distance={distance}
              data-testid={tab.testId}
              {...selectionProps}
              aria-label={resolvedAriaLabel}
              title={resolvedTitle}
              onClick={() => invokeSelect(tab.id)}
              className={`relative flex items-center ${flexClass} gap-1.5 sm:gap-2 ${paddingClass} text-[11px] sm:text-xs font-mono uppercase tracking-wider font-bold border-b-2 transition-colors duration-150 [-webkit-tap-highlight-color:transparent] whitespace-nowrap cursor-pointer select-none ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.icon}
              <span className={labelClass}>{tab.label}</span>
              {showCount && (
                <span
                  data-testid={tab.countTestId}
                  className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${countVisibilityClass} ${countColorClass}`}
                >
                  {tab.count}
                </span>
              )}
              {isActive && tabs.length > 1 && (
                <ActiveTabBorderArrows
                  canLeft={index > 0}
                  canRight={index < tabs.length - 1}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
