import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountPreferencesSection } from './AccountPreferencesSection';

describe('AccountPreferencesSection', () => {
  const defaultProps = {
    theme: 'light' as const,
    onThemeChange: vi.fn(),
    stickyScrollEnabled: true,
    onStickyScrollChange: vi.fn(),
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

  it('handles theme switching and sticky scroll toggle', () => {
    const handleThemeChange = vi.fn();
    const handleStickyScrollChange = vi.fn();

    render(
      <AccountPreferencesSection
        {...defaultProps}
        onThemeChange={handleThemeChange}
        onStickyScrollChange={handleStickyScrollChange}
      />
    );

    expect(screen.getByText('Reading & Navigation Preferences')).toBeInTheDocument();
    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    const sepiaBtn = screen.getByRole('button', { name: /Sepia/i });
    fireEvent.click(sepiaBtn);
    expect(handleThemeChange).toHaveBeenCalledWith('sepia');

    const alwaysFixedBtn = screen.getByRole('button', { name: /Always Fixed/i });
    fireEvent.click(alwaysFixedBtn);
    expect(handleStickyScrollChange).toHaveBeenCalledWith(false);
  });

  it('renders read-aloud section and handles speed selection', () => {
    const handleSpeechRateChange = vi.fn();

    render(
      <AccountPreferencesSection
        {...defaultProps}
        onSpeechRateChange={handleSpeechRateChange}
      />
    );

    expect(screen.getByText('Read-Aloud & Audio Narration')).toBeInTheDocument();
    expect(screen.getByText('1x (Baseline)')).toBeInTheDocument();

    const speedBtn125 = screen.getByRole('button', { name: '1.25x' });
    fireEvent.click(speedBtn125);
    expect(handleSpeechRateChange).toHaveBeenCalledWith(1.25);
  });

  it('handles auto-page advance and sentence highlight toggles', () => {
    const handleAutoPageChange = vi.fn();
    const handleHighlightChange = vi.fn();
    const handleReset = vi.fn();

    render(
      <AccountPreferencesSection
        {...defaultProps}
        onSpeechAutoPageAdvanceChange={handleAutoPageChange}
        onSpeechHighlightEnabledChange={handleHighlightChange}
        onResetSpeechPreferences={handleReset}
      />
    );

    const autoPageBtn = screen.getByRole('button', { name: /Auto-Page Advance/i });
    fireEvent.click(autoPageBtn);
    expect(handleAutoPageChange).toHaveBeenCalledWith(false);

    const highlightBtn = screen.getByRole('button', { name: /Sentence Highlighting/i });
    fireEvent.click(highlightBtn);
    expect(handleHighlightChange).toHaveBeenCalledWith(false);

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalled();
  });

  it('handles voice preview audio playback and toggle', () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    let savedUtterance: any = null;

    class MockUtterance {
      text: string;
      rate: number = 1.0;
      pitch: number = 1.0;
      voice: any = null;
      lang: string = 'en-US';
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    (global as any).SpeechSynthesisUtterance = MockUtterance;
    (window as any).SpeechSynthesisUtterance = MockUtterance;

    (window as any).speechSynthesis = {
      speak: speakMock.mockImplementation((utt) => {
        savedUtterance = utt;
        if (utt.onstart) utt.onstart();
      }),
      cancel: cancelMock,
      getVoices: vi.fn().mockReturnValue([
        { voiceURI: 'Jenny', name: 'Microsoft Jenny Natural (Online)', lang: 'en-US' },
        { voiceURI: 'David', name: 'Microsoft David Desktop', lang: 'en-US' },
      ]),
      onvoiceschanged: null,
    };

    const handleVoiceChange = vi.fn();

    render(
      <AccountPreferencesSection
        {...defaultProps}
        speechVoiceURI="Jenny"
        onSpeechVoiceChange={handleVoiceChange}
      />
    );

    const voiceSelect = screen.getByLabelText('Preferred narrator voice');
    expect(voiceSelect).toBeInTheDocument();
    fireEvent.change(voiceSelect, { target: { value: 'David' } });
    expect(handleVoiceChange).toHaveBeenCalledWith('David');

    const testVoiceBtn = screen.getByRole('button', { name: 'Test voice' });
    fireEvent.click(testVoiceBtn);
    expect(speakMock).toHaveBeenCalled();
    expect(savedUtterance).not.toBeNull();
    expect(savedUtterance.voice.voiceURI).toBe('Jenny');

    // Click again while playing to stop
    const stopSampleBtn = screen.getByRole('button', { name: 'Stop sample' });
    fireEvent.click(stopSampleBtn);
    expect(cancelMock).toHaveBeenCalled();
  });

  it('covers light and dark theme buttons and preview completion callbacks', () => {
    const handleThemeChange = vi.fn();
    const speakMock = vi.fn();

    class MockUtterance {
      text: string;
      rate: number = 1.0;
      pitch: number = 1.0;
      voice: any = null;
      lang: string = 'en-US';
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    (window as any).SpeechSynthesisUtterance = MockUtterance;
    (window as any).speechSynthesis = {
      speak: speakMock.mockImplementation((utt) => {
        if (utt.onstart) utt.onstart();
        if (utt.onend) utt.onend();
      }),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
      onvoiceschanged: null,
    };

    render(
      <AccountPreferencesSection
        {...defaultProps}
        theme="dark"
        speechAutoPageAdvance={false}
        speechHighlightEnabled={false}
        onThemeChange={handleThemeChange}
      />
    );

    const lightBtn = screen.getByRole('button', { name: 'Light' });
    fireEvent.click(lightBtn);
    expect(handleThemeChange).toHaveBeenCalledWith('light');

    const darkBtn = screen.getByRole('button', { name: 'Dark' });
    fireEvent.click(darkBtn);
    expect(handleThemeChange).toHaveBeenCalledWith('dark');

    // Test preview with null voice and error trigger
    const testVoiceBtn = screen.getByRole('button', { name: 'Test voice' });
    fireEvent.click(testVoiceBtn);
    expect(speakMock).toHaveBeenCalled();

    // Trigger error callback
    speakMock.mockImplementation((utt) => {
      if (utt.onerror) utt.onerror({ error: 'test' });
    });
    fireEvent.click(testVoiceBtn);
    expect(screen.getByRole('button', { name: 'Test voice' })).toBeInTheDocument();
  });
});

