import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RemoveCollectionBookModal } from './RemoveCollectionBookModal';

describe('RemoveCollectionBookModal', () => {
  it('renders Remove from Favorites modal with book title and triggers onConfirm / onClose', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();
    const handleParentClick = vi.fn();

    render(
      <div onClick={handleParentClick}>
        <RemoveCollectionBookModal
          isOpen={true}
          collectionType="favorite"
          bookTitle="Pride and Prejudice"
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      </div>
    );

    expect(screen.getByTestId('remove-favorite-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Remove “Pride and Prejudice” from favorites\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove Favorite/i }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleParentClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleParentClick).not.toHaveBeenCalled();
  });

  it('renders Remove from Bookshelf modal with generic fallback when bookTitle is omitted', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <RemoveCollectionBookModal
        isOpen={true}
        collectionType="bookshelf"
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByTestId('remove-bookshelf-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Remove this volume from your bookshelf\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove from Shelf/i }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false or collectionType is null', () => {
    const { rerender } = render(
      <RemoveCollectionBookModal
        isOpen={false}
        collectionType="favorite"
        bookTitle="Dracula"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <RemoveCollectionBookModal
        isOpen={true}
        collectionType={null}
        bookTitle="Dracula"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
