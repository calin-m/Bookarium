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
    expect(
      screen.getByText(/voices automatically filter to match the book's language/i)
    ).toBeInTheDocument();

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

  it('previews the highest-quality natural voice when speechVoiceURI is null (Auto-Select)', () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    const mockVoices = [
      {
        name: 'Microsoft David Desktop',
        voiceURI: 'david-desktop',
        lang: 'en-US',
      },
      {
        name: 'Microsoft Jenny Natural (Online)',
        voiceURI: 'jenny-natural',
        lang: 'en-US',
      },
      {
        name: 'Standard Voice',
        voiceURI: 'standard-voice',
        lang: 'en-US',
      },
    ] as SpeechSynthesisVoice[];

    const originalSpeechSynthesis = window.speechSynthesis;
    const originalUtterance = (window as any).SpeechSynthesisUtterance;

    class MockUtterance {
      text: string;
      rate: number = 1;
      voice: SpeechSynthesisVoice | null = null;
      lang: string = '';
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    (window as any).SpeechSynthesisUtterance = MockUtterance;
    (window as any).speechSynthesis = {
      getVoices: vi.fn(() => mockVoices),
      speak: speakMock,
      cancel: cancelMock,
      onvoiceschanged: null,
    };

    const { unmount } = render(<AccountNarrationSubPanel {...defaultProps} speechVoiceURI={null} />);

    const testBtn = screen.getByRole('button', { name: /Test Voice/i });
    fireEvent.click(testBtn);

    expect(cancelMock).toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalled();

    const utterance = speakMock.mock.calls[0][0] as MockUtterance;
    expect(utterance.voice?.voiceURI).toBe('jenny-natural');
    expect(utterance.lang).toBe('en-US');

    unmount();

    // Restore
    if (originalSpeechSynthesis) {
      (window as any).speechSynthesis = originalSpeechSynthesis;
    } else {
      delete (window as any).speechSynthesis;
    }
    if (originalUtterance) {
      (window as any).SpeechSynthesisUtterance = originalUtterance;
    } else {
      delete (window as any).SpeechSynthesisUtterance;
    }
  });
});

