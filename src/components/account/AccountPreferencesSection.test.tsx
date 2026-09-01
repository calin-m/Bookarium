import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountPreferencesSection } from './AccountPreferencesSection';

describe('AccountPreferencesSection', () => {
  it('handles theme switching and sticky scroll toggle', () => {
    const handleThemeChange = vi.fn();
    const handleStickyScrollChange = vi.fn();

    render(
      <AccountPreferencesSection
        theme="light"
        onThemeChange={handleThemeChange}
        stickyScrollEnabled={true}
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
});

