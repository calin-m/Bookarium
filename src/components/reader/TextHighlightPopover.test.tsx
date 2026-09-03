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

  it('positions below anchor on touch devices to avoid native mobile context menu collision', () => {
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
        position={{ top: 250, left: 300 }}
      />
    );

    const popover = screen.getByTestId('text-highlight-popover');
    // On touch devices (showBelow = true), top should be position.top + 34 = 284px
    expect(popover.style.top).toBe('284px');

    window.matchMedia = originalMatchMedia;
  });
});

