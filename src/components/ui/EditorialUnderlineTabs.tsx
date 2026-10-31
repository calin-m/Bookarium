'use client';

import React from 'react';
import { createTabScrubberHandlers } from '@/lib/scroll-utils';

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
  inactiveLabelClass = 'hidden md:inline',
  hideInactiveCountOnMobile = false,
  compactPadding = false,
}: EditorialUnderlineTabsProps<T>) {
  const invokeSelect = onSelectTab as (tabId: T) => void;
  const paddingClass = compactPadding
    ? 'px-2 sm:px-3.5 py-2 sm:py-2.5'
    : 'px-3 sm:px-4 py-2.5';

  return (
    <div className={wrapperClassName}>
      <nav
        role={navRole ?? undefined}
        data-no-swipe
        aria-label={ariaLabel}
        {...createTabScrubberHandlers(onSelectTab)}
        className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px [scrollbar-width:none] select-none touch-pan-y"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
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
              data-testid={tab.testId}
              {...selectionProps}
              aria-label={resolvedAriaLabel}
              title={resolvedTitle}
              onClick={() => invokeSelect(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 ${paddingClass} text-xs font-mono uppercase tracking-wider font-bold border-b-2 transition-all duration-200 ease-out whitespace-nowrap shrink-0 cursor-pointer select-none ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.icon}
              <span className={isActive ? 'inline' : inactiveLabelClass}>{tab.label}</span>
              {showCount && (
                <span
                  data-testid={tab.countTestId}
                  className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${countVisibilityClass} ${countColorClass}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
