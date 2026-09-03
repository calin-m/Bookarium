import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReaderSubHeaderRibbon } from './ReaderSubHeaderRibbon';

describe('ReaderSubHeaderRibbon', () => {
  it('renders default archival metadata, section counter, and progress pill', () => {
    const handleOpenInfo = vi.fn();
    render(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={50}
        totalChapters={20}
        currentChapterIndex={4}
        theme="light"
        onOpenInfoModal={handleOpenInfo}
      />
    );

    expect(screen.getByText('#1342')).toBeInTheDocument();
    expect(screen.getByText('5/20')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    const infoBtn = screen.getByLabelText('View Gutenberg Archive Volume Info');
    fireEvent.click(infoBtn);
    expect(handleOpenInfo).toHaveBeenCalled();
  });

  it('renders resume notice when resumeNotice data is provided', () => {
    const handleRestart = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={50}
        totalChapters={20}
        currentChapterIndex={4}
        resumeNotice={{
          chapterTitle: 'Chapter 5',
          page: 12,
        }}
        onRestart={handleRestart}
        onDismissResume={handleDismiss}
      />
    );

    expect(screen.getByTestId('resume-notice')).toBeInTheDocument();
    expect(screen.getByText(/Resumed at Chapter 5, Page 12/i)).toBeInTheDocument();

    const restartBtn = screen.getByRole('button', { name: /Restart/i });
    fireEvent.click(restartBtn);
    expect(handleRestart).toHaveBeenCalled();

    const dismissBtn = screen.getByLabelText('Dismiss resume notice');
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalled();
  });
});

