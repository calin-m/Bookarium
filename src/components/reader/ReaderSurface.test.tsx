import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderSurface } from './ReaderSurface';

describe('ReaderSurface', () => {
  const sampleChapter = {
    id: 1,
    title: 'Chapter 1: Loomings',
    displayTitle: 'Chapter 1: Loomings',
    content: 'Call me Ishmael. Some years ago...',
    startPageNumber: 1,
    pageCount: 3,
  };

  const defaultProps = {
    theme: 'light' as const,
    fontFamily: 'serif' as const,
    fontSize: 18,
    lineHeight: 1.75,
    columnWidth: 'normal' as const,
    readingMode: 'paginated' as const,
    chapter: sampleChapter,
    currentPageText: 'Call me Ishmael. Some years ago...',
    activeChapterIndex: 0,
    totalChapters: 5,
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
  };

  it('renders archival frontispiece banner on opening section and standard chapter banner on subsequent sections', () => {
    const { rerender } = render(
      <ReaderSurface
        {...defaultProps}
        activeChapterIndex={0}
        bookTitle="Moby Dick"
        bookAuthor="Herman Melville"
      />
    );

    expect(screen.getByText('Moby Dick')).toBeInTheDocument();
    expect(screen.getByText('by Herman Melville')).toBeInTheDocument();
    expect(screen.getByText(/Project Gutenberg Public Domain Edition/i)).toBeInTheDocument();

    // Rerender as Section 2 (Chapter 2)
    rerender(
      <ReaderSurface
        {...defaultProps}
        activeChapterIndex={1}
        chapter={{
          id: 2,
          title: 'Chapter 2: The Carpet-Bag',
          displayTitle: 'Chapter 2: The Carpet-Bag',
          content: 'I stuffed a shirt or two into my old carpet-bag...',
          startPageNumber: 4,
          pageCount: 2,
        }}
      />
    );

    expect(screen.getByText('Chapter 2: The Carpet-Bag')).toBeInTheDocument();
    expect(screen.getByText('Section 2 of 5')).toBeInTheDocument();
  });

  it('applies dynamic fontSize and lineHeight directly to the content body', () => {
    const { rerender } = render(<ReaderSurface {...defaultProps} fontSize={22} lineHeight={2.2} />);

    const contentBody = screen.getByTestId('reader-content-body');
    expect(contentBody).toHaveStyle({
      fontSize: '22px',
      lineHeight: '2.2',
    });

    rerender(<ReaderSurface {...defaultProps} fontSize={14} lineHeight={1.4} />);
    expect(contentBody).toHaveStyle({
      fontSize: '14px',
      lineHeight: '1.4',
    });
  });

  it('renders loading spinner and status message when isLoading is true', () => {
    render(<ReaderSurface {...defaultProps} isLoading={true} />);

    expect(
      screen.getByText(/Fetching Masterwork from Project Gutenberg Mirror/i)
    ).toBeInTheDocument();
  });

  it('renders error alert with retry button when isError is true', () => {
    const onRetry = vi.fn();
    render(<ReaderSurface {...defaultProps} isError={true} onRetry={onRetry} />);

    expect(screen.getByText(/Unable to Load Masterwork Text/i)).toBeInTheDocument();

    const retryBtn = screen.getByText('Retry Connection');
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('applies correct surface theme classes for Sepia and Dark themes', () => {
    const { rerender } = render(<ReaderSurface {...defaultProps} theme="sepia" />);
    expect(screen.getByRole('main')).toHaveClass('reader-surface-sepia');

    rerender(<ReaderSurface {...defaultProps} theme="dark" />);
    expect(screen.getByRole('main')).toHaveClass('reader-surface-dark');
  });

  it('triggers next and previous page handlers on mobile horizontal swipe gestures', () => {
    const onNextPage = vi.fn();
    const onPreviousPage = vi.fn();

    render(
      <ReaderSurface
        {...defaultProps}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
      />
    );

    const mainSurface = screen.getByRole('main');

    // Simulate Swipe Left (Next Page: deltaX = 100 - 200 = -100px)
    fireEvent.touchStart(mainSurface, {
      touches: [{ clientX: 200, clientY: 300 }],
    });
    fireEvent.touchEnd(mainSurface, {
      changedTouches: [{ clientX: 100, clientY: 305 }],
    });
    expect(onNextPage).toHaveBeenCalledTimes(1);

    // Simulate Swipe Right (Previous Page: deltaX = 250 - 100 = +150px)
    fireEvent.touchStart(mainSurface, {
      touches: [{ clientX: 100, clientY: 300 }],
    });
    fireEvent.touchEnd(mainSurface, {
      changedTouches: [{ clientX: 250, clientY: 305 }],
    });
    expect(onPreviousPage).toHaveBeenCalledTimes(1);
  });

  it('renders correctly in scroll reading mode and handles empty content fallback', () => {
    const { rerender } = render(
      <ReaderSurface
        {...defaultProps}
        readingMode="scroll"
        currentPageText=""
        chapter={{
          id: 1,
          title: 'Full Chapter',
          displayTitle: 'Full Chapter',
          content: 'Unabridged chapter content displayed in scroll mode.',
          startPageNumber: 1,
          pageCount: 1,
        }}
      />
    );

    expect(screen.getByText('Unabridged chapter content displayed in scroll mode.')).toBeInTheDocument();

    // Rerender with empty chapter content
    rerender(
      <ReaderSurface
        {...defaultProps}
        readingMode="scroll"
        currentPageText=""
        chapter={{
          id: 1,
          title: 'Empty',
          displayTitle: 'Empty',
          content: '',
          startPageNumber: 1,
          pageCount: 1,
        }}
      />
    );

    expect(screen.getByText(/Empty section or end of text volume/i)).toBeInTheDocument();
  });

  it('ignores vertical touch swipes or touches in scroll mode', () => {
    const onNextPage = vi.fn();
    const { rerender } = render(
      <ReaderSurface
        {...defaultProps}
        readingMode="scroll"
        onNextPage={onNextPage}
      />
    );

    const mainSurface = screen.getByRole('main');

    // In scroll mode, touch events do not trigger page turning
    fireEvent.touchStart(mainSurface, {
      touches: [{ clientX: 200, clientY: 300 }],
    });
    fireEvent.touchEnd(mainSurface, {
      changedTouches: [{ clientX: 100, clientY: 300 }],
    });
    expect(onNextPage).not.toHaveBeenCalled();

    // In paginated mode with vertical dominant gesture (deltaY > deltaX)
    rerender(
      <ReaderSurface
        {...defaultProps}
        readingMode="paginated"
        onNextPage={onNextPage}
      />
    );

    fireEvent.touchStart(mainSurface, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(mainSurface, {
      changedTouches: [{ clientX: 210, clientY: 300 }],
    });
    expect(onNextPage).not.toHaveBeenCalled();
  });

  it('renders narrow, wide, mono, and sans typography and layout modes', () => {
    const { rerender } = render(
      <ReaderSurface
        {...defaultProps}
        columnWidth="narrow"
        fontFamily="mono"
      />
    );
    expect(screen.getByRole('article')).toHaveClass('max-w-xl font-mono');

    rerender(
      <ReaderSurface
        {...defaultProps}
        columnWidth="wide"
        fontFamily="sans"
      />
    );
    expect(screen.getByRole('article')).toHaveClass('max-w-5xl font-sans');
  });

  it('scales up font size and displays HUD pill on pinch-out gesture', () => {
    const onFontSizeChange = vi.fn();
    render(
      <ReaderSurface
        {...defaultProps}
        fontSize={18}
        onFontSizeChange={onFontSizeChange}
      />
    );

    const mainSurface = screen.getByRole('main');

    // Start two-finger pinch with initial distance of 100px
    fireEvent.touchStart(mainSurface, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });

    // Font size HUD appears
    expect(screen.getByTestId('font-zoom-hud')).toBeInTheDocument();
    expect(screen.getByText(/Font Size: 18px/i)).toBeInTheDocument();

    // Spread fingers to distance of 150px (scale = 1.5 -> target size = 27px)
    fireEvent.touchMove(mainSurface, {
      touches: [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ],
    });

    expect(onFontSizeChange).toHaveBeenCalledWith(27);
    expect(screen.getByText(/Font Size: 27px/i)).toBeInTheDocument();

    // Release pinch touch
    fireEvent.touchEnd(mainSurface, {
      changedTouches: [{ clientX: 0, clientY: 100 }],
    });
  });

  it('clamps font size to minimum (12px) on extreme pinch-in gesture', () => {
    const onFontSizeChange = vi.fn();
    render(
      <ReaderSurface
        {...defaultProps}
        fontSize={18}
        onFontSizeChange={onFontSizeChange}
      />
    );

    const mainSurface = screen.getByRole('main');

    // Start pinch with 100px distance
    fireEvent.touchStart(mainSurface, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });

    // Pinch in close (20px distance -> scale = 0.2 -> clamped to 12px min)
    fireEvent.touchMove(mainSurface, {
      touches: [
        { clientX: 140, clientY: 100 },
        { clientX: 160, clientY: 100 },
      ],
    });

    expect(onFontSizeChange).toHaveBeenCalledWith(12);
    expect(screen.getByText(/\(Min\)/i)).toBeInTheDocument();
  });

  it('clamps font size to maximum (36px) on extreme pinch-out gesture', () => {
    const onFontSizeChange = vi.fn();
    render(
      <ReaderSurface
        {...defaultProps}
        fontSize={18}
        onFontSizeChange={onFontSizeChange}
      />
    );

    const mainSurface = screen.getByRole('main');

    // Start pinch with 100px distance
    fireEvent.touchStart(mainSurface, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });

    // Pinch out wide (400px distance -> scale = 4.0 -> clamped to 36px max)
    fireEvent.touchMove(mainSurface, {
      touches: [
        { clientX: 0, clientY: 100 },
        { clientX: 400, clientY: 100 },
      ],
    });

    expect(onFontSizeChange).toHaveBeenCalledWith(36);
    expect(screen.getByText(/\(Max\)/i)).toBeInTheDocument();
  });

  it('renders highlighted sentence with mark tag when highlightedSentence matches text', () => {
    render(
      <ReaderSurface
        {...defaultProps}
        currentPageText="First sentence of chapter. Second sentence being read aloud. Third sentence."
        highlightedSentence="Second sentence being read aloud."
        theme="sepia"
      />
    );

    const markEl = screen.getByTestId('speech-highlight');
    expect(markEl).toBeInTheDocument();
    expect(markEl).toHaveTextContent('Second sentence being read aloud.');
  });

  it('renders translating indicator when isTranslating is true', () => {
    render(<ReaderSurface {...defaultProps} isTranslating={true} />);
    expect(screen.getByTestId('translating-indicator')).toBeInTheDocument();
    expect(screen.getByText('Translating page content...')).toBeInTheDocument();
  });

  it('renders translatedText in place of base content when provided in translated mode', () => {
    render(
      <ReaderSurface
        {...defaultProps}
        translatedText="Texto traducido al español."
        displayMode="translated"
      />
    );

    expect(screen.getByText('Texto traducido al español.')).toBeInTheDocument();
  });

  it('renders bilingual mode with paired translation segments and speech highlight', () => {
    const mockSegments = [
      { original: 'Call me Ishmael.', translated: 'Llamadme Ismael.' },
      { original: 'Some years ago...', translated: 'Hace algunos años...' },
    ];

    render(
      <ReaderSurface
        {...defaultProps}
        displayMode="bilingual"
        translationSegments={mockSegments}
        highlightedSentence="Llamadme Ismael."
      />
    );

    const bilingualBody = screen.getByTestId('reader-bilingual-body');
    expect(bilingualBody).toBeInTheDocument();
    expect(screen.getByText('Call me Ishmael.')).toBeInTheDocument();
    expect(screen.getByText('Hace algunos años...')).toBeInTheDocument();

    const markEl = screen.getByTestId('speech-highlight');
    expect(markEl).toHaveTextContent('Llamadme Ismael.');
  });

  it('renders user annotations with designated highlight color marks and triggers onSelectAnnotation', () => {
    const onSelectAnnotation = vi.fn();
    const mockAnnotations = [
      {
        id: 'ann-1',
        bookId: 1,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Alice was beginning to get very tired',
        color: 'yellow' as const,
        note: 'Classic opening',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(
      <ReaderSurface
        {...defaultProps}
        currentPageText="Alice was beginning to get very tired of sitting by her sister on the bank."
        annotations={mockAnnotations}
        onSelectAnnotation={onSelectAnnotation}
      />
    );

    const highlightMark = screen.getByTestId('user-annotation-highlight');
    expect(highlightMark).toBeInTheDocument();
    expect(highlightMark).toHaveTextContent('Alice was beginning to get very tired');
    expect(highlightMark).toHaveAttribute('data-annotation-color', 'yellow');

    fireEvent.click(highlightMark);
    expect(onSelectAnnotation).toHaveBeenCalledWith(
      mockAnnotations[0],
      expect.objectContaining({
        top: expect.any(Number),
        left: expect.any(Number),
      })
    );
  });

  it('renders multiple annotations with amber, mint, and rose colors alongside speech highlight', () => {
    const mockAnnotations = [
      {
        id: 'ann-1',
        bookId: 1,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'First segment',
        color: 'amber' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ann-2',
        bookId: 1,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Second segment',
        color: 'mint' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ann-3',
        bookId: 1,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Third segment',
        color: 'rose' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(
      <ReaderSurface
        {...defaultProps}
        currentPageText="Intro: First segment, then Middle with Second segment, and finally Third segment ending."
        annotations={mockAnnotations}
        highlightedSentence="Middle"
      />
    );

    const highlights = screen.getAllByTestId('user-annotation-highlight');
    expect(highlights).toHaveLength(3);
    expect(highlights[0]).toHaveAttribute('data-annotation-color', 'amber');
    expect(highlights[1]).toHaveAttribute('data-annotation-color', 'mint');
    expect(highlights[2]).toHaveAttribute('data-annotation-color', 'rose');

    const speechMark = screen.getByTestId('speech-highlight');
    expect(speechMark).toHaveTextContent('Middle');
  });

  it('detects window text selection and triggers onTextSelected on mouseUp', () => {
    const onTextSelected = vi.fn();
    const mockRange = {
      getBoundingClientRect: () => ({
        top: 150,
        left: 200,
        width: 100,
        height: 20,
      }),
    };

    const originalGetSelection = window.getSelection;
    window.getSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      toString: () => 'selected quote from book',
      getRangeAt: () => mockRange,
    });

    render(
      <ReaderSurface
        {...defaultProps}
        currentPageText="A fascinating selected quote from book here."
        onTextSelected={onTextSelected}
      />
    );

    const article = screen.getByRole('article');
    fireEvent.mouseUp(article);

    expect(onTextSelected).toHaveBeenCalledWith({
      text: 'selected quote from book',
      position: {
        top: 150,
        left: 250, // left + width / 2
      },
    });

    window.getSelection = originalGetSelection;
  });
});
