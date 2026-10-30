import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountNarrationSubPanel } from './AccountNarrationSubPanel';

describe('AccountNarrationSubPanel', () => {
  const defaultProps = {
    isActive: true,
    speechRate: 1.0,
    onSpeechRateChange: vi.fn(),
    speechVoiceURI: null,
    onSpeechVoiceChange: vi.fn(),
    speechAutoPageAdvance: true,
    onSpeechAutoPageAdvanceChange: vi.fn(),
    speechHighlightEnabled: true,
    onSpeechHighlightEnabledChange: vi.fn(),
    onResetSpeechPreferences: vi.fn(),
  };

  it('renders speed presets, voice select, and assistance toggles when active', () => {
    const onSpeechRateChange = vi.fn();
    const onVoiceChange = vi.fn();
    const onAutoPageChange = vi.fn();
    const onHighlightChange = vi.fn();
    const onReset = vi.fn();

    render(
      <AccountNarrationSubPanel
        {...defaultProps}
        onSpeechRateChange={onSpeechRateChange}
        onSpeechVoiceChange={onVoiceChange}
        onSpeechAutoPageAdvanceChange={onAutoPageChange}
        onSpeechHighlightEnabledChange={onHighlightChange}
        onResetSpeechPreferences={onReset}
      />
    );

    expect(document.getElementById('preferences-subpanel-narration')).not.toHaveClass('hidden');
    expect(screen.getByText('Read-Aloud & Audio Narration')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1.5x' }));
    expect(onSpeechRateChange).toHaveBeenCalledWith(1.5);

    fireEvent.click(screen.getByRole('button', { name: /Auto-Page Advance/i }));
    expect(onAutoPageChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: /Sentence Highlighting/i }));
    expect(onHighlightChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(screen.getByTestId('reset-speech-preferences-dialog')).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cancel-reset-speech-btn'));
    expect(screen.queryByTestId('reset-speech-preferences-dialog')).not.toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    fireEvent.click(screen.getByTestId('confirm-reset-speech-btn'));
    expect(onReset).toHaveBeenCalledTimes(1);

    const select = screen.getByLabelText('Preferred narrator voice');
    fireEvent.change(select, { target: { value: '' } });
    expect(onVoiceChange).toHaveBeenCalledWith(null);
  });

  it('applies hidden class when isActive is false and omits Reset button if callback is undefined', () => {
    render(
      <AccountNarrationSubPanel
        {...defaultProps}
        isActive={false}
        speechAutoPageAdvance={false}
        speechHighlightEnabled={false}
        onResetSpeechPreferences={undefined}
      />
    );

    expect(document.getElementById('preferences-subpanel-narration')).toHaveClass('hidden');
    expect(screen.queryByRole('button', { name: /Reset/i })).not.toBeInTheDocument();
  });
});

