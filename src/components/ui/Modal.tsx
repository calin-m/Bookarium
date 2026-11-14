'use client';

import React, { useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  backdropClassName?: string;
  backdropTestId?: string;
  testId?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  maxWidth = '2xl',
  showCloseButton = true,
  backdropClassName,
  backdropTestId = 'modal-backdrop',
  testId,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocusTrap({
    isOpen,
    containerRef: dialogRef,
    onClose,
  });

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw] h-[92vh]',
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="modal-dialog-container"
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          data-testid={testId}
          data-no-swipe
        >
          {/* Fluid Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn('fixed inset-0 bg-black/60 backdrop-blur-2xs', backdropClassName)}
            onClick={onClose}
            data-testid={backdropTestId}
          />

          {/* Fluid Modal Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] bg-card text-foreground rounded-2xl shadow-2xl border border-border z-10 flex flex-col overflow-hidden',
              maxWidths[maxWidth],
              className
            )}
          >
            {(title || showCloseButton) && (
              <div className="shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border">
                {title && (
                  <h2 id={titleId} className="text-base sm:text-lg font-semibold text-foreground">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
