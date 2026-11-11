import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionClearConfirmModal } from './CollectionClearConfirmModal';

describe('CollectionClearConfirmModal', () => {
  it('displays clear confirmation copy and executes cancel and confirm callbacks', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CollectionClearConfirmModal
        isOpen={true}
        title="Clear Personal Bookshelf"
        heading="Are you sure you want to clear your bookshelf?"
        description="This will remove all 4 titles currently preserved across your shelves."
        confirmLabel="Yes, Clear Shelf"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId('clear-confirmation-dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to clear your bookshelf?')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Clear Shelf' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
