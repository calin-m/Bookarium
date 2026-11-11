import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AccountTypographySubPanel,
  type AccountTypographySubPanelProps,
} from './AccountTypographySubPanel';

function renderSubPanel(overrides: Partial<AccountTypographySubPanelProps> = {}) {
  const props: AccountTypographySubPanelProps = {
    theme: 'light',
    fontFamily: 'serif',
    onFontFamilyChange: vi.fn(),
    fontSize: 18,
    onFontSizeChange: vi.fn(),
    lineHeight: 1.75,
    onLineHeightChange: vi.fn(),
    brightness: 100,
    onBrightnessChange: vi.fn(),
    readingMode: 'paginated',
    onReadingModeChange: vi.fn(),
    columnWidth: 'wide',
    onColumnWidthChange: vi.fn(),
    spoilerShieldEnabled: true,
    onSpoilerShieldChange: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<AccountTypographySubPanel {...props} />),
    props,
  };
}

describe('AccountTypographySubPanel', () => {
  it('renders live editorial specimen preview with active theme, font, size, line height, and brightness', () => {
    const { rerender, props } = renderSubPanel({
      theme: 'sepia',
      fontFamily: 'mono',
      fontSize: 20,
      lineHeight: 2.1,
      brightness: 85,
    });

    expect(screen.getByTestId('preferences-typography-summary')).toHaveTextContent(
      'MONO • 20px • 2.10x • 85%'
    );
    const preview = screen.getByTestId('preferences-typography-preview');
    expect(preview).toHaveClass('font-mono');
    expect(preview).toHaveStyle({ fontSize: '20px', filter: 'brightness(0.85)' });

    rerender(<AccountTypographySubPanel {...props} theme="dark" fontFamily="sans" brightness={100} />);
    expect(screen.getByTestId('preferences-typography-preview')).toHaveClass('font-sans');
  });

  it('invokes typeface, font size, line spacing, brightness, reading mode, column width, and spoiler shield callbacks', () => {
    const { props } = renderSubPanel();

    // Typeface
    fireEvent.click(screen.getByRole('button', { name: 'Sans' }));
    expect(props.onFontFamilyChange).toHaveBeenCalledWith('sans');

    // Font Size stepper & preset
    fireEvent.click(screen.getByRole('button', { name: 'Decrease default font size' }));
    expect(props.onFontSizeChange).toHaveBeenCalledWith(16);
    fireEvent.click(screen.getByRole('button', { name: 'Increase default font size' }));
    expect(props.onFontSizeChange).toHaveBeenCalledWith(20);
    fireEvent.click(screen.getByRole('button', { name: '22px' }));
    expect(props.onFontSizeChange).toHaveBeenCalledWith(22);

    // Line Spacing stepper & preset
    fireEvent.click(screen.getByRole('button', { name: 'Decrease default line spacing' }));
    expect(props.onLineHeightChange).toHaveBeenCalledWith(1.65);
    fireEvent.click(screen.getByRole('button', { name: 'Increase default line spacing' }));
    expect(props.onLineHeightChange).toHaveBeenCalledWith(1.85);
    fireEvent.click(screen.getByRole('button', { name: '1.4x' }));
    expect(props.onLineHeightChange).toHaveBeenCalledWith(1.4);

    // Brightness slider & preset
    fireEvent.change(screen.getByLabelText('Default Page Brightness'), {
      target: { value: '70' },
    });
    expect(props.onBrightnessChange).toHaveBeenCalledWith(70);
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(props.onBrightnessChange).toHaveBeenCalledWith(50);

    // Reading Mode
    fireEvent.click(screen.getByRole('button', { name: 'Scroll' }));
    expect(props.onReadingModeChange).toHaveBeenCalledWith('scroll');
    fireEvent.click(screen.getByRole('button', { name: 'Paged' }));
    expect(props.onReadingModeChange).toHaveBeenCalledWith('paginated');

    // Column Width
    fireEvent.click(screen.getByRole('button', { name: 'narrow' }));
    expect(props.onColumnWidthChange).toHaveBeenCalledWith('narrow');

    // Spoiler Shield
    fireEvent.click(screen.getByRole('button', { name: /Show All Marginalia/i }));
    expect(props.onSpoilerShieldChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: /Shield Active/i }));
    expect(props.onSpoilerShieldChange).toHaveBeenCalledWith(true);
  });

  it('renders exit bookmark prompt options and invokes onExitBookmarkReminderChange', () => {
    const onExitBookmarkReminderChange = vi.fn();
    const { rerender } = renderSubPanel({
      exitBookmarkReminderEnabled: true,
      onExitBookmarkReminderChange,
    });

    expect(screen.getByText('Prompt on Exit Enabled')).toBeInTheDocument();
    const disabledBtn = screen.getByTestId('exit-bookmark-prompt-disabled-btn');
    fireEvent.click(disabledBtn);
    expect(onExitBookmarkReminderChange).toHaveBeenCalledWith(false);

    rerender(
      <AccountTypographySubPanel
        theme="light"
        fontFamily="serif"
        onFontFamilyChange={vi.fn()}
        fontSize={18}
        onFontSizeChange={vi.fn()}
        lineHeight={1.75}
        onLineHeightChange={vi.fn()}
        brightness={100}
        onBrightnessChange={vi.fn()}
        readingMode="paginated"
        onReadingModeChange={vi.fn()}
        columnWidth="wide"
        onColumnWidthChange={vi.fn()}
        spoilerShieldEnabled={true}
        onSpoilerShieldChange={vi.fn()}
        exitBookmarkReminderEnabled={false}
        onExitBookmarkReminderChange={onExitBookmarkReminderChange}
      />
    );
    expect(screen.getByText('Silent Immediate Exit')).toBeInTheDocument();
    const enabledBtn = screen.getByTestId('exit-bookmark-prompt-enabled-btn');
    fireEvent.click(enabledBtn);
    expect(onExitBookmarkReminderChange).toHaveBeenCalledWith(true);
  });
});

