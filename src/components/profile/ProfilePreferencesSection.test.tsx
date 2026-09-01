import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfilePreferencesSection } from './ProfilePreferencesSection';

describe('ProfilePreferencesSection Component', () => {
  it('renders theme switcher and navigation mode preferences', () => {
    const handleThemeChange = vi.fn();
    const handleStickyChange = vi.fn();

    render(
      <ProfilePreferencesSection
        theme="sepia"
        onThemeChange={handleThemeChange}
        stickyScrollEnabled={true}
        onStickyScrollChange={handleStickyChange}
      />
    );

    expect(screen.getByText('Reading & Navigation Preferences')).toBeInTheDocument();
    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dark/i }));
    expect(handleThemeChange).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByRole('button', { name: /Always Fixed/i }));
    expect(handleStickyChange).toHaveBeenCalledWith(false);
  });
});

