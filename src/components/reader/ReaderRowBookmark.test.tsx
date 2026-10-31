import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReaderRowBookmark } from './ReaderRowBookmark';

describe('ReaderRowBookmark', () => {
  it('renders single-row and multi-row line bookmark badges and handles rail click, drag, double-click, and keyboard navigation', () => {
    const onStartDrag = vi.fn();
    const onEmitRowChange = vi.fn();

    const { rerender } = render(
      <ReaderRowBookmark
        effectiveStartRow={3}
        effectiveEndRow={3}
        bookmarkSpanRows={1}
        estimatedMaxBookmarkRows={20}
        lineStepPx={28}
        isBookmarkActive={true}
        isDraggingBookmark={false}
        getMaxBookmarkRows={() => 15}
        computeRowFromClientY={() => 5}
        onStartDrag={onStartDrag}
        onEmitRowChange={onEmitRowChange}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Reading line bookmark' });
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    expect(slider).toHaveAttribute('aria-valuetext', 'Line 4');
    expect(screen.getByTestId('reader-bookmark-line-badge')).toHaveTextContent('L4');

    fireEvent.click(screen.getByTestId('reader-bookmark-rail'), { clientY: 140 });
    expect(onEmitRowChange).toHaveBeenCalledWith(5);

    fireEvent.pointerDown(slider);
    expect(onStartDrag).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(slider);
    expect(onStartDrag).toHaveBeenCalledTimes(2);

    fireEvent.touchStart(slider);
    expect(onStartDrag).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onEmitRowChange).toHaveBeenCalledWith(4);

    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onEmitRowChange).toHaveBeenCalledWith(2);

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onEmitRowChange).toHaveBeenCalledWith(0);

    fireEvent.doubleClick(slider);
    expect(onEmitRowChange).toHaveBeenLastCalledWith(0);

    rerender(
      <ReaderRowBookmark
        effectiveStartRow={2}
        effectiveEndRow={4}
        bookmarkSpanRows={3}
        estimatedMaxBookmarkRows={20}
        lineStepPx={28}
        isBookmarkActive={false}
        isDraggingBookmark={true}
        getMaxBookmarkRows={() => 15}
        computeRowFromClientY={() => 5}
        onStartDrag={onStartDrag}
        onEmitRowChange={onEmitRowChange}
      />
    );

    expect(slider).toHaveAttribute('aria-valuetext', 'Lines 3 to 5');
    expect(screen.getByTestId('reader-bookmark-line-badge')).toHaveTextContent('L3–5');
  });
});

