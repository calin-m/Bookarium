import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReaderSpeechBar, type ReaderSpeechBarProps } from './ReaderSpeechBar';

const mockVoices: SpeechSynthesisVoice[] = [
  {
    name: 'Microsoft Jenny Natural',
    lang: 'en-US',
    default: true,
    localService: false,
    voiceURI: 'Jenny',
  } as SpeechSynthesisVoice,
  {
    name: 'Microsoft Guy Natural',
    lang: 'en-US',
    default: false,
    localService: false,
    voiceURI: 'Guy',
  } as SpeechSynthesisVoice,
];

describe('ReaderSpeechBar', () => {
  const defaultProps: ReaderSpeechBarProps = {
    isOpen: true,
    onClose: vi.fn(),
    isPlaying: false,
    isPaused: false,
    currentSentenceIndex: 0,
    totalSentences: 10,
    rate: 1.15,
    availableVoices: mockVoices,
    selectedVoice: mockVoices[0],
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onSkipNext: vi.fn(),
    onSkipPrev: vi.fn(),
    onRateChange: vi.fn(),
    onVoiceChange: vi.fn(),
    theme: 'light',
    bookTitle: 'Pride and Prejudice',
  };

  it('renders null when isOpen is false', () => {
    const { container } = render(<ReaderSpeechBar {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders narration metadata, page coordinates, and progress percentage', () => {
    render(
      <ReaderSpeechBar
        {...defaultProps}
        currentSentenceIndex={4}
        totalSentences={10}
        currentPage={3}
        totalPages={20}
      />
    );
    expect(screen.getByText('Read Aloud')).toBeInTheDocument();
    expect(screen.getByTestId('speech-page-indicator')).toHaveTextContent('• Page 3/20');
    expect(screen.getByText(/5 \/ 10 \(50%\)/)).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });

  it('handles play, pause, and resume actions accurately', () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();

    // Idle state -> click Listen
    const { rerender } = render(
      <ReaderSpeechBar {...defaultProps} isPlaying={false} isPaused={false} onPlay={onPlay} />
    );
    const listenBtn = screen.getByRole('button', { name: 'Play narration' });
    expect(listenBtn).toHaveTextContent('Listen');
    fireEvent.click(listenBtn);
    expect(onPlay).toHaveBeenCalledTimes(1);

    // Playing state -> click Pause
    rerender(
      <ReaderSpeechBar {...defaultProps} isPlaying={true} isPaused={false} onPause={onPause} />
    );
    const pauseBtn = screen.getByRole('button', { name: 'Pause narration' });
    expect(pauseBtn).toHaveTextContent('Pause');
    fireEvent.click(pauseBtn);
    expect(onPause).toHaveBeenCalledTimes(1);

    // Paused state -> click Resume
    rerender(
      <ReaderSpeechBar {...defaultProps} isPlaying={false} isPaused={true} onResume={onResume} />
    );
    const resumeBtn = screen.getByRole('button', { name: 'Play narration' });
    expect(resumeBtn).toHaveTextContent('Resume');
    fireEvent.click(resumeBtn);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('navigates previous and next sentences and respects boundary disable flags', () => {
    const onSkipNext = vi.fn();
    const onSkipPrev = vi.fn();

    const { rerender } = render(
      <ReaderSpeechBar
        {...defaultProps}
        currentSentenceIndex={0}
        totalSentences={5}
        isPrevDisabled={true}
        isNextDisabled={false}
        onSkipNext={onSkipNext}
        onSkipPrev={onSkipPrev}
      />
    );

    const prevBtn = screen.getByRole('button', { name: 'Previous sentence' });
    const nextBtn = screen.getByRole('button', { name: 'Next sentence' });

    // At index 0 with isPrevDisabled=true, previous is disabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onSkipNext).toHaveBeenCalledTimes(1);

    // At last index with isNextDisabled=true, next is disabled
    rerender(
      <ReaderSpeechBar
        {...defaultProps}
        currentSentenceIndex={4}
        totalSentences={5}
        isPrevDisabled={false}
        isNextDisabled={true}
        onSkipNext={onSkipNext}
        onSkipPrev={onSkipPrev}
      />
    );

    const updatedNextBtn = screen.getByRole('button', { name: 'Next sentence' });
    const updatedPrevBtn = screen.getByRole('button', { name: 'Previous sentence' });

    expect(updatedNextBtn).toBeDisabled();
    expect(updatedPrevBtn).not.toBeDisabled();

    fireEvent.click(updatedPrevBtn);
    expect(onSkipPrev).toHaveBeenCalledTimes(1);
  });

  it('allows changing voices via dropdown', () => {
    const onVoiceChange = vi.fn();
    render(<ReaderSpeechBar {...defaultProps} onVoiceChange={onVoiceChange} />);

    const select = screen.getByRole('combobox', { name: 'Narrator voice' });
    fireEvent.change(select, { target: { value: 'Guy' } });

    expect(onVoiceChange).toHaveBeenCalledWith('Guy');
  });

  it('renders categorized optgroups for Natural and Standard voices with quality badge', () => {
    const naturalVoice = {
      name: 'Microsoft Jenny Natural',
      lang: 'en-US',
      default: true,
      localService: false,
      voiceURI: 'Jenny',
    } as SpeechSynthesisVoice;
    const standardVoice = {
      name: 'Microsoft David Desktop',
      lang: 'en-US',
      default: false,
      localService: true,
      voiceURI: 'David',
    } as SpeechSynthesisVoice;

    render(
      <ReaderSpeechBar
        {...defaultProps}
        availableVoices={[naturalVoice, standardVoice]}
        naturalVoices={[naturalVoice]}
        standardVoices={[standardVoice]}
      />
    );

    expect(screen.getByRole('group', { name: '🌟 Natural & Neural' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '🔈 Standard Voices' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Jenny Natural \(en-US\) ✨/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /David Desktop \(en-US\)/ })).toBeInTheDocument();
  });

  it('allows selecting speed rates from the popover menu', async () => {
    const user = userEvent.setup();
    const onRateChange = vi.fn();

    render(<ReaderSpeechBar {...defaultProps} onRateChange={onRateChange} rate={1.15} />);

    const speedToggle = screen.getByRole('button', { name: 'Speech rate: 1.15x' });
    await user.click(speedToggle);

    // Click 1.5x preset
    const option15 = screen.getByRole('button', { name: '1.5x' });
    await user.click(option15);

    expect(onRateChange).toHaveBeenCalledWith(1.5);
  });

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn();
    render(<ReaderSpeechBar {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: 'Close Read Aloud' });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adapts properly to sepia and dark themes', () => {
    const { rerender } = render(<ReaderSpeechBar {...defaultProps} theme="sepia" isPlaying={true} />);
    expect(screen.getByTestId('reader-speech-bar')).toBeInTheDocument();

    rerender(<ReaderSpeechBar {...defaultProps} theme="dark" isPlaying={false} />);
    expect(screen.getByTestId('reader-speech-bar')).toBeInTheDocument();
  });

  it('renders with mobile-responsive positioning and WCAG touch target classes', () => {
    render(<ReaderSpeechBar {...defaultProps} />);
    const container = screen.getByTestId('reader-speech-bar');
    expect(container).toHaveClass('fixed');
    expect(container).toHaveClass('z-50');
    expect(container).toHaveClass('left-0');
    expect(container).toHaveClass('right-0');
    expect(container).toHaveClass('mx-auto');

    const closeBtn = screen.getByRole('button', { name: 'Close Read Aloud' });
    expect(closeBtn).toHaveClass('min-w-[36px]');
    expect(closeBtn).toHaveClass('min-h-[36px]');

    const prevBtn = screen.getByRole('button', { name: 'Previous sentence' });
    expect(prevBtn).toHaveClass('min-w-[40px]');
    expect(prevBtn).toHaveClass('min-h-[40px]');
  });
});
