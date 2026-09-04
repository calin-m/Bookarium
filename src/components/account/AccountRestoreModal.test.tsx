import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountRestoreModal } from './AccountRestoreModal';
import type { LibraryBackupPayload } from '@/lib/library-backup';

const mockBackup: LibraryBackupPayload = {
  version: '1.0',
  app: 'Bookarium',
  exportedAt: '2026-09-04T10:00:00Z',
  summary: {
    bookCount: 15,
    customShelfCount: 3,
    favoriteCount: 7,
    annotationCount: 42,
    bookmarkCount: 5,
  },
  library: {
    savedBooks: [],
    readingQueue: [],
    favoriteBookIds: [],
    likedBookIds: [],
    customShelves: [],
  },
  reading: {
    positions: {},
    progress: {},
  },
  annotations: [],
  preferences: {},
};

describe('AccountRestoreModal', () => {
  it('renders nothing when closed or no backupData and no success', () => {
    const { container } = render(
      <AccountRestoreModal
        isOpen={false}
        onClose={vi.fn()}
        backupData={null}
        onRestore={vi.fn()}
        isRestoring={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders backup metadata counts and allows strategy switching', () => {
    const handleRestore = vi.fn();
    const handleClose = vi.fn();

    render(
      <AccountRestoreModal
        isOpen={true}
        onClose={handleClose}
        backupData={mockBackup}
        onRestore={handleRestore}
        isRestoring={false}
      />
    );

    expect(screen.getByText('Restore Library Backup')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // Volumes
    expect(screen.getByText('3')).toBeInTheDocument(); // Shelves
    expect(screen.getByText('42')).toBeInTheDocument(); // Notes
    expect(screen.getByText('5')).toBeInTheDocument(); // Bookmarks

    // Default strategy is merge
    const restoreBtn = screen.getByRole('button', { name: /Confirm & Restore/i });
    fireEvent.click(restoreBtn);
    expect(handleRestore).toHaveBeenCalledWith('merge');

    // Switch to replace strategy
    const replaceBtn = screen.getByRole('button', { name: /Replace Entire Library/i });
    fireEvent.click(replaceBtn);

    // Warning should appear
    expect(screen.getByText(/Replace mode will delete any local books/i)).toBeInTheDocument();

    const updatedRestoreBtn = screen.getByRole('button', { name: /Confirm & Restore/i });
    fireEvent.click(updatedRestoreBtn);
    expect(handleRestore).toHaveBeenLastCalledWith('replace');
  });

  it('displays loading state while restoring', () => {
    render(
      <AccountRestoreModal
        isOpen={true}
        onClose={vi.fn()}
        backupData={mockBackup}
        onRestore={vi.fn()}
        isRestoring={true}
      />
    );

    expect(screen.getByText('Restoring...')).toBeInTheDocument();
  });

  it('displays error message if restore failed', () => {
    render(
      <AccountRestoreModal
        isOpen={true}
        onClose={vi.fn()}
        backupData={mockBackup}
        onRestore={vi.fn()}
        isRestoring={false}
        restoreError="Database timeout during restore"
      />
    );

    expect(screen.getByText('Database timeout during restore')).toBeInTheDocument();
  });

  it('displays success state when restore succeeds', () => {
    const handleClose = vi.fn();

    render(
      <AccountRestoreModal
        isOpen={true}
        onClose={handleClose}
        backupData={mockBackup}
        onRestore={vi.fn()}
        isRestoring={false}
        restoreSuccess={{
          booksRestored: 15,
          shelvesRestored: 3,
          favoritesRestored: 7,
          annotationsRestored: 42,
          bookmarksRestored: 5,
        }}
      />
    );

    expect(screen.getByText('Library Restored')).toBeInTheDocument();
    expect(screen.getByText('Backup Successfully Restored')).toBeInTheDocument();
    expect(screen.getByText(/15 volumes, 42 notes & quotes, and 5 reading coordinates/i)).toBeInTheDocument();

    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
