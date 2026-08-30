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
    expect(screen.getByText('Serif')).toBeInTheDocument();
    expect(screen.getByText('Sans')).toBeInTheDocument();
    expect(screen.getByText('Mono')).toBeInTheDocument();
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

  it('does not render when isOpen is false', () => {
    const { container } = render(<ReaderControls {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});

