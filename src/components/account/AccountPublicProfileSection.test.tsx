import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('defaults to read-only View Mode data indicators with two 2-column identity rows, full-width bio, and footer Edit button', () => {
    const { container } = render(
      <AccountPublicProfileSection user={mockUser} profile={mockProfile} />
    );

    expect(screen.getByRole('region', { name: /scholar profile settings/i })).toBeInTheDocument();
    expect(screen.getByText('Public Sanctuary')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    // Two md:grid-cols-2 rows (Display Name + Email; Handle + Sanctuary URL) and no outer lg:grid-cols-12 split
    expect(container.querySelector('.lg\\:grid-cols-12')).toBeNull();
    expect(container.querySelectorAll('.md\\:grid-cols-2')).toHaveLength(2);

    // View mode renders calm read-only data indicators instead of inputs, switch, or checkboxes
    expect(screen.getByTestId('scholar-display-name-indicator')).toHaveTextContent('Jane Austen');
    expect(screen.getByTestId('scholar-private-email-indicator')).toHaveTextContent(
      'scholar@bookarium.test'
    );
    expect(screen.getByTestId('scholar-username-indicator')).toHaveTextContent('jane_austen');
    expect(screen.getByTestId('scholar-bio-indicator')).toHaveTextContent(
      'A passionate reader of 19th-century literature.'
    );
    expect(screen.getByTestId('public-profile-status-indicator')).toHaveTextContent(
      'Publicly Visible'
    );

    const visibilityIndicators = screen.getByTestId('sanctuary-visibility-indicators');
    expect(within(visibilityIndicators).getAllByText('Visible')).toHaveLength(4);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();

    // Footer Edit button + header Public View link + Copy URL stay directly accessible in View Mode
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^public view$/i })).toHaveAttribute(
      'href',
      '/u/jane_austen'
    );
  });

  it('renders Private Shield and Hidden indicators plus empty fallbacks when profile fields are unset or hidden', () => {
    render(
      <AccountPublicProfileSection
        user={{ ...mockUser, email: '' } as any}
        profile={{
          ...mockProfile,
          display_name: '   ',
          username: null,
          bio: null,
          is_public: false,
          show_streak: false,
          show_challenge: false,
          show_saved_books: false,
          show_custom_shelves: false,
        }}
      />
    );

    expect(screen.getByText('Private Sanctuary')).toBeInTheDocument();
    expect(screen.getByTestId('scholar-display-name-indicator')).toHaveTextContent('Not set');
    expect(screen.getByTestId('scholar-private-email-indicator')).toHaveTextContent(
      'No email linked'
    );
    expect(screen.getByTestId('scholar-username-indicator')).toHaveTextContent(
      'No handle claimed yet'
    );
    expect(screen.getByTestId('scholar-bio-indicator')).toHaveTextContent(
      'No literary motto or scholar bio added yet.'
    );
    expect(screen.getByTestId('public-profile-status-indicator')).toHaveTextContent(
      'Private Shield'
    );
    expect(within(screen.getByTestId('sanctuary-visibility-indicators')).getAllByText('Hidden')).toHaveLength(4);
  });

  it('enters Edit Mode cleanly with Cancel left of Save, allows toggling public switch, and discards drafts on Cancel', () => {
    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={{ ...mockProfile, is_public: false }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    // Footer shows Cancel left of Save
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    const footerButtons = cancelBtn.parentElement!.querySelectorAll('button');
    expect(footerButtons[0]).toBe(cancelBtn);
    expect(footerButtons[1]).toBe(saveBtn);

    // Edit Mode renders editable controls including disabled email input and toggle switch
    expect(screen.getByLabelText(/account email \(private\)/i)).toBeDisabled();

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: 'Unsaved Name' } });

    const bioInput = screen.getByLabelText(/scholar bio & literary motto/i);
    fireEvent.change(bioInput, { target: { value: 'Unsaved temporary motto' } });

    const toggle = screen.getByRole('switch', { name: /enable public scholar profile/i });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByText('Public Sanctuary')).toBeInTheDocument();

    // Cancel discards draft changes and returns to View Mode
    fireEvent.click(cancelBtn);

    expect(screen.getByTestId('scholar-display-name-indicator')).toHaveTextContent('Jane Austen');
    expect(screen.getByTestId('scholar-bio-indicator')).toHaveTextContent(
      'A passionate reader of 19th-century literature.'
    );
    expect(screen.getByTestId('public-profile-status-indicator')).toHaveTextContent(
      'Private Shield'
    );
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });

  it('validates username format in Edit Mode and displays descriptive error', () => {
    render(<AccountPublicProfileSection user={mockUser} profile={mockProfile} />);

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
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

  it('copies shareable link to clipboard directly from View Mode without entering Edit Mode', async () => {
    render(<AccountPublicProfileSection user={mockUser} profile={mockProfile} />);

    const copyBtn = screen.getByRole('button', { name: /copy public profile url/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/u/jane_austen'));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });

  it('submits updated display_name and public sanctuary settings cleanly on Save and returns to View Mode', async () => {
    const onUpdateProfileMock = vi.fn().mockResolvedValue({ error: null });

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Jane Austen CBE' },
    });
    fireEvent.change(screen.getByLabelText(/scholar bio & literary motto/i), {
      target: { value: 'Updated literary motto.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onUpdateProfileMock).toHaveBeenCalledWith({
        display_name: 'Jane Austen CBE',
        username: 'jane_austen',
        bio: 'Updated literary motto.',
        bio_book_id: null,
        bio_book_title: null,
        bio_book_author: null,
        is_public: true,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
        show_saved_books: true,
        show_custom_shelves: true,
      });
    });

    expect(await screen.findByText(/scholar profile saved successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByTestId('scholar-display-name-indicator')).toHaveTextContent(
      'Jane Austen CBE'
    );
    expect(screen.getByTestId('scholar-bio-indicator')).toHaveTextContent(
      'Updated literary motto.'
    );
  });

  it('blocks submission, keeps Edit Mode open, and displays errors when public is enabled without username or display name is empty', async () => {
    const onUpdateProfileMock = vi.fn();

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={{ ...mockProfile, username: null }}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    fireEvent.click(saveBtn);

    expect(
      await screen.findByText(/a username is required to publish your scholar profile/i)
    ).toBeInTheDocument();
    expect(onUpdateProfileMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: '   ' } });
    fireEvent.submit(displayNameInput.closest('form')!);
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();
    expect(onUpdateProfileMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('stays in Edit Mode and displays error message if update fails', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText('Username already taken.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('allows toggling Saved Works and Custom Shelves independently inside Edit Mode', async () => {
    const onUpdateProfileMock = vi.fn().mockResolvedValue({ error: null });

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={mockProfile}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const savedWorksCheckbox = screen.getByRole('checkbox', { name: /saved works/i });
    const customShelvesCheckbox = screen.getByRole('checkbox', { name: /custom shelves/i });

    expect(savedWorksCheckbox).toBeChecked();
    expect(customShelvesCheckbox).toBeChecked();

    // Toggle off saved works
    fireEvent.click(savedWorksCheckbox);
    expect(savedWorksCheckbox).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onUpdateProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          show_saved_books: false,
          show_custom_shelves: true,
          show_bookshelves: true,
        })
      );
    });

    expect(screen.getByTestId('visibility-indicator-saved_books')).toHaveTextContent('Hidden');
    expect(screen.getByTestId('visibility-indicator-custom_shelves')).toHaveTextContent('Visible');
  });

  it('uses solid border-border without fractional borders in both View Mode and Edit Mode', () => {
    const { container } = render(
      <AccountPublicProfileSection user={mockUser} profile={{ ...mockProfile, is_public: true }} />
    );

    expect(container.innerHTML).not.toContain('border-primary/20');
    expect(container.innerHTML).not.toContain('border-success/20');

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(container.innerHTML).not.toContain('border-primary/20');
    expect(container.innerHTML).not.toContain('border-success/20');
  });

  it('syncs reactive state when profile prop updates, toggles all privacy checkboxes, and recovers from thrown errors', async () => {
    const onUpdateProfileMock = vi.fn().mockRejectedValueOnce(new Error('Fatal network crash'));

    const { rerender } = render(
      <AccountPublicProfileSection
        user={{ ...mockUser, user_metadata: { display_name: 'Fallback Name' } } as any}
        profile={null}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    expect(screen.getByTestId('scholar-display-name-indicator')).toHaveTextContent(
      'Fallback Name'
    );
    expect(screen.getByText(/Set a handle to generate link/i)).toBeInTheDocument();

    // Update profile prop to trigger reactive prevProfile sync
    rerender(
      <AccountPublicProfileSection
        user={mockUser}
        profile={{
          ...mockProfile,
          display_name: 'Emily Brontë',
          username: 'emily_bronte',
          bio: 'Wuthering Heights',
          show_saved_books: undefined,
          show_custom_shelves: undefined,
        }}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    expect(screen.getByTestId('scholar-display-name-indicator')).toHaveTextContent('Emily Brontë');
    expect(screen.getByTestId('scholar-username-indicator')).toHaveTextContent('emily_bronte');

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Emily Brontë');
    const usernameInput = screen.getByLabelText(/scholar handle/i);
    expect(usernameInput).toHaveValue('emily_bronte');

    // Type invalid username then clear it to exercise empty handleUsernameChange branch
    fireEvent.change(usernameInput, { target: { value: 'a' } });
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    fireEvent.change(usernameInput, { target: { value: '' } });
    expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument();
    fireEvent.change(usernameInput, { target: { value: 'emily_bronte' } });

    // Toggle Streak, Annual Goal, and Custom Shelves directly in Edit Mode
    fireEvent.click(screen.getByRole('checkbox', { name: /reading streak/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /annual goal/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /custom shelves/i }));

    // Submit -> triggers catch block while staying in Edit Mode
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(
      await screen.findByText('Failed to update scholar profile. Please try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('disables @username input and shows offline hint when entering Edit Mode offline while keeping bio and privacy editable', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    try {
      render(<AccountPublicProfileSection user={mockUser} profile={mockProfile} />);

      fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

      const usernameInput = screen.getByLabelText(/scholar handle/i);
      expect(usernameInput).toBeDisabled();
      expect(screen.getByTestId('username-offline-hint')).toHaveTextContent(
        /Username changes require an internet connection/i
      );

      const bioInput = screen.getByLabelText(/scholar bio & literary motto/i);
      expect(bioInput).not.toBeDisabled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });

  it('picks a saved highlight as motto, saves book attribution, and clears attribution on manual edit or removal', async () => {
    const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
    const onUpdateProfileMock = vi.fn().mockResolvedValue({ error: null });

    useAnnotationStore.setState({
      annotations: [
        {
          id: 'hl-bio-1',
          bookId: 1342,
          bookTitle: 'Pride and Prejudice',
          bookAuthor: 'Jane Austen',
          chapterIndex: 0,
          chapterPage: 0,
          selectedText: 'My courage always rises at every attempt to intimidate me.',
          color: 'amber',
          createdAt: '2026-01-12T10:00:00Z',
          updatedAt: '2026-01-12T10:00:00Z',
        },
      ],
    });

    render(
      <AccountPublicProfileSection
        user={mockUser}
        profile={{
          ...mockProfile,
          bio: 'Original custom motto',
          bio_book_id: null,
          bio_book_title: null,
          bio_book_author: null,
        }}
        onUpdateProfile={onUpdateProfileMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByText(`${'Original custom motto'.length}/400`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pick-highlight-bio-btn'));
    expect(await screen.findByTestId('highlight-bio-picker-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /use highlight/i }));

    expect(screen.getByLabelText(/scholar bio & literary motto/i)).toHaveValue(
      'My courage always rises at every attempt to intimidate me.'
    );
    expect(screen.getByTestId('scholar-bio-attribution-edit-pill')).toHaveTextContent(
      /Pride and Prejudice/i
    );

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onUpdateProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: 'My courage always rises at every attempt to intimidate me.',
          bio_book_id: 1342,
          bio_book_title: 'Pride and Prejudice',
          bio_book_author: 'Jane Austen',
        })
      );
    });

    expect(screen.getByTestId('scholar-bio-source-indicator')).toHaveTextContent(
      /From Pride and Prejudice by Jane Austen/i
    );

    // Re-enter Edit Mode -> Remove book link clears attribution without clearing motto text
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove highlighted book link/i }));
    expect(screen.queryByTestId('scholar-bio-attribution-edit-pill')).toBeNull();
    expect(screen.getByLabelText(/scholar bio & literary motto/i)).toHaveValue(
      'My courage always rises at every attempt to intimidate me.'
    );

    // Cancel reverts back to previously committed state; picking and editing clears attribution cleanly
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByTestId('scholar-bio-source-indicator')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText(/scholar bio & literary motto/i), {
      target: { value: 'Purely personal literary note.' },
    });
    expect(screen.queryByTestId('scholar-bio-attribution-edit-pill')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(onUpdateProfileMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          bio: 'Purely personal literary note.',
          bio_book_id: null,
          bio_book_title: null,
          bio_book_author: null,
        })
      );
    });
  });
});

