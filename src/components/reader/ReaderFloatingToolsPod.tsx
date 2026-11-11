'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import {
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

export interface ReaderFloatingToolsPodProps {
  theme?: ReaderTheme;
  onToggleSearch?: () => void;
  onToggleControls?: () => void;
  onToggleAnnotations?: () => void;
  onToggleSpeech?: () => void;
  onToggleTranslations?: () => void;
  onThemeChange?: (theme: ReaderTheme) => void;
  isTocOpen?: boolean;
  isSearchOpen?: boolean;
  isControlsOpen?: boolean;
  isAnnotationsOpen?: boolean;
  isSpeechOpen?: boolean;
  isTranslationsOpen?: boolean;
  isSelectionPopoverOpen?: boolean;
  annotationsCount?: number;
  isHidden?: boolean;
  /** Optional ref for parent (e.g. TOC button) to trigger idle timer reset */
  scheduleIdleDimRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Right-Edge Vertical Draggable Floating Tools Pod & Quick-Tools Bar (`< lg`)
 * rendered via Document Portal (`z-[10002]` above `ReaderSpeechBar`).
 * Supports inertial vertical drag physics, horizontal swipe-right dismissal,
 * `MutationObserver` speech-bar minimization tracking, and a 3.0s auto-dim timer.
 */
export const ReaderFloatingToolsPod: React.FC<
  ReaderFloatingToolsPodProps
> = ({
  theme = 'light',
  onToggleSearch,
  onToggleControls,
  onToggleAnnotations,
  onToggleSpeech,
  onToggleTranslations,
  onThemeChange,
  isTocOpen = false,
  isSearchOpen = false,
  isControlsOpen = false,
  isAnnotationsOpen = false,
  isSpeechOpen = false,
  isTranslationsOpen = false,
  isSelectionPopoverOpen = false,
  annotationsCount = 0,
  isHidden = false,
  scheduleIdleDimRef,
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
    isSpeechOpen ||
      isAnnotationsOpen ||
      isControlsOpen ||
      isTranslationsOpen
  );
  const isAnyModalDrawerOpen = Boolean(
    isTocOpen ||
      isSearchOpen ||
      isControlsOpen ||
      isAnnotationsOpen ||
      isTranslationsOpen ||
      isSelectionPopoverOpen
  );
  const effectiveToolsMenuOpen =
    isToolsMenuOpen && !isHidden && !isAnyModalDrawerOpen;

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
        ? Boolean(
            document.querySelector('[data-testid="speech-bar-minimized"]')
          )
        : false,
    () => false
  );

  const minBottomPx = !isSpeechOpen ? 96 : isSpeechMinimized ? 152 : 252;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxBottomPx = Math.max(minBottomPx, viewportH - 340);
  const effectiveBottomPx = Math.min(
    maxBottomPx,
    Math.max(minBottomPx, userBottomOffset)
  );

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

  useEffect(() => {
    if (scheduleIdleDimRef) {
      scheduleIdleDimRef.current = scheduleIdleDim;
    }
    return () => {
      if (scheduleIdleDimRef) {
        scheduleIdleDimRef.current = null;
      }
    };
  }, [scheduleIdleDimRef, scheduleIdleDim]);

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

        const currentViewportH =
          typeof window !== 'undefined' ? window.innerHeight : 800;
        const currentMaxBottom = Math.max(
          minBottomPx,
          currentViewportH - 340
        );
        currentBottom = Math.min(
          currentMaxBottom,
          Math.max(minBottomPx, startBottom + deltaY)
        );
        setUserBottomOffset(Math.round(currentBottom));
      };

      const handlePointerMove = (e: PointerEvent) =>
        updatePosition(e.clientY, e.clientX);
      const handleMouseMove = (e: MouseEvent) =>
        updatePosition(e.clientY, e.clientX);
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

        if (
          hasCrossedThreshold &&
          Date.now() - lastTime <= 80 &&
          Math.abs(velocityY) > 0.15
        ) {
          const currentViewportH =
            typeof window !== 'undefined' ? window.innerHeight : 800;
          const currentMaxBottom = Math.max(
            minBottomPx,
            currentViewportH - 340
          );
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
                handleStartToolbarDrag(
                  e.touches[0].clientY,
                  e.touches[0].clientX,
                  false
                );
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
                  handleStartToolbarDrag(
                    e.touches[0].clientY,
                    e.touches[0].clientX,
                    true
                  );
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
                  isAnnotationsOpen
                    ? activeTheme.activePill
                    : activeTheme.button
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
                  isTranslationsOpen
                    ? activeTheme.activePill
                    : activeTheme.button
                }`}
              >
                <Globe className="w-4 h-4" />
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
