import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReaderExitBookmarkModal } from './ReaderExitBookmarkModal';

describe('ReaderExitBookmarkModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirmExitWithoutSaving: vi.fn(),
    onConfirmBookmarkAndExit: vi.fn(),
    bookTitle: 'Pride and Prejudice',
    currentPage: 2,
    isUnderThreshold: true,
    theme: 'light' as const,
    initialReminderEnabled: true,
    onToggleReminder: vi.fn(),
  };

  it('renders exploratory exit prompt for under-threshold pages with left-side ribbon discovery hint', () => {
    render(<ReaderExitBookmarkModal {...defaultProps} />);

    expect(screen.getByTestId('reader-exit-bookmark-modal')).toBeInTheDocument();
    expect(screen.getByText('Ribbon')).toBeInTheDocument();
    expect(screen.getByText(/margin ribbon/i)).toBeInTheDocument();
    expect(screen.getByText(/Page 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Pride and Prejudice/i)).toBeInTheDocument();
    const leaveBtn = screen.getByTestId('exit-without-bookmarking-btn');
    expect(leaveBtn).toHaveTextContent('Leave');
    expect(leaveBtn).toHaveAttribute(
      'data-tooltip',
      'Exit without saving progress to your Bookmarks ledger'
    );
    const bookmarkBtn = screen.getByTestId('confirm-bookmark-and-exit-btn');
    expect(bookmarkBtn).toHaveTextContent('Bookmark');
    expect(bookmarkBtn).toHaveAttribute(
      'data-tooltip',
      'Save this volume to your shelf with a line 1 bookmark'
    );
    const keepReadingBtn = screen.getByTestId('keep-reading-btn');
    expect(keepReadingBtn).toHaveTextContent('Keep Reading');
    expect(keepReadingBtn).toHaveAttribute(
      'data-tooltip',
      'Stay in the reader to adjust your bookmark line or keep reading'
    );
  });

  it('renders in-depth session prompt when isUnderThreshold is false', () => {
    render(
      <ReaderExitBookmarkModal
        {...defaultProps}
        currentPage={12}
        isUnderThreshold={false}
      />
    );

    expect(screen.getByText(/Page 12/i)).toBeInTheDocument();
    const leaveBtn = screen.getByTestId('exit-without-bookmarking-btn');
    expect(leaveBtn).toHaveTextContent('Leave');
    expect(leaveBtn).toHaveAttribute(
      'data-tooltip',
      'Exit while preserving your existing bookmark as a failsafe'
    );
    const bookmarkBtn = screen.getByTestId('confirm-bookmark-and-exit-btn');
    expect(bookmarkBtn).toHaveTextContent('Bookmark');
    expect(bookmarkBtn).toHaveAttribute(
      'data-tooltip',
      'Place a bookmark at the top of this page and exit'
    );
  });

  it('fires callbacks on button clicks', () => {
    const onClose = vi.fn();
    const onConfirmExitWithoutSaving = vi.fn();
    const onConfirmBookmarkAndExit = vi.fn();

    render(
      <ReaderExitBookmarkModal
        {...defaultProps}
        onClose={onClose}
        onConfirmExitWithoutSaving={onConfirmExitWithoutSaving}
        onConfirmBookmarkAndExit={onConfirmBookmarkAndExit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /keep reading/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('exit-without-bookmarking-btn'));
    expect(onConfirmExitWithoutSaving).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('confirm-bookmark-and-exit-btn'));
    expect(onConfirmBookmarkAndExit).toHaveBeenCalledTimes(1);
  });

  it('handles "Don\'t ask me again" checkbox toggle', () => {
    const onToggleReminder = vi.fn();
    render(
      <ReaderExitBookmarkModal
        {...defaultProps}
        initialReminderEnabled={true}
        onToggleReminder={onToggleReminder}
      />
    );

    const checkbox = screen.getByTestId('dont-remind-again-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(onToggleReminder).toHaveBeenCalledWith(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(onToggleReminder).toHaveBeenCalledWith(true);
  });

  it('does not render dialog content when isOpen is false', () => {
    render(<ReaderExitBookmarkModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('reader-exit-bookmark-modal')).not.toBeInTheDocument();
  });
});
