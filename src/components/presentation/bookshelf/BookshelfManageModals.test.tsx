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
    const createBackdrop = screen.getByTestId('modal-backdrop');
    expect(createBackdrop).toHaveClass('bg-transparent');
    expect(createBackdrop).toHaveClass('backdrop-blur-none');

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
    const renameBackdrop = screen.getByTestId('modal-backdrop');
    expect(renameBackdrop).toHaveClass('bg-transparent');
    expect(renameBackdrop).toHaveClass('backdrop-blur-none');

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
    const deleteBackdrop = screen.getByTestId('modal-backdrop');
    expect(deleteBackdrop).toHaveClass('bg-transparent');
    expect(deleteBackdrop).toHaveClass('backdrop-blur-none');

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
    const clearBackdrop = screen.getByTestId('modal-backdrop');
    expect(clearBackdrop).toHaveClass('bg-transparent');
    expect(clearBackdrop).toHaveClass('backdrop-blur-none');
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

  it('supports clear button and smart 2-step Escape key hierarchy on shelf name inputs', () => {
    const handleNameChange = vi.fn();
    const handleCloseCreate = vi.fn();

    const { rerender } = render(
      <BookshelfManageModals
        isCreatingShelf={true}
        newShelfName="Philosophy"
        onNewShelfNameChange={handleNameChange}
        onCloseCreateShelf={handleCloseCreate}
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

    // 1. Clear button click
    const clearBtn = screen.getByLabelText('Clear input');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(handleNameChange).toHaveBeenCalledWith('');

    // 2. Escape key when input has text -> resets text, does NOT close modal
    const input = screen.getByPlaceholderText('e.g. Philosophy & Logic');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handleNameChange).toHaveBeenCalledWith('');
    expect(handleCloseCreate).not.toHaveBeenCalled();

    // 3. Escape key when input is empty -> bubbles to modal and triggers onClose
    rerender(
      <BookshelfManageModals
        isCreatingShelf={true}
        newShelfName=""
        onNewShelfNameChange={handleNameChange}
        onCloseCreateShelf={handleCloseCreate}
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

    const emptyInput = screen.getByPlaceholderText('e.g. Philosophy & Logic');
    fireEvent.keyDown(emptyInput, { key: 'Escape' });
    expect(handleCloseCreate).toHaveBeenCalled();
  });

  it('supports clear button and 2-step Escape key hierarchy on rename shelf input', () => {
    const handleRenameChange = vi.fn();
    const handleCloseRename = vi.fn();

    const { rerender } = render(
      <BookshelfManageModals
        isCreatingShelf={false}
        newShelfName=""
        onNewShelfNameChange={vi.fn()}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId="shelf-1"
        editingShelfName="Old Name"
        onEditingShelfNameChange={handleRenameChange}
        onCloseRenameShelf={handleCloseRename}
        onRenameShelf={vi.fn()}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={vi.fn()}
        isSubmitting={false}
      />
    );

    // Clear button
    const clearBtn = screen.getByLabelText('Clear input');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(handleRenameChange).toHaveBeenCalledWith('');

    // Escape with text
    const renameInput = screen.getByPlaceholderText('Shelf Name');
    fireEvent.keyDown(renameInput, { key: 'Escape' });
    expect(handleRenameChange).toHaveBeenCalledWith('');
    expect(handleCloseRename).not.toHaveBeenCalled();

    // Escape when empty
    rerender(
      <BookshelfManageModals
        isCreatingShelf={false}
        newShelfName=""
        onNewShelfNameChange={vi.fn()}
        onCloseCreateShelf={vi.fn()}
        onCreateShelf={vi.fn()}
        editingShelfId="shelf-1"
        editingShelfName=""
        onEditingShelfNameChange={handleRenameChange}
        onCloseRenameShelf={handleCloseRename}
        onRenameShelf={vi.fn()}
        deletingShelfId={null}
        onCloseDeleteShelf={vi.fn()}
        onDeleteShelf={vi.fn()}
        isSubmitting={false}
      />
    );

    const emptyRenameInput = screen.getByPlaceholderText('Shelf Name');
    fireEvent.keyDown(emptyRenameInput, { key: 'Escape' });
    expect(handleCloseRename).toHaveBeenCalled();
  });
});

