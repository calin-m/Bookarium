import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmActionModal } from './ConfirmActionModal';

describe('ConfirmActionModal', () => {
  it('renders heading, description, optional preview children, and invokes onClose and onConfirm', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmActionModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item?"
        heading="Are you sure you want to delete this item?"
        description="This action cannot be undone."
        confirmLabel="Delete Forever"
        buttonSize="sm"
        modalTestId="sample-confirm-modal"
        dialogTestId="sample-confirm-dialog"
        confirmTestId="sample-confirm-btn"
        cancelTestId="sample-cancel-btn"
      >
        <div data-testid="preview-slot">Preview note text</div>
      </ConfirmActionModal>
    );

    expect(screen.getByTestId('sample-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByTestId('preview-slot')).toHaveTextContent('Preview note text');

    fireEvent.click(screen.getByTestId('sample-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('sample-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

