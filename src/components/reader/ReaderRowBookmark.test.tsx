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
    expect(screen.queryByTestId('reader-bookmark-line-badge')).toBeNull();
    const tabEl = screen.getByTestId('reader-bookmark-tab');
    expect(tabEl).toHaveClass('mr-0.5', 'sm:mr-2', 'opacity-35', 'backdrop-blur-xs');

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
    expect(screen.queryByTestId('reader-bookmark-line-badge')).toBeNull();
    const draggingTabEl = screen.getByTestId('reader-bookmark-tab');
    expect(draggingTabEl).toHaveClass('opacity-100', 'scale-110');

    rerender(
      <ReaderRowBookmark
        effectiveStartRow={0}
        effectiveEndRow={0}
        bookmarkSpanRows={1}
        estimatedMaxBookmarkRows={20}
        lineStepPx={28}
        isBookmarkActive={false}
        isDraggingBookmark={false}
        getMaxBookmarkRows={() => 15}
        computeRowFromClientY={() => 5}
        onStartDrag={onStartDrag}
        onEmitRowChange={onEmitRowChange}
      />
    );
    expect(screen.getByTestId('reader-bookmark-tab')).toHaveClass('opacity-25', 'sm:opacity-0');
  });
});

