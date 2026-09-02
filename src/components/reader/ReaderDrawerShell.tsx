'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { useHasMounted } from '@/hooks/useHasMounted';

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
          {/* Fluid Backdrop Fade (Transparent to preserve reader visibility) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={onClose}
            aria-hidden="true"
            data-testid={backdropTestId}
          />

          {/* Fluid Spring Drawer Panel */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-[5.875rem] inset-x-3 sm:inset-x-auto sm:right-6 md:right-8 w-auto max-w-sm sm:w-96 mx-auto sm:mx-0 z-[9999] max-h-[calc(100dvh-11.5rem)] rounded-xl ${activeTheme.drawerBg} border ${activeTheme.border} shadow-2xl p-4 sm:p-4.5 flex flex-col origin-top sm:origin-top-right ${className}`}
            role={role}
            aria-label={ariaLabel}
            data-testid={panelTestId}
          >
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
