import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderFloatingToolsPod } from './ReaderFloatingToolsPod';

describe('ReaderFloatingToolsPod', () => {
  it('toggles the floating quick tools menu and invokes search, theme, controls, annotations, speech, and translation callbacks', () => {
    const onToggleSearch = vi.fn();
    const onToggleControls = vi.fn();
    const onToggleAnnotations = vi.fn();
    const onToggleSpeech = vi.fn();
    const onToggleTranslations = vi.fn();
    const onThemeChange = vi.fn();

    render(
      <ReaderFloatingToolsPod
        theme="light"
        annotationsCount={3}
        isTocOpen={false}
        isAnnotationsOpen={false}
        isSearchOpen={false}
        isSpeechOpen={false}
        isControlsOpen={false}
        isTranslationsOpen={false}
        onToggleSearch={onToggleSearch}
        onToggleControls={onToggleControls}
        onToggleAnnotations={onToggleAnnotations}
        onToggleSpeech={onToggleSpeech}
        onToggleTranslations={onToggleTranslations}
        onThemeChange={onThemeChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search in Book' }));
    expect(onToggleSearch).toHaveBeenCalledTimes(1);

    const toggleBtn = screen.getByTestId('footer-settings-toggle');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('footer-floating-tools-bar')).toBeInTheDocument();
    expect(screen.getByTestId('footer-annotations-badge')).toHaveTextContent(
      '3'
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Current theme: light\. Click to switch theme\./i,
      })
    );
    expect(onThemeChange).toHaveBeenCalledWith('sepia');

    fireEvent.click(
      screen.getByRole('button', { name: 'Typography & Theme Controls' })
    );
    expect(onToggleControls).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Notes & Highlights' })
    );
    expect(onToggleAnnotations).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Read Aloud Narration' })
    );
    expect(onToggleSpeech).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Language Editions & Translations' })
    );
    expect(onToggleTranslations).toHaveBeenCalledTimes(1);
  });
});
