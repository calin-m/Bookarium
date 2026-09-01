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
});

