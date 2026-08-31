import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderControls } from './ReaderControls';

describe('ReaderControls', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    fontSize: 18,
    onFontSizeChange: vi.fn(),
    lineHeight: 1.75,
    onLineHeightChange: vi.fn(),
    fontFamily: 'serif' as const,
    onFontFamilyChange: vi.fn(),
    theme: 'light' as const,
    onThemeChange: vi.fn(),
    readingMode: 'paginated' as const,
    onReadingModeChange: vi.fn(),
    columnWidth: 'normal' as const,
    onColumnWidthChange: vi.fn(),
  };

  it('renders theme and font selection buttons', () => {
    render(<ReaderControls {...defaultProps} />);

    expect(screen.getByText('Typography & Reading Mode')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Sepia')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByLabelText('Font family serif')).toBeInTheDocument();
    expect(screen.getByLabelText('Font family sans')).toBeInTheDocument();
    expect(screen.getByLabelText('Font family mono')).toBeInTheDocument();
  });

  it('renders correctly under sepia and dark themes', () => {
    const { rerender } = render(<ReaderControls {...defaultProps} theme="sepia" />);
    expect(screen.getByRole('region', { name: 'Reading Controls' })).toHaveClass('bg-[#ede2cc]');

    rerender(<ReaderControls {...defaultProps} theme="dark" />);
    expect(screen.getByRole('region', { name: 'Reading Controls' })).toHaveClass('bg-[#161b26]');
  });

  it('triggers onThemeChange and onFontFamilyChange', () => {
    const onThemeChange = vi.fn();
    const onFontFamilyChange = vi.fn();

    render(
      <ReaderControls
        {...defaultProps}
        onThemeChange={onThemeChange}
        onFontFamilyChange={onFontFamilyChange}
      />
    );

    fireEvent.click(screen.getByText('Sepia'));
    expect(onThemeChange).toHaveBeenCalledWith('sepia');

    fireEvent.click(screen.getByText('Mono'));
    expect(onFontFamilyChange).toHaveBeenCalledWith('mono');
  });

  it('triggers onReadingModeChange and onColumnWidthChange', () => {
    const onReadingModeChange = vi.fn();
    const onColumnWidthChange = vi.fn();

    render(
      <ReaderControls
        {...defaultProps}
        onReadingModeChange={onReadingModeChange}
        onColumnWidthChange={onColumnWidthChange}
      />
    );

    fireEvent.click(screen.getByText('Scroll'));
    expect(onReadingModeChange).toHaveBeenCalledWith('scroll');

    fireEvent.click(screen.getByText('nar'));
    expect(onColumnWidthChange).toHaveBeenCalledWith('narrow');
  });

  it('handles font size and line height slider changes with proper aria attributes', () => {
    const onFontSizeChange = vi.fn();
    const onLineHeightChange = vi.fn();

    render(
      <ReaderControls
        {...defaultProps}
        onFontSizeChange={onFontSizeChange}
        onLineHeightChange={onLineHeightChange}
      />
    );

    const fontSlider = screen.getByLabelText('Font size in pixels');
    fireEvent.change(fontSlider, { target: { value: '22' } });
    expect(onFontSizeChange).toHaveBeenCalledWith(22);

    const lineSlider = screen.getByLabelText('Line height spacing');
    fireEvent.change(lineSlider, { target: { value: '2.0' } });
    expect(onLineHeightChange).toHaveBeenCalledWith(2.0);

    // Test quick preset buttons
    fireEvent.click(screen.getByText('24px'));
    expect(onFontSizeChange).toHaveBeenCalledWith(24);

    fireEvent.click(screen.getByText('1.4'));
    expect(onLineHeightChange).toHaveBeenCalledWith(1.4);
  });

  it('closes controls on Escape key press', () => {
    const onClose = vi.fn();
    render(<ReaderControls {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ReaderControls {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});
