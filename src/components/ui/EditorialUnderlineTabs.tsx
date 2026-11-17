'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  createTabScrubberHandlers,
  getAccordionTabFlexClass,
  getAccordionTabLabelClass,
} from '@/lib/scroll-utils';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface EditorialUnderlineTabItem<T extends string = string> {
  id: T;
  label: string;
  mobileLabel?: string;
  icon: React.ReactNode;
  count?: number;
  countVariant?: 'default' | 'highlight' | 'amber';
  countTestId?: string;
  hideZeroCount?: boolean;
  ariaLabel?: string;
  title?: string;
  testId?: string;
  buttonId?: string;
  ariaControls?: string;
}

export interface EditorialUnderlineTabsProps<T extends string = string> {
  tabs: readonly EditorialUnderlineTabItem<T>[];
  activeTab: T;
  onSelectTab: ((tabId: T) => void) | ((value: T | ((prevState: T) => T)) => void);
  ariaLabel: string;
  variant?: 'underline' | 'recessed-capsule';
  wrapperClassName?: string;
  trackClassName?: string;
  capsuleTestId?: string;
  compactLayout?: 'responsive-stack' | 'inline';
  useKeyboardNavigation?: boolean;
  navRole?: 'tablist' | null;
  buttonRole?: 'tab' | null;
  selectionAttr?: 'aria-selected' | 'aria-pressed';
  inactiveLabelClass?: string;
  hideInactiveCountOnMobile?: boolean;
  compactPadding?: boolean;
}

const GRID_COLS_BY_COUNT: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

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

function resolveCountBadgeColor(
  variant: EditorialUnderlineTabItem['countVariant'],
  isActive: boolean
): string {
  if (variant === 'amber') {
    return 'bg-amber-500 text-white shrink-0';
  }
  if (variant === 'highlight') {
    return 'bg-primary text-primary-foreground';
  }
  return isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground';
}

function RecessedCapsuleTabs<T extends string = string>({
  tabs,
  activeTab,
  onSelectTab,
  ariaLabel,
  trackClassName = '',
  capsuleTestId = 'recessed-tab-active-capsule',
  compactLayout,
  useKeyboardNavigation = false,
  navRole = 'tablist',
  buttonRole = 'tab',
  selectionAttr = 'aria-selected',
}: EditorialUnderlineTabsProps<T>) {
  const invokeSelect = onSelectTab as (tabId: T) => void;
  const { allowHeavyMotion } = usePerformanceTier();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const [capsuleRect, setCapsuleRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const tabsLayoutSignature = tabs.map((t) => `${t.id}:${t.count ?? ''}`).join('|');

  const measureCapsule = useCallback(() => {
    if (!allowHeavyMotion) return;
    const activeEl = buttonRefs.current[activeTab];
    if (!activeEl) return;
    const nextWidth = activeEl.offsetWidth;
    const nextHeight = activeEl.offsetHeight;
    if (nextWidth === 0 || nextHeight === 0) return;

    const nextRect = {
      left: activeEl.offsetLeft,
      top: activeEl.offsetTop,
      width: nextWidth,
      height: nextHeight,
    };

    setCapsuleRect((prev) =>
      prev &&
      prev.left === nextRect.left &&
      prev.top === nextRect.top &&
      prev.width === nextRect.width &&
      prev.height === nextRect.height
        ? prev
        : nextRect
    );
  }, [activeTab, allowHeavyMotion]);

  useIsomorphicLayoutEffect(() => {
    measureCapsule();
  }, [measureCapsule, tabsLayoutSignature]);

  useEffect(() => {
    if (!allowHeavyMotion) return;

    window.addEventListener('resize', measureCapsule);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measureCapsule);
      if (trackRef.current) {
        observer.observe(trackRef.current);
      }
      const activeEl = buttonRefs.current[activeTab];
      if (activeEl) {
        observer.observe(activeEl);
      }
    }

    return () => {
      window.removeEventListener('resize', measureCapsule);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [activeTab, allowHeavyMotion, measureCapsule]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!useKeyboardNavigation || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) {
      return;
    }
    e.preventDefault();
    const currentIndex = Math.max(
      0,
      tabs.findIndex((t) => t.id === activeTab)
    );
    const nextIndex =
      e.key === 'ArrowRight'
        ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    invokeSelect(nextTab.id);
    buttonRefs.current[nextTab.id]?.focus();
  };

  const isCapsuleGliding = Boolean(allowHeavyMotion && capsuleRect && capsuleRect.width > 0);
  const resolvedLayout = compactLayout ?? (tabs.length <= 2 ? 'inline' : 'responsive-stack');
  const isStackedMobile = resolvedLayout === 'responsive-stack';
  const gridColsClass = GRID_COLS_BY_COUNT[tabs.length] ?? 'flex items-center';
  const trackContainerClass = GRID_COLS_BY_COUNT[tabs.length]
    ? `grid ${gridColsClass}`
    : gridColsClass;

  const activeIdx = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );

  return (
    <div
      ref={trackRef}
      role={navRole ?? undefined}
      aria-label={ariaLabel}
      data-no-swipe="true"
      onKeyDown={useKeyboardNavigation ? handleKeyDown : undefined}
      {...createTabScrubberHandlers(onSelectTab)}
      className={`relative ${trackContainerClass} gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-muted/55 border border-border rounded-2xl w-full select-none touch-pan-y ${trackClassName}`.trim()}
    >
      {isCapsuleGliding && (
        <span
          data-testid={capsuleTestId}
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-xl bg-card border border-primary shadow-xs pointer-events-none transition-[transform,width,height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translate3d(${capsuleRect?.left ?? 0}px, ${capsuleRect?.top ?? 0}px, 0)`,
            width: `${capsuleRect?.width ?? 0}px`,
            height: `${capsuleRect?.height ?? 0}px`,
          }}
        />
      )}

      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const distance = Math.abs(index - activeIdx);
        const resolvedAriaLabel = tab.ariaLabel ?? tab.label;
        const resolvedTitle = tab.title ?? resolvedAriaLabel;
        const showCount =
          typeof tab.count === 'number' && (!tab.hideZeroCount || tab.count > 0);

        const selectionProps =
          selectionAttr === 'aria-pressed'
            ? { 'aria-pressed': isActive }
            : { 'aria-selected': isActive };

        const stateSurfaceClass = isActive
          ? isCapsuleGliding
            ? 'text-foreground bg-transparent border-transparent'
            : 'text-foreground bg-card border-primary shadow-xs'
          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-background/40';

        const layoutPaddingClass = isStackedMobile
          ? 'flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1.5 sm:px-2.5 md:px-3 py-2 md:py-2.5'
          : 'flex items-center justify-center gap-2 px-2.5 sm:px-3 py-2';

        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[tab.id] = el;
            }}
            id={tab.buttonId}
            type="button"
            role={buttonRole ?? undefined}
            data-tab-id={tab.id}
            data-tab-distance={distance}
            data-testid={tab.testId}
            {...selectionProps}
            aria-controls={tab.ariaControls}
            aria-label={resolvedAriaLabel}
            title={resolvedTitle}
            tabIndex={useKeyboardNavigation ? (isActive ? 0 : -1) : undefined}
            onClick={() => invokeSelect(tab.id)}
            className={`relative z-10 w-full min-w-0 ${layoutPaddingClass} rounded-xl font-semibold whitespace-nowrap border transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] [-webkit-tap-highlight-color:transparent] cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${stateSurfaceClass}`}
          >
            {tab.icon}
            {isStackedMobile ? (
              tab.mobileLabel ? (
                <>
                  <span className="md:hidden text-[10px] sm:text-[11px] leading-none truncate max-w-full">
                    {tab.mobileLabel}
                  </span>
                  <span className="hidden md:inline text-xs lg:text-sm truncate">
                    {tab.label}
                  </span>
                </>
              ) : (
                <span className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm leading-none md:leading-normal truncate max-w-full">
                  {tab.label}
                </span>
              )
            ) : tab.mobileLabel ? (
              <>
                <span className="sm:hidden text-xs leading-none truncate max-w-full">
                  {tab.mobileLabel}
                </span>
                <span className="hidden sm:inline text-xs truncate">
                  {tab.label}
                </span>
              </>
            ) : (
              <span className="text-xs truncate max-w-full">{tab.label}</span>
            )}
            {showCount && (
              <span
                data-testid={tab.countTestId}
                className={`${isStackedMobile ? 'md:static absolute top-1 right-1.5 ' : ''}px-1.5 py-0.2 rounded-full text-[10px] leading-none font-mono font-bold ${resolveCountBadgeColor(tab.countVariant, isActive)}`.trim()}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shared responsive tab navigation strip supporting both `'underline'`
 * (editorial underline + optional accordion scrub) and zero-shift `'recessed-capsule'`
 * (equal-width grid track + GPU `translate3d` gliding card capsule) variants.
 */
export function EditorialUnderlineTabs<T extends string = string>(
  props: EditorialUnderlineTabsProps<T>
) {
  if (props.variant === 'recessed-capsule') {
    return <RecessedCapsuleTabs {...props} />;
  }

  const {
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
  } = props;

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

          const countColorClass = resolveCountBadgeColor(tab.countVariant, isActive);

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
