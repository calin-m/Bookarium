'use client';

import React from 'react';
import { Mail, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface AccountDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  isSendingDeletionEmail: boolean;
  deletionEmailSent: boolean;
  deleteError: string | null;
  onRequestDeletion: () => Promise<void>;
}

export const AccountDeleteModal: React.FC<AccountDeleteModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  isSendingDeletionEmail,
  deletionEmailSent,
  deleteError,
  onRequestDeletion,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={deletionEmailSent ? 'Check Your Email' : 'Request Account Deletion'}
      maxWidth="md"
    >
      <div className="p-6 space-y-5" data-testid="delete-account-dialog">
        {deletionEmailSent ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-border text-destructive flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-serif font-bold text-base text-foreground">
                Verification Link Sent
              </h3>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                We sent a secure deletion confirmation link to <strong className="text-foreground">{userEmail}</strong>.
              </p>
              <p className="text-[11px] text-muted-foreground font-sans leading-relaxed pt-1">
                Please open the email on your device and click the link to finalize the permanent deletion of your account and cloud bookshelves.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="font-mono text-xs uppercase"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm sm:text-base">
                  Security Verification Required
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  For your security, deleting your account requires email confirmation. Clicking below will send a one-time verification link to <strong className="text-foreground">{userEmail}</strong>. Your account will <strong className="text-foreground">remain active</strong> until you click the confirmation link in that email.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{deleteError}</span>
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs font-mono uppercase"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSendingDeletionEmail}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
                onClick={onRequestDeletion}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send Deletion Link</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

