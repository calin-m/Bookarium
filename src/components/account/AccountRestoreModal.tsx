'use client';

import React, { useState } from 'react';
import { Upload, AlertTriangle, BookOpen, Layers, Bookmark, FileText, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { LibraryBackupPayload, RestoreSummary } from '@/lib/library-backup';

export interface AccountRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupData: LibraryBackupPayload | null;
  onRestore: (strategy: 'merge' | 'replace') => Promise<void>;
  isRestoring: boolean;
  restoreSuccess?: RestoreSummary | null;
  restoreError?: string | null;
}

export const AccountRestoreModal: React.FC<AccountRestoreModalProps> = ({
  isOpen,
  onClose,
  backupData,
  onRestore,
  isRestoring,
  restoreSuccess,
  restoreError,
}) => {
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');

  if (!backupData && !restoreSuccess) return null;

  const exportedDate = backupData?.exportedAt
    ? new Date(backupData.exportedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown Date';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={restoreSuccess ? 'Library Restored' : 'Restore Library Backup'}
      maxWidth="md"
    >
      <div className="p-6 space-y-5" data-testid="restore-backup-modal">
        {restoreSuccess ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-border text-primary flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-serif font-bold text-base text-foreground">
                Backup Successfully Restored
              </h3>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                Your reading library has been updated with {restoreSuccess.booksRestored} volumes,{' '}
                {restoreSuccess.annotationsRestored} notes & quotes, and{' '}
                {restoreSuccess.bookmarksRestored} reading coordinates.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
                className="font-mono text-xs uppercase"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Backup Meta Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pb-1 border-b border-border/60">
                <span>Backup Created:</span>
                <span className="font-semibold text-foreground">{exportedDate}</span>
              </div>

              {/* Stat badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl border border-border bg-muted/30 flex flex-col items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-mono font-bold text-foreground">
                    {backupData?.summary.bookCount ?? 0}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Volumes
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-border bg-muted/30 flex flex-col items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-mono font-bold text-foreground">
                    {backupData?.summary.customShelfCount ?? 0}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Shelves
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-border bg-muted/30 flex flex-col items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-mono font-bold text-foreground">
                    {backupData?.summary.annotationCount ?? 0}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Notes
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-border bg-muted/30 flex flex-col items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-mono font-bold text-foreground">
                    {backupData?.summary.bookmarkCount ?? 0}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Bookmarks
                  </span>
                </div>
              </div>
            </div>

            {/* Strategy Selection */}
            <div className="space-y-2.5 pt-1">
              <label className="text-xs font-mono font-semibold uppercase text-muted-foreground tracking-wider">
                Restore Method
              </label>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setStrategy('merge')}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    strategy === 'merge'
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-foreground">
                      Merge with Existing Library (Recommended)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                      Safe
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-muted-foreground mt-1 leading-relaxed">
                    Adds missing books, shelves, notes, and newer reading coordinates without deleting any current items.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('replace')}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    strategy === 'replace'
                      ? 'border-destructive bg-destructive/10 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-foreground">
                      Replace Entire Library
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-bold">
                      Overwrites
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-muted-foreground mt-1 leading-relaxed">
                    Overwrites your local shelves, notes, and reading positions to match this backup exactly.
                  </p>
                </button>
              </div>
            </div>

            {strategy === 'replace' && (
              <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 flex items-start gap-2.5 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-sans leading-relaxed">
                  <strong>Warning:</strong> Replace mode will delete any local books, shelves, or notes that are not present in this backup file.
                </p>
              </div>
            )}

            {restoreError && (
              <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-xs text-destructive font-mono">
                {restoreError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isRestoring}
                className="font-mono text-xs uppercase"
              >
                Cancel
              </Button>
              <Button
                variant={strategy === 'replace' ? 'destructive' : 'primary'}
                size="sm"
                onClick={() => onRestore(strategy)}
                disabled={isRestoring}
                className="font-mono text-xs uppercase flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <span>Restoring...</span>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Confirm & Restore</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

