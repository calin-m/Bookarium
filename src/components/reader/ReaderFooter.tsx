'use client';

import React, { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  BookMarked,
  Sparkles,
  Search,
  Settings,
  Sliders,
  Headphones,
  Highlighter,
  Sun,
  Moon,
  Coffee,
  Globe,
  GripHorizontal,
} from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme, NEXT_READER_THEME } from '@/config/reader-themes';

export interface ReaderFooterProps {
  globalPage: number;
  totalBookPages: number;
  chapterTitle: string;
  chapterPage: number;
  chapterPageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageJump?: (page: number) => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  readingMode: 'paginated' | 'scroll';
  theme?: ReaderTheme;
  currentChapterIndex?: number;
  totalChapters?: number;
  onSelectChapter?: (index: number) => void;
  onToggleToc?: () => void;
  onToggleControls?: () => void;
  onToggleSearch?: () => void;
  onToggleSpeech?: () => void;
  onToggleAnnotations?: () => void;
  onToggleTranslations?: () => void;
  onThemeChange?: (theme: ReaderTheme) => void;
  isTocOpen?: boolean;
  isControlsOpen?: boolean;
  isSearchOpen?: boolean;
  isSpeechOpen?: boolean;
  isAnnotationsOpen?: boolean;
  isTranslationsOpen?: boolean;
  isSelectionPopoverOpen?: boolean;
  annotationsCount?: number;
  isHidden?: boolean;
}

export const ReaderFooter: React.FC<ReaderFooterProps> = ({
  globalPage,
  totalBookPages,
  chapterTitle,
  chapterPage,
  chapterPageCount,
  onPrevPage,
  onNextPage,
  onPageJump,
  isPrevDisabled,
  isNextDisabled,
  readingMode,
  theme = 'light',
  currentChapterIndex = 0,
  totalChapters = 1,
  onSelectChapter,
  onToggleToc,
  onToggleControls,
  onToggleSearch,
  onToggleSpeech,
  onToggleAnnotations,
  onToggleTranslations,
  onThemeChange,
  isTocOpen = false,
  isControlsOpen = false,
  isSearchOpen = false,
  isSpeechOpen = false,
  isAnnotationsOpen = false,
  isTranslationsOpen = false,
  isSelectionPopoverOpen = false,
  annotationsCount = 0,
  isHidden = false,
}) => {
  const activeTheme = getReaderTheme(theme);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isToolbarIdle, setIsToolbarIdle] = useState(false);
  const [userBottomOffset, setUserBottomOffset] = useState<number>(96);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);

  const hasSecondaryTools = Boolean(
    onToggleSpeech ||
      onToggleAnnotations ||
      onToggleControls ||
      onToggleTranslations ||
      onThemeChange
  );
  const isAnySecondaryToolActive = Boolean(
    isSpeechOpen || isAnnotationsOpen || isControlsOpen || isTranslationsOpen
  );
  const isAnyModalDrawerOpen = Boolean(
    isTocOpen ||
      isSearchOpen ||
      isControlsOpen ||
      isAnnotationsOpen ||
      isTranslationsOpen ||
      isSelectionPopoverOpen
  );
  const effectiveToolsMenuOpen = isToolsMenuOpen && !isHidden && !isAnyModalDrawerOpen;

  // Dynamically detect whether ReaderSpeechBar is minimized ([data-testid="speech-bar-minimized"]) or expanded
  const isSpeechMinimized = useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        if (!isSpeechOpen || typeof document === 'undefined') {
          return () => {};
        }
        const observer = new MutationObserver(onStoreChange);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      },
      [isSpeechOpen]
    ),
    () =>
      isSpeechOpen && typeof document !== 'undefined'
        ? Boolean(document.querySelector('[data-testid="speech-bar-minimized"]'))
        : false,
    () => false
  );

  const minBottomPx = !isSpeechOpen ? 96 : isSpeechMinimized ? 152 : 252;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxBottomPx = Math.max(minBottomPx, viewportH - 340);
  const effectiveBottomPx = Math.min(maxBottomPx, Math.max(minBottomPx, userBottomOffset));

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const pauseIdleTimerAndWake = useCallback(() => {
    clearIdleTimer();
    setIsToolbarIdle(false);
  }, [clearIdleTimer]);

  const scheduleIdleDim = useCallback(() => {
    clearIdleTimer();
    setIsToolbarIdle(false);
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      setIsToolbarIdle(true);
    }, 3000);
  }, [clearIdleTimer]);

  // Automatically start 3.0s post-open/post-restore countdown when vertical toolbar becomes visible
  useEffect(() => {
    clearIdleTimer();
    if (!effectiveToolsMenuOpen || isDraggingToolbar) {
      return;
    }

    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      setIsToolbarIdle(true);
    }, 3000);

    return () => {
      clearIdleTimer();
    };
  }, [effectiveToolsMenuOpen, isDraggingToolbar, clearIdleTimer]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      clearIdleTimer();
    };
  }, [clearIdleTimer]);

  const handleStartToolbarDrag = useCallback(
    (startClientY: number, startClientX = 0, isFromDragHandle = false) => {
      if (!Number.isFinite(startClientY)) return;
      dragCleanupRef.current?.();
      pauseIdleTimerAndWake();
      suppressNextClickRef.current = false;
      let hasCrossedThreshold = false;
      let hasSampledMove = false;
      let dismissedBySwipeRight = false;
      const startBottom = effectiveBottomPx;
      let currentBottom = startBottom;
      let lastY = startClientY;
      let lastTime = Date.now();
      let velocityY = 0;

      const updatePosition = (clientY: number, clientX = startClientX) => {
        if (!Number.isFinite(clientY)) return;
        const deltaY = startClientY - clientY;
        const deltaX = Number.isFinite(clientX) ? clientX - startClientX : 0;

        // Horizontal swipe-right toward screen edge dismisses/tucks the floating toolbar
        if (deltaX > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
          dismissedBySwipeRight = true;
          if (!isFromDragHandle) {
            suppressNextClickRef.current = true;
          }
          return;
        }

        if (!hasCrossedThreshold && Math.abs(deltaY) <= 6) {
          return;
        }
        hasCrossedThreshold = true;
        if (!isFromDragHandle) {
          suppressNextClickRef.current = true;
        }
        setIsDraggingToolbar(true);

        const now = Date.now();
        if (hasSampledMove) {
          const dt = now - lastTime;
          if (dt >= 8 && dt <= 120) {
            const rawVy = (lastY - clientY) / dt;
            velocityY = Math.max(-2.5, Math.min(2.5, rawVy));
          } else if (dt > 120) {
            velocityY = 0;
          }
        }
        hasSampledMove = true;
        lastY = clientY;
        lastTime = now;

        const currentViewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
        const currentMaxBottom = Math.max(minBottomPx, currentViewportH - 340);
        currentBottom = Math.min(currentMaxBottom, Math.max(minBottomPx, startBottom + deltaY));
        setUserBottomOffset(Math.round(currentBottom));
      };

      const handlePointerMove = (e: PointerEvent) => updatePosition(e.clientY, e.clientX);
      const handleMouseMove = (e: MouseEvent) => updatePosition(e.clientY, e.clientX);
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          updatePosition(e.touches[0].clientY, e.touches[0].clientX);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('pointerup', handleEnd);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('touchcancel', handleEnd);
        dragCleanupRef.current = null;
      };

      const handleEnd = (e: Event) => {
        cleanup();
        if (e.type === 'touchend' || e.type === 'touchcancel') {
          suppressNextClickRef.current = false;
        }
        setIsDraggingToolbar(false);

        if (dismissedBySwipeRight) {
          suppressNextClickRef.current = false;
          setIsToolsMenuOpen(false);
          return;
        }

        if (hasCrossedThreshold && Date.now() - lastTime <= 80 && Math.abs(velocityY) > 0.15) {
          const currentViewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
          const currentMaxBottom = Math.max(minBottomPx, currentViewportH - 340);
          const projectedBottom = Math.min(
            currentMaxBottom,
            Math.max(minBottomPx, currentBottom + velocityY * 140)
          );
          setUserBottomOffset(Math.round(projectedBottom));
        }

        scheduleIdleDim();
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('pointerup', handleEnd);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('touchcancel', handleEnd);
      dragCleanupRef.current = cleanup;
    },
    [effectiveBottomPx, minBottomPx, pauseIdleTimerAndWake, scheduleIdleDim]
  );

  return (
    <footer
      data-bars-hidden={isHidden ? 'true' : 'false'}
      aria-hidden={isHidden || undefined}
      className={`fixed bottom-0 inset-x-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom,0px)] transition-[transform,opacity,background-color,border-color,color] duration-300 ease-in-out ${activeTheme.footer} ${
        isHidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Mobile & Tablet Top Tier: Contoured Chapter Button & [Search + Settings] Controls (< lg) */}
      <div className={`lg:hidden w-full px-3 sm:px-6 py-1.5 border-b ${activeTheme.border} flex items-center justify-between gap-2 text-xs font-mono transition-colors duration-theme`}>
        {/* Left: Contoured Chapter / Table of Contents Button */}
        <button
          type="button"
          onClick={() => {
            scheduleIdleDim();
            onToggleToc?.();
          }}
          disabled={!onToggleToc}
          aria-expanded={isTocOpen}
          className={`inline-flex items-center gap-1.5 min-w-0 max-w-[calc(100%-5.75rem)] min-h-[34px] px-3 py-1.5 rounded-lg border shadow-2xs text-left text-[13px] truncate transition-all active:scale-98 ${
            isTocOpen ? activeTheme.activePill : activeTheme.button
          } ${onToggleToc ? 'cursor-pointer' : 'pointer-events-none opacity-75'}`}
          title="Open Table of Contents"
          aria-label="Open Table of Contents"
          data-testid="footer-toc-trigger"
        >
          <BookMarked className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="font-serif font-medium truncate" title={chapterTitle || 'Preamble'}>
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className={`text-[11px] font-mono shrink-0 ${isTocOpen ? 'opacity-85' : activeTheme.textMuted}`}>
              ({chapterPage}/{chapterPageCount})
            </span>
          )}
          {onToggleToc && (
            <ChevronUp
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 opacity-65 ${
                isTocOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          )}
        </button>

        {/* Right: Search Button + Rightmost Settings Toggle & Vertical Draggable Floating Toolbar */}
        <div
          className="relative flex items-center gap-1.5 shrink-0"
          data-testid="footer-quick-tools"
        >
          {onToggleSearch && (
            <button
              type="button"
              onClick={() => {
                scheduleIdleDim();
                onToggleSearch();
              }}
              aria-label="Search in Book"
              title="Search in Book"
              className={`p-2 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isSearchOpen ? activeTheme.activePill : activeTheme.button
              }`}
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {hasSecondaryTools && (
            <button
              type="button"
              onClick={() => {
                scheduleIdleDim();
                setIsToolsMenuOpen((prev) => !prev);
              }}
              aria-label="Reader Settings & Tools"
              aria-expanded={effectiveToolsMenuOpen}
              title="Reader Settings & Tools"
              data-testid="footer-settings-toggle"
              className={`relative p-2 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isToolsMenuOpen || isAnySecondaryToolActive
                  ? activeTheme.activePill
                  : activeTheme.button
              }`}
            >
              <Settings
                className={`w-4 h-4 transition-transform duration-200 ${
                  isToolsMenuOpen ? 'rotate-90' : ''
                }`}
              />
            </button>
          )}

          {/* Right-Edge Vertical Floating Toolbar via Document Portal (z-[10002] Above Read Aloud Bar) */}
          {effectiveToolsMenuOpen &&
            hasSecondaryTools &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                role="toolbar"
                aria-label="Mobile Reader Tools"
                data-testid="footer-floating-tools-bar"
                data-prevent-swipe
                onPointerEnter={pauseIdleTimerAndWake}
                onPointerLeave={scheduleIdleDim}
                onPointerDown={(e) => {
                  handleStartToolbarDrag(e.clientY, e.clientX, false);
                }}
                onMouseDown={(e) => {
                  handleStartToolbarDrag(e.clientY, e.clientX, false);
                }}
                onTouchStart={(e) => {
                  if (e.touches.length > 0) {
                    handleStartToolbarDrag(e.touches[0].clientY, e.touches[0].clientX, false);
                  } else {
                    scheduleIdleDim();
                  }
                }}
                onClickCapture={(e) => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  scheduleIdleDim();
                }}
                style={{ bottom: `${effectiveBottomPx}px` }}
                className={`fixed right-2.5 sm:right-4 z-[10002] lg:hidden flex flex-col items-center gap-1.5 p-1.5 rounded-2xl border backdrop-blur-xs origin-bottom-right ${
                  isDraggingToolbar
                    ? 'transition-opacity duration-200'
                    : 'transition-[bottom,opacity,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] animate-in fade-in zoom-in-95'
                } ${
                  isDraggingToolbar || !isToolbarIdle
                    ? 'opacity-100 shadow-xl'
                    : 'opacity-35 hover:opacity-100 shadow-sm'
                } ${activeTheme.drawerBg} ${activeTheme.border}`}
              >
                {/* Top Enlarged Vertical Drag Handle Capsule */}
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Drag to reposition reader tools vertically"
                  aria-orientation="vertical"
                  aria-valuemin={minBottomPx}
                  aria-valuemax={maxBottomPx}
                  aria-valuenow={effectiveBottomPx}
                  data-testid="footer-floating-tools-drag-handle"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStartToolbarDrag(e.clientY, e.clientX, true);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStartToolbarDrag(e.clientY, e.clientX, true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length > 0) {
                      handleStartToolbarDrag(e.touches[0].clientY, e.touches[0].clientX, true);
                    } else {
                      scheduleIdleDim();
                    }
                  }}
                  className={`w-full flex items-center justify-center py-1.5 px-2 border-b ${activeTheme.border} rounded-t-lg cursor-grab active:cursor-grabbing touch-none select-none ${activeTheme.textMuted} hover:text-foreground transition-colors`}
                  title="Drag up or down to reposition toolbar"
                >
                  <GripHorizontal className="w-4 h-4 opacity-70" />
                </div>

                {onThemeChange && (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleIdleDim();
                      onThemeChange(NEXT_READER_THEME[theme]);
                    }}
                    aria-label={`Current theme: ${theme}. Click to switch theme.`}
                    title={`Current theme: ${theme}. Click to switch theme.`}
                    className={`p-2 rounded-xl border shrink-0 transition-all cursor-pointer active:scale-95 ${activeTheme.button}`}
                  >
                    {theme === 'light' ? (
                      <Sun className="w-4 h-4 text-amber-500" />
                    ) : theme === 'sepia' ? (
                      <Coffee className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Moon className="w-4 h-4 text-indigo-400" />
                    )}
                  </button>
                )}

                {onToggleControls && (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleIdleDim();
                      onToggleControls();
                    }}
                    aria-label="Typography & Theme Controls"
                    title="Typography & Appearance"
                    className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      isControlsOpen ? activeTheme.activePill : activeTheme.button
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                )}

                {onToggleAnnotations && (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleIdleDim();
                      onToggleAnnotations();
                    }}
                    aria-label="Notes & Highlights"
                    title="View Notes & Highlights"
                    className={`relative p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      isAnnotationsOpen ? activeTheme.activePill : activeTheme.button
                    }`}
                  >
                    <Highlighter className="w-4 h-4" />
                    {annotationsCount > 0 && (
                      <span
                        data-testid="footer-annotations-badge"
                        className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary-600 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-2xs"
                      >
                        {annotationsCount > 99 ? '99+' : annotationsCount}
                      </span>
                    )}
                  </button>
                )}

                {onToggleSpeech && (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleIdleDim();
                      onToggleSpeech();
                    }}
                    aria-label="Read Aloud Narration"
                    title="Listen with Read Aloud"
                    className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      isSpeechOpen ? activeTheme.activePill : activeTheme.button
                    }`}
                  >
                    <Headphones className="w-4 h-4" />
                  </button>
                )}

                {onToggleTranslations && (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleIdleDim();
                      onToggleTranslations();
                    }}
                    aria-label="Language Editions & Translations"
                    title="Translations"
                    className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      isTranslationsOpen ? activeTheme.activePill : activeTheme.button
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                )}
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* Main Footer Controls Bar */}
      <div className="w-full px-3 sm:px-6 md:px-8 h-12 flex lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-between lg:justify-normal gap-2 sm:gap-4 font-mono text-xs select-none">
        
        {/* Desktop Left Track (hidden on mobile/tablet, visible lg:flex) */}
        <div className="hidden lg:flex items-center gap-2 min-w-0 justify-self-start">
          <BookMarked className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="font-serif font-medium truncate" title={chapterTitle || 'Preamble'}>
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className={`text-[11px] font-mono shrink-0 ${activeTheme.textMuted}`}>
              (Sec. p. {chapterPage}/{chapterPageCount})
            </span>
          )}
        </div>

        {/* Center Track (auto): Page Input */}
        <div className="flex items-center justify-center lg:justify-self-center">
          {readingMode === 'paginated' ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`hidden sm:inline ${activeTheme.textMuted}`}>Page</span>
              <input
                type="number"
                role="spinbutton"
                min={1}
                max={totalBookPages}
                value={globalPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= totalBookPages && onPageJump) {
                    onPageJump(val);
                  }
                }}
                className={`w-12 sm:w-14 min-h-[32px] sm:min-h-0 text-center py-1 sm:py-0.5 rounded border ${activeTheme.border} bg-transparent font-bold focus:outline-hidden focus:ring-1 focus:ring-primary-500`}
                aria-label="Current Page Number"
                aria-valuemin={1}
                aria-valuemax={totalBookPages}
                aria-valuenow={globalPage}
              />
              <span className={activeTheme.textMuted}>of {totalBookPages}</span>
              <span className={`hidden lg:inline text-[10px] opacity-60 ml-1`}>
                • ❦ Public Domain ❦
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              <span className={activeTheme.textMuted}>
                Chapter {currentChapterIndex + 1} of {totalChapters}
              </span>
            </div>
          )}
        </div>

        {/* Right Track (1fr): Prev / Next Navigation */}
        <div className="flex items-center gap-1.5 shrink-0 lg:justify-self-end">
          {readingMode === 'paginated' ? (
            <>
              <button
                type="button"
                onClick={onPrevPage}
                disabled={isPrevDisabled}
                className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-3 py-1 rounded-lg border font-bold text-xs transition-all shadow-xs active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={onNextPage}
                disabled={isNextDisabled}
                className="inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-3 py-1 rounded-lg font-bold text-xs bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </>
          ) : (
            onSelectChapter && totalChapters > 1 && (
              <>
                <button
                  type="button"
                  disabled={currentChapterIndex <= 0}
                  onClick={() => onSelectChapter(currentChapterIndex - 1)}
                  className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Previous Chapter"
                >
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Prev Chapter</span>
                </button>
                <button
                  type="button"
                  disabled={currentChapterIndex >= totalChapters - 1}
                  onClick={() => onSelectChapter(currentChapterIndex + 1)}
                  className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Next Chapter"
                >
                  <span>Next Chapter</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </>
            )
          )}
        </div>

      </div>
    </footer>
  );
};
