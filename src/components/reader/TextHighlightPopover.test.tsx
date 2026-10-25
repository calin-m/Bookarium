import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TextHighlightPopover } from './TextHighlightPopover';

describe('TextHighlightPopover', () => {
  const defaultProps = {
    isOpen: true,
    selectedText: 'To be, or not to be, that is the question.',
    position: { top: 200, left: 300 },
    onSelectColor: vi.fn(),
    onSaveNote: vi.fn(),
    onDelete: vi.fn(),
    onCopyQuote: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders all 4 color choices and action buttons', () => {
    render(<TextHighlightPopover {...defaultProps} />);

    expect(screen.getByTestId('text-highlight-popover')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-color-yellow')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-color-amber')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-color-mint')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-color-rose')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-add-note-btn')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-copy-btn')).toBeInTheDocument();
  });

  it('calls onSelectColor when a color button is clicked', () => {
    const onSelectColor = vi.fn();
    render(<TextHighlightPopover {...defaultProps} onSelectColor={onSelectColor} />);

    fireEvent.click(screen.getByTestId('highlight-color-mint'));
    expect(onSelectColor).toHaveBeenCalledWith('mint');
  });

  it('expands note input and calls onSaveNote with entered text', () => {
    const onSaveNote = vi.fn();
    render(<TextHighlightPopover {...defaultProps} onSaveNote={onSaveNote} />);

    // Click note button to expand
    fireEvent.click(screen.getByTestId('highlight-add-note-btn'));

    const textarea = screen.getByTestId('highlight-note-textarea');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Shakespeare existential monologue.' } });
    fireEvent.click(screen.getByTestId('highlight-save-note-btn'));

    expect(onSaveNote).toHaveBeenCalledWith('Shakespeare existential monologue.');
  });

  it('calls onCopyQuote when copy button is clicked', () => {
    const onCopyQuote = vi.fn();
    render(<TextHighlightPopover {...defaultProps} onCopyQuote={onCopyQuote} />);

    fireEvent.click(screen.getByTestId('highlight-copy-btn'));
    expect(onCopyQuote).toHaveBeenCalled();
  });

  it('renders delete button and calls onDelete when existingAnnotationId is present', () => {
    const onDelete = vi.fn();
    render(
      <TextHighlightPopover
        {...defaultProps}
        existingAnnotationId="ann-123"
        onDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByTestId('highlight-delete-btn');
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalled();
  });

  it('calls onClose when escape key is pressed', () => {
    const onClose = vi.fn();
    render(<TextHighlightPopover {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking outside the popover', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <TextHighlightPopover {...defaultProps} onClose={onClose} />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onCopyQuote when provided, or copies selected text to clipboard', async () => {
    const onCopyQuote = vi.fn();
    render(<TextHighlightPopover {...defaultProps} onCopyQuote={onCopyQuote} />);
    const copyBtn = screen.getByTestId('highlight-copy-btn');
    fireEvent.click(copyBtn);
    expect(onCopyQuote).toHaveBeenCalled();

    // Test clipboard fallback when onCopyQuote is omitted
    const originalClipboard = navigator.clipboard;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <TextHighlightPopover
        {...defaultProps}
        onCopyQuote={undefined}
        selectedText="Quote to copy"
      />
    );
    const copyBtns = screen.getAllByTestId('highlight-copy-btn');
    fireEvent.click(copyBtns[copyBtns.length - 1]);

    expect(writeTextMock).toHaveBeenCalledWith('Quote to copy');
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('submits note on clicking Save Note button in note textarea', () => {
    const onSaveNote = vi.fn();
    render(
      <TextHighlightPopover
        {...defaultProps}
        existingNote="Existing note"
        onSaveNote={onSaveNote}
      />
    );

    const textarea = screen.getByTestId('highlight-note-textarea');
    fireEvent.change(textarea, { target: { value: 'Updated note' } });

    const saveBtn = screen.getByTestId('highlight-save-note-btn');
    fireEvent.click(saveBtn);

    expect(onSaveNote).toHaveBeenCalledWith('Updated note');
  });

  it('renders in sepia and dark themes without crashing', () => {
    const { rerender } = render(<TextHighlightPopover {...defaultProps} theme="sepia" />);
    expect(screen.getByTestId('text-highlight-popover')).toBeInTheDocument();

    rerender(<TextHighlightPopover {...defaultProps} theme="dark" />);
    expect(screen.getByTestId('text-highlight-popover')).toBeInTheDocument();
  });

  it('calls onClose when touchstart occurs outside the popover', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside-touch-area">Outside Mobile Tap</div>
        <TextHighlightPopover {...defaultProps} onClose={onClose} />
      </div>
    );

    fireEvent.touchStart(screen.getByTestId('outside-touch-area'));
    expect(onClose).toHaveBeenCalled();
  });

  it('positions docked at bottom on touch devices to avoid native mobile context menu collision', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <TextHighlightPopover
        {...defaultProps}
        position={{ top: 250, left: 300, bottom: 270 }}
      />
    );

    const popover = screen.getByTestId('text-highlight-popover');
    // On touch devices, popover docks at bottom: 5.25rem and horizontally centered at 50%
    expect(popover.style.bottom).toBe('5.25rem');
    expect(popover.style.left).toBe('50%');

    window.matchMedia = originalMatchMedia;
  });

  it('positions contextually near anchor on desktop devices', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <TextHighlightPopover
        {...defaultProps}
        position={{ top: 250, left: 300, bottom: 270 }}
      />
    );

    const popover = screen.getByTestId('text-highlight-popover');
    // On desktop, top is calculated using anchor
    expect(popover.style.top).toBe('196px');

    window.matchMedia = originalMatchMedia;
  });

  it('renders Read-Only Scholar Attribution view when isFellowOnly is true', () => {
    const fellowAnn = {
      id: 'fellow-ann-1',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'To be, or not to be',
      color: 'amber' as const,
      note: 'Profound soliloquy reflection by Plato',
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
      isFellow: true as const,
      fellowUsername: 'plato',
      fellowDisplayName: 'Plato of Athens',
    };

    render(
      <TextHighlightPopover
        {...defaultProps}
        fellowAnnotation={fellowAnn}
        isFellowOnly={true}
      />
    );

    expect(screen.getByTestId('popover-fellow-attribution')).toBeInTheDocument();
    expect(screen.getByText('Plato of Athens')).toBeInTheDocument();
    expect(screen.getByText('@plato')).toBeInTheDocument();
    expect(screen.getByText(/Profound soliloquy reflection by Plato/i)).toBeInTheDocument();
    expect(screen.queryByTestId('highlight-delete-btn')).not.toBeInTheDocument();

    // User can switch to 'My Note' tab or 1-click save highlight even when isFellowOnly is true
    expect(screen.getByTestId('popover-overlap-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('fellow-popover-add-own-note-btn')).toBeInTheDocument();
    expect(screen.getByTestId('fellow-popover-save-highlight-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('fellow-popover-add-own-note-btn'));
    expect(screen.getByTestId('highlight-color-yellow')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-note-textarea')).toBeInTheDocument();
  });

  it('allows 1-click saving of fellow highlight via fellow-popover-save-highlight-btn', () => {
    const onSelectColor = vi.fn();
    const onClose = vi.fn();
    const fellowAnn = {
      id: 'fellow-ann-save-test',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'To be, or not to be',
      color: 'amber' as const,
      note: 'Plato commentary',
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
      isFellow: true as const,
      fellowUsername: 'plato',
      fellowDisplayName: 'Plato',
    };

    render(
      <TextHighlightPopover
        {...defaultProps}
        fellowAnnotation={fellowAnn}
        isFellowOnly={true}
        onSelectColor={onSelectColor}
        onClose={onClose}
      />
    );

    const saveHighlightBtn = screen.getByTestId('fellow-popover-save-highlight-btn');
    expect(saveHighlightBtn).toHaveTextContent('Save Highlight');

    fireEvent.click(saveHighlightBtn);
    expect(onSelectColor).toHaveBeenCalledWith('amber');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders 2-pill overlap switcher when both self and fellow annotations exist', () => {
    const fellowAnn = {
      id: 'fellow-ann-1',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'To be, or not to be',
      color: 'amber' as const,
      note: 'Fellow scholar note on Hamlet',
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
      isFellow: true as const,
      fellowUsername: 'aristotle',
    };

    render(
      <TextHighlightPopover
        {...defaultProps}
        existingAnnotationId="self-ann-1"
        existingNote="My own Hamlet note"
        fellowAnnotation={fellowAnn}
        isFellowOnly={false}
      />
    );

    expect(screen.getByTestId('popover-overlap-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('overlap-tab-mine')).toBeInTheDocument();
    expect(screen.getByTestId('overlap-tab-fellow')).toHaveTextContent("@aristotle's Note");

    // Switch to fellow note tab
    fireEvent.click(screen.getByTestId('overlap-tab-fellow'));
    expect(screen.getByTestId('popover-fellow-attribution')).toBeInTheDocument();
    expect(screen.getByText(/Fellow scholar note on Hamlet/i)).toBeInTheDocument();

    // When existingAnnotationId is present, In My Notes badge and Edit My Note button are shown
    expect(screen.getByTestId('fellow-popover-saved-badge')).toHaveTextContent('In My Notes');
    const editBtn = screen.getByTestId('fellow-popover-add-own-note-btn');
    expect(editBtn).toHaveTextContent('Edit My Note');

    // Clicking Edit My Note switches to My Note tab and expands textarea
    fireEvent.click(editBtn);
    expect(screen.getByTestId('highlight-note-textarea')).toBeInTheDocument();
  });

  it('renders privacy-aware fallback text when fellow annotation has no note', () => {
    const fellowWithoutNote = {
      id: 'fellow-ann-no-note',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'To be, or not to be',
      color: 'amber' as const,
      note: undefined,
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
      isFellow: true as const,
      fellowUsername: 'plato',
      fellowDisplayName: 'Plato of Athens',
    };

    const { rerender } = render(
      <TextHighlightPopover
        {...defaultProps}
        fellowAnnotation={fellowWithoutNote}
        isFellowOnly={true}
      />
    );

    expect(screen.getByText('Highlighted by Plato of Athens in Symposium')).toBeInTheDocument();

    // Rerender with empty fellowDisplayName to verify fallback to @fellowUsername
    rerender(
      <TextHighlightPopover
        {...defaultProps}
        fellowAnnotation={{ ...fellowWithoutNote, fellowDisplayName: '' }}
        isFellowOnly={true}
      />
    );

    expect(screen.getByText('Highlighted by @plato in Symposium')).toBeInTheDocument();
  });
});

