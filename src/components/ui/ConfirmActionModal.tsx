'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  heading: string;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  buttonSize?: 'sm' | 'chip' | 'md';
  modalTestId?: string;
  dialogTestId?: string;
  confirmTestId?: string;
  cancelTestId?: string;
}

/**
 * Reusable destructive/warning confirmation dialog built on `<Modal />`.
 * Standardizes the icon badge, heading, description, optional preview slot,
 * and Cancel / Confirm action bar across the application.
 */
export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  heading,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon,
  children,
  maxWidth = 'sm',
  buttonSize = 'chip',
  modalTestId,
  dialogTestId,
  confirmTestId,
  cancelTestId,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      backdropClassName="bg-transparent backdrop-blur-none"
      testId={modalTestId}
    >
      <div className="p-6 space-y-4" data-testid={dialogTestId}>
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
            {icon ?? <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm sm:text-base">{heading}</p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
            {children}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size={buttonSize}
            data-testid={cancelTestId}
            onClick={onClose}
            className={buttonSize === 'sm' ? 'text-xs font-mono uppercase' : undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size={buttonSize}
            data-testid={confirmTestId}
            onClick={onConfirm}
            className={`bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent ${
              buttonSize === 'sm' ? 'text-xs font-mono uppercase gap-1.5' : ''
            }`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
