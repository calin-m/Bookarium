import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountDeleteModal } from './AccountDeleteModal';

describe('AccountDeleteModal', () => {
  it('renders confirmation modal and handles cancel and send deletion link', () => {
    const handleClose = vi.fn();
    const handleRequestDeletion = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <AccountDeleteModal
        isOpen={true}
        onClose={handleClose}
        userEmail="reader@bookarium.test"
        isSendingDeletionEmail={false}
        deletionEmailSent={false}
        deleteError={null}
        onRequestDeletion={handleRequestDeletion}
      />
    );

    expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
    expect(screen.getByText('Security Verification Required')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalled();

    const sendBtn = screen.getByRole('button', { name: /Send Deletion Link/i });
    fireEvent.click(sendBtn);
    expect(handleRequestDeletion).toHaveBeenCalled();

    // Rerender with email sent state
    rerender(
      <AccountDeleteModal
        isOpen={true}
        onClose={handleClose}
        userEmail="reader@bookarium.test"
        isSendingDeletionEmail={false}
        deletionEmailSent={true}
        deleteError={null}
        onRequestDeletion={handleRequestDeletion}
      />
    );

    expect(screen.getByText('Verification Link Sent')).toBeInTheDocument();
    expect(screen.getByText(/We sent a secure deletion confirmation link to/i)).toBeInTheDocument();
  });
});

