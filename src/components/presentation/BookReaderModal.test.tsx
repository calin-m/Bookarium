import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BookReaderModal } from './BookReaderModal';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { mockBooks } from '@/mocks/handlers';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('BookReaderModal component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({
      currentBook: mockBooks[0],
      isOpen: true,
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      theme: 'light',
      readingProgress: {},
    });
  });

  it('should render reader modal with book content and controls', async () => {
    renderWithClient(<BookReaderModal />);

    expect(screen.getByTestId('reader-modal')).toBeInTheDocument();
    expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText(/truth universally acknowledged/i)).toBeInTheDocument();
    });
  });

  it('should adjust font sizes when clicking zoom buttons', () => {
    renderWithClient(<BookReaderModal />);

    const zoomIn = screen.getByLabelText('Increase font size');
    fireEvent.click(zoomIn);
    expect(useReaderStore.getState().fontSize).toBe(20);

    const zoomOut = screen.getByLabelText('Decrease font size');
    fireEvent.click(zoomOut);
    expect(useReaderStore.getState().fontSize).toBe(18);
  });

  it('should switch font families', () => {
    renderWithClient(<BookReaderModal />);

    const sansBtn = screen.getByText('sans');
    fireEvent.click(sansBtn);
    expect(useReaderStore.getState().fontFamily).toBe('sans');

    const monoBtn = screen.getByText('mono');
    fireEvent.click(monoBtn);
    expect(useReaderStore.getState().fontFamily).toBe('mono');
  });

  it('should toggle themes (light, sepia, dark)', () => {
    renderWithClient(<BookReaderModal />);

    const sepiaBtn = screen.getByLabelText('Sepia reader theme');
    fireEvent.click(sepiaBtn);
    expect(useReaderStore.getState().theme).toBe('sepia');

    const darkBtn = screen.getByLabelText('Dark reader theme');
    fireEvent.click(darkBtn);
    expect(useReaderStore.getState().theme).toBe('dark');
  });

  it('should toggle bookmark ribbon from the reader header', () => {
    renderWithClient(<BookReaderModal />);

    const bookmarkBtn = screen.getByLabelText('Add bookmark');
    fireEvent.click(bookmarkBtn);
    expect(useBookshelfStore.getState().isBookSaved(mockBooks[0].id)).toBe(true);

    const bookmarkedBtn = screen.getByLabelText('Bookmarked');
    fireEvent.click(bookmarkedBtn);
    expect(useBookshelfStore.getState().isBookSaved(mockBooks[0].id)).toBe(false);
  });

  it('should toggle reading margin width presets', () => {
    renderWithClient(<BookReaderModal />);

    const compactBtn = screen.getByLabelText('Compact margin');
    fireEvent.click(compactBtn);

    const comfortableBtn = screen.getByLabelText('Comfortable margin');
    fireEvent.click(comfortableBtn);
  });

  it('should close reader modal when clicking close button', () => {
    renderWithClient(<BookReaderModal />);

    const closeBtn = screen.getByLabelText('Close reader');
    fireEvent.click(closeBtn);
    expect(useReaderStore.getState().isOpen).toBe(false);
  });
});
