import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeCompletionModal } from './VolumeCompletionModal';

describe('VolumeCompletionModal', () => {
  it('renders completion celebratory state, star rating controls, and navigation actions', () => {
    const onClose = vi.fn();
    const onRateChange = vi.fn();
    const onOpenBookshelf = vi.fn();

    render(
      <VolumeCompletionModal
        isOpen={true}
        onClose={onClose}
        bookTitle="Pride and Prejudice"
        bookRating={4}
        onRateChange={onRateChange}
        onOpenBookshelf={onOpenBookshelf}
      />
    );

    expect(screen.getByTestId('volume-completion-modal')).toBeInTheDocument();
    expect(screen.getByText(/Pride and Prejudice/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('radio', { name: 'Rate 5 of 5 stars' })
    );
    expect(onRateChange).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole('button', { name: 'My Bookshelf' }));
    expect(onOpenBookshelf).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
