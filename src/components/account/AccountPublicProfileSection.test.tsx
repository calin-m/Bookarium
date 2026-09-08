import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountPublicProfileSection } from './AccountPublicProfileSection';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

const mockUser: User = {
  id: 'user-scholar-123',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2025-01-01T00:00:00.000Z',
  email: 'scholar@bookarium.test',
} as any;

const mockProfile: Profile = {
  id: 'user-scholar-123',
  display_name: 'Jane Austen',
  username: 'jane_austen',
  bio: 'A passionate reader of 19th-century literature.',
  is_public: true,
  show_streak: true,
  show_challenge: true,
  show_bookshelves: true,
  show_saved_books: true,
  show_custom_shelves: true,
  preferred_theme: 'light',
  font_size: 18,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

describe('AccountPublicProfileSection', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  it('renders public scholar profile section with profile data', () => {
    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
      />
    );

    expect(screen.getByRole('region', { name: /public scholar profile settings/i })).toBeInTheDocument();
    expect(screen.getByText('Public Sanctuary')).toBeInTheDocument();

    const usernameInput = screen.getByLabelText(/scholar handle/i);
    expect(usernameInput).toHaveValue('jane_austen');

    const bioInput = screen.getByLabelText(/scholar bio & literary motto/i);
    expect(bioInput).toHaveValue('A passionate reader of 19th-century literature.');
  });

  it('toggles master public profile switch and updates badge', () => {
    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={{ ...mockProfile, is_public: false }}
      />
    );

    expect(screen.getByText('Private Sanctuary')).toBeInTheDocument();

    const toggle = screen.getByRole('switch', { name: /enable public scholar profile/i });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByText('Public Sanctuary')).toBeInTheDocument();
  });

  it('validates username format and displays descriptive error', () => {
    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
      />
    );

    const usernameInput = screen.getByLabelText(/scholar handle/i);

    // Too short
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    expect(screen.getByText(/at least 3 characters long/i)).toBeInTheDocument();

    // Invalid character
    fireEvent.change(usernameInput, { target: { value: 'user name!' } });
    expect(screen.getByText(/username can only contain/i)).toBeInTheDocument();

    // Valid
    fireEvent.change(usernameInput, { target: { value: 'valid_user-123' } });
    expect(screen.queryByText(/at least 3 characters long/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/username can only contain/i)).not.toBeInTheDocument();
  });

  it('copies shareable link to clipboard when clicked', async () => {
    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy public profile url/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/u/jane_austen'));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('submits updated profile settings and handles success', async () => {
    const onUpdateProfileMock = vi.fn().mockResolvedValue({ error: null });

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    const bioInput = screen.getByLabelText(/scholar bio & literary motto/i);
    fireEvent.change(bioInput, { target: { value: 'Updated literary motto.' } });

    const submitBtn = screen.getByRole('button', { name: /save public settings/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onUpdateProfileMock).toHaveBeenCalledWith({
        username: 'jane_austen',
        bio: 'Updated literary motto.',
        is_public: true,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        show_saved_books: true,
        show_custom_shelves: true,
      });
    });

    expect(await screen.findByText(/scholar profile preferences saved successfully/i)).toBeInTheDocument();
  });

  it('blocks submission and displays error when public is enabled without username', async () => {
    const onUpdateProfileMock = vi.fn();

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={{ ...mockProfile, username: null }}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /save public settings/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/a username is required to publish your scholar profile/i)).toBeInTheDocument();
    expect(onUpdateProfileMock).not.toHaveBeenCalled();
  });

  it('displays error message if update fails', async () => {
    const onUpdateProfileMock = vi.fn().mockResolvedValue({
      error: new Error('Username already taken.'),
    });

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /save public settings/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Username already taken.')).toBeInTheDocument();
  });

  it('allows toggling Saved Works and Custom Shelves independently', async () => {
    const onUpdateProfileMock = vi.fn().mockResolvedValue({ error: null });

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    const savedWorksCheckbox = screen.getByRole('checkbox', { name: /saved works/i });
    const customShelvesCheckbox = screen.getByRole('checkbox', { name: /custom shelves/i });

    expect(savedWorksCheckbox).toBeChecked();
    expect(customShelvesCheckbox).toBeChecked();

    // Toggle off saved works
    fireEvent.click(savedWorksCheckbox);
    expect(savedWorksCheckbox).not.toBeChecked();

    const submitBtn = screen.getByRole('button', { name: /save public settings/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onUpdateProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          show_saved_books: false,
          show_custom_shelves: true,
          show_bookshelves: true,
        })
      );
    });
  });
});
