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

  it('renders clean completed notice without Resumed prefix when chapterTitle includes Completed', () => {
    render(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={100}
        totalChapters={20}
        currentChapterIndex={0}
        resumeNotice={{
          chapterTitle: 'Completed Volume (100%)',
          page: 1,
        }}
      />
    );

    expect(screen.getByTestId('resume-notice')).toBeInTheDocument();
    expect(screen.getByText('Completed Volume (100%) • Page 1')).toBeInTheDocument();
  });

  it('renders symposium companion progress micro-pill when symposiumCompanion is provided', () => {
    render(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={50}
        totalChapters={20}
        currentChapterIndex={4}
        symposiumCompanion={{
          username: 'clara_v',
          displayName: 'Clara Vance',
          progress: 68,
          currentChapterIndex: 11,
        }}
      />
    );

    const pill = screen.getByTestId('symposium-companion-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('Clara Vance: Sec. 12 (68%)');
  });

  it('falls back to @username in companion pill when displayName is absent', () => {
    render(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={50}
        totalChapters={20}
        currentChapterIndex={4}
        symposiumCompanion={{
          username: 'anonymous_reader',
          displayName: '',
          progress: 25,
          currentChapterIndex: 2,
        }}
      />
    );

    const pill = screen.getByTestId('symposium-companion-pill');
    expect(pill).toHaveTextContent('@anonymous_reader: Sec. 3 (25%)');
  });

  it('renders symposium milestone dispatch banner when no resumeNotice is active and yields priority when resumeNotice is active', () => {
    const handleDismissMilestone = vi.fn();

    const { rerender } = render(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={50}
        totalChapters={20}
        currentChapterIndex={4}
        resumeNotice={{ chapterTitle: 'Chapter 5', page: 2 }}
        symposiumMilestoneNotice={{
          username: 'clara_v',
          displayName: 'Clara Vance',
          chapterIndex: 9,
          progress: 50,
        }}
        onDismissSymposiumMilestone={handleDismissMilestone}
      />
    );

    // Resume notice takes priority over milestone banner
    expect(screen.getByTestId('resume-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('symposium-milestone-banner')).not.toBeInTheDocument();

    // Once resumeNotice is cleared, milestone banner renders
    rerender(
      <ReaderSubHeaderRibbon
        bookId={1342}
        progress={50}
        totalChapters={20}
        currentChapterIndex={4}
        resumeNotice={null}
        symposiumMilestoneNotice={{
          username: 'clara_v',
          displayName: 'Clara Vance',
          chapterIndex: 9,
          progress: 50,
        }}
        onDismissSymposiumMilestone={handleDismissMilestone}
      />
    );

    const banner = screen.getByTestId('symposium-milestone-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Clara Vance reached Section 10 (50%) in this Symposium');

    fireEvent.click(screen.getByTestId('dismiss-symposium-milestone-btn'));
    expect(handleDismissMilestone).toHaveBeenCalledTimes(1);
  });
});


