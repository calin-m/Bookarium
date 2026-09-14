'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cn } from '@/lib/utils';

export interface ReaderDrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  titleIcon?: React.ReactNode;
  theme?: ReaderTheme;
  children: React.ReactNode;
  ariaLabel: string;
  closeAriaLabel?: string;
  backdropTestId?: string;
  panelTestId?: string;
  className?: string;
  role?: 'region' | 'dialog';
}

export const ReaderDrawerShell: React.FC<ReaderDrawerShellProps> = ({
  isOpen,
  onClose,
  title,
  titleIcon,
  theme = 'light',
  children,
  ariaLabel,
  closeAriaLabel,
  backdropTestId,
  panelTestId,
  className = '',
  role = 'region',
}) => {
  const hasMounted = useHasMounted();
  const activeTheme = getReaderTheme(theme);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!hasMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fluid Backdrop Fade (Subtle dim on mobile, transparent on desktop) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-xs sm:bg-transparent sm:backdrop-blur-none touch-none"
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
            aria-hidden="true"
            data-testid={backdropTestId}
          />

          {/* Fluid Spring Drawer Panel: Bottom Sheet on Mobile, Top-Right Dropdown on Desktop */}
          <motion.div
            initial={{ opacity: 0, y: typeof window !== 'undefined' && window.innerWidth < 640 ? 50 : -10, scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: typeof window !== 'undefined' && window.innerWidth < 640 ? 40 : -8, scale: typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed z-[9999] p-4 sm:p-4.5 flex flex-col min-h-0 overflow-hidden shadow-2xl overscroll-contain',
              // Mobile (< sm): Native Bottom Sheet pinned to bottom edge
              'bottom-0 inset-x-0 w-full max-h-[85dvh] rounded-t-2xl border-t border-x-0 origin-bottom',
              // Desktop (sm+): Floating card pinned below header on right
              'sm:bottom-auto sm:top-[5.875rem] sm:inset-x-auto sm:right-6 md:right-8 sm:w-96 sm:max-w-md sm:max-h-[calc(100dvh-11.5rem)] sm:rounded-xl sm:border sm:origin-top-right',
              activeTheme.drawerBg,
              activeTheme.border,
              className
            )}
            role={role}
            aria-label={ariaLabel}
            data-testid={panelTestId}
          >
            {/* Mobile Grab Handle Bar */}
            <div
              className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto -mt-1 mb-2.5 shrink-0 sm:hidden"
              aria-hidden="true"
              data-testid="reader-drawer-grab-handle"
            />

            {/* Standard Reader Drawer Header */}
            <div className={`flex items-center justify-between pb-2 mb-3 border-b shrink-0 ${activeTheme.border}`}>
              <div className="flex items-center gap-2 min-w-0">
                {titleIcon}
                <div className="min-w-0">
                  {typeof title === 'string' ? (
                    <h3 className="font-serif font-bold text-sm leading-tight truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer active:scale-95 ${activeTheme.button}`}
                aria-label={closeAriaLabel || (typeof title === 'string' ? `Close ${title}` : 'Close Drawer')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable / Flexible Drawer Content */}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
