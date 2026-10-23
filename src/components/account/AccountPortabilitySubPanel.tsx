'use client';

import React, { useState, useRef } from 'react';
import { Check, Download, FileSpreadsheet, Upload, Database } from 'lucide-react';
import {
  downloadLibraryBackupJSON,
  exportLibraryToCSV,
  validateLibraryBackup,
  restoreLibraryBackup,
  type LibraryBackupPayload,
  type RestoreSummary,
} from '@/lib/library-backup';
import { AccountRestoreModal } from './AccountRestoreModal';

export interface AccountPortabilitySubPanelProps {
  isActive: boolean;
  userId?: string;
}

const MAX_BACKUP_SIZE_BYTES = 10 * 1024 * 1024; // 10MB payload ceiling

export const AccountPortabilitySubPanel: React.FC<AccountPortabilitySubPanelProps> = ({
  isActive,
  userId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<LibraryBackupPayload | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<RestoreSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<'json' | 'csv' | null>(null);

  const handleExportJSON = () => {
    downloadLibraryBackupJSON();
    setExportSuccess('json');
    setTimeout(() => setExportSuccess(null), 2500);
  };

  const handleExportCSV = () => {
    exportLibraryToCSV();
    setExportSuccess('csv');
    setTimeout(() => setExportSuccess(null), 2500);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setRestoreSuccess(null);
    setRestoreError(null);

    if (file.size > MAX_BACKUP_SIZE_BYTES) {
      setFileError(
        'File size exceeds the 10MB limit. Please upload a valid Bookarium backup file.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = validateLibraryBackup(parsed);

      if (!validation.valid || !validation.data) {
        setFileError(validation.error || 'Invalid backup file format.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedBackup(validation.data);
      setIsRestoreModalOpen(true);
    } catch {
      setFileError(
        'Failed to parse JSON file. Please ensure it is a valid Bookarium backup file.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = async (strategy: 'merge' | 'replace') => {
    if (!selectedBackup) return;
    setIsRestoring(true);
    setRestoreError(null);

    try {
      const summary = await restoreLibraryBackup(selectedBackup, strategy, userId);
      setRestoreSuccess(summary);
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore library backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCloseRestoreModal = () => {
    setIsRestoreModalOpen(false);
    setSelectedBackup(null);
    setRestoreSuccess(null);
    setRestoreError(null);
  };

  return (
    <>
      <div
        id="preferences-subpanel-portability"
        className={isActive ? 'space-y-4' : 'hidden'}
        data-testid="library-portability-section"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              Library Portability & Backups
            </h3>
          </div>
          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
            Download a complete portable snapshot of your books, shelves, quotes, and reading progress, or restore from a backup file.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* JSON Export */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono font-bold text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Export library backup in JSON format"
          >
            {exportSuccess === 'json' ? (
              <>
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary">Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Export JSON</span>
              </>
            )}
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono font-bold text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Export reading catalog in CSV format"
          >
            {exportSuccess === 'csv' ? (
              <>
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary">Downloaded!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export CSV</span>
              </>
            )}
          </button>

          {/* Import Backup */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono font-bold text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Import library backup from JSON file"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Import Backup</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileInputChange}
          className="hidden"
          data-testid="library-backup-file-input"
        />

        {fileError && (
          <div
            className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs font-mono text-destructive"
            role="alert"
          >
            {fileError}
          </div>
        )}
      </div>

      <AccountRestoreModal
        isOpen={isRestoreModalOpen}
        onClose={handleCloseRestoreModal}
        backupData={selectedBackup}
        onRestore={handleConfirmRestore}
        isRestoring={isRestoring}
        restoreSuccess={restoreSuccess}
        restoreError={restoreError}
      />
    </>
  );
};

