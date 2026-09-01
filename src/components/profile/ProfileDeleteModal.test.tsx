import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileDeleteModal } from './ProfileDeleteModal';

describe('ProfileDeleteModal Component', () => {
  it('renders confirmation prompt and requests deletion link', () => {
    const handleRequest = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    const { rerender } = render(
      <ProfileDeleteModal
        isOpen={true}
        onClose={handleClose}
        userEmail="reader@example.com"
        isSendingDeletionEmail={false}
        deletionEmailSent={false}
        deleteError={null}
        onRequestDeletion={handleRequest}
      />
    );

    expect(screen.getByText('Security Verification Required')).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Send Deletion Link/i }));
    expect(handleRequest).toHaveBeenCalled();

    rerender(
      <ProfileDeleteModal
        isOpen={true}
        onClose={handleClose}
        userEmail="reader@example.com"
        isSendingDeletionEmail={false}
        deletionEmailSent={true}
        deleteError={null}
        onRequestDeletion={handleRequest}
      />
    );

    expect(screen.getByText('Verification Link Sent')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(handleClose).toHaveBeenCalled();
  });
});

