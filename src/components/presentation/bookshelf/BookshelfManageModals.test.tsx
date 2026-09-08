import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookshelfManageModals } from './BookshelfManageModals';

describe('BookshelfManageModals Component', () => {
  it('renders create modal and submits new shelf', () => {
    const handleCreate = vi.fn((e) => e.preventDefault());
    const handleNameChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <BookshelfManageModals
        isCreatingShelf={true}
        newShelfName="Philosophy"
        onNewShelfNameChange={handleNameChange}
        onCloseCreateShelf={handleClose}
        onCreateShelf={handleCreate}
        editingShelfId={null}
        editingShelfName=""
        onEditingShelfNameChange={vi.fn()}
        onCloseRenameShelf={vi.fn()}
        onRenameShelf={vi.fn()}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Create New Bookshelf')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('e.g. Philosophy & Logic');
    fireEvent.change(input, { target: { value: 'Classics' } });
    expect(handleNameChange).toHaveBeenCalledWith('Classics');

    fireEvent.click(screen.getByRole('button', { name: 'Create Shelf' }));
    expect(handleCreate).toHaveBeenCalled();
  });

  it('renders rename and delete modals', () => {
    const handleRename = vi.fn((e) => e.preventDefault());
    const handleDelete = vi.fn();

    const { rerender } = render(
      <BookshelfManageModals
        isCreatingShelf={false}
        newShelfName=""
        onNewShelfNameChange={vi.fn()}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId="shelf-1"
        editingShelfName="Old Name"
        onEditingShelfNameChange={vi.fn()}
        onCloseRenameShelf={vi.fn()}
        onRenameShelf={handleRename}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={handleDelete}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Rename Bookshelf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(handleRename).toHaveBeenCalled();

    rerender(
      <BookshelfManageModals
        isCreatingShelf={false}
        newShelfName=""
        onNewShelfNameChange={vi.fn()}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId={null}
        editingShelfName=""
        onEditingShelfNameChange={vi.fn()}
        onCloseRenameShelf={vi.fn()}
        onRenameShelf={vi.fn()}
        deletingShelfId="shelf-1"
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={handleDelete}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Delete Bookshelf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Shelf' }));
    expect(handleDelete).toHaveBeenCalled();
  });

  it('renders clear offline shelf confirmation modal and handles cancel and confirm', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <BookshelfManageModals
        isCreatingShelf={false}
        newShelfName=""
        onNewShelfNameChange={vi.fn()}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId={null}
        editingShelfName=""
        onEditingShelfNameChange={vi.fn()}
        onCloseRenameShelf={vi.fn()}
        onRenameShelf={vi.fn()}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={vi.fn()}
        isClearingOfflineShelf={true}
        onCloseClearOfflineShelf={handleClose}
        onConfirmClearOfflineShelf={handleConfirm}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Clear Offline Shelf')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove all offline downloads for this shelf/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handleClose).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Offline Downloads' }));
    expect(handleConfirm).toHaveBeenCalled();
  });

  it('toggles shelf privacy in create and rename modals', () => {
    const handleNewPrivacyChange = vi.fn();
    const handleEditPrivacyChange = vi.fn();

    const { rerender } = render(
      <BookshelfManageModals
        isCreatingShelf={true}
        newShelfName="Secret Collection"
        newShelfIsPublic={true}
        onNewShelfNameChange={vi.fn()}
        onNewShelfIsPublicChange={handleNewPrivacyChange}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId={null}
        editingShelfName=""
        onEditingShelfNameChange={vi.fn()}
        onCloseRenameShelf={vi.fn()}
        onRenameShelf={vi.fn()}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Public Shelf')).toBeInTheDocument();
    const createCheckbox = screen.getByRole('checkbox');
    expect(createCheckbox).toBeChecked();

    fireEvent.click(createCheckbox);
    expect(handleNewPrivacyChange).toHaveBeenCalledWith(false);

    rerender(
      <BookshelfManageModals
        isCreatingShelf={false}
        newShelfName=""
        onNewShelfNameChange={vi.fn()}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId="shelf-2"
        editingShelfName="Private Memoirs"
        editingShelfIsPublic={false}
        onEditingShelfNameChange={vi.fn()}
        onEditingShelfIsPublicChange={handleEditPrivacyChange}
        onCloseRenameShelf={vi.fn()}
        onRenameShelf={vi.fn()}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Private Shelf')).toBeInTheDocument();
    const editCheckbox = screen.getByRole('checkbox');
    expect(editCheckbox).not.toBeChecked();

    fireEvent.click(editCheckbox);
    expect(handleEditPrivacyChange).toHaveBeenCalledWith(true);
  });
});

