import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import type { User } from '@supabase/supabase-js';

const mockUser = {
  id: 'user-1',
  email: 'reader@example.com',
  created_at: '2025-01-15T00:00:00Z',
  user_metadata: { display_name: 'Bookworm' },
} as unknown as User;

describe('ProfileIdentityCard Component', () => {
  it('renders user details and verified badge', () => {
    render(
      <ProfileIdentityCard
        user={mockUser}
        profile={{ id: 'user-1', display_name: 'Bookworm', preferred_theme: 'sepia', font_size: 16, created_at: '', updated_at: '' }}
        formattedDate="January 2025"
        displayName="Bookworm"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
      />
    );

    expect(screen.getByText('Bookworm')).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
    expect(screen.getByText('January 2025')).toBeInTheDocument();
    expect(screen.getByText('Verified Reader')).toBeInTheDocument();
  });

  it('handles display name editing and form submission', () => {
    const handleNameChange = vi.fn();
    const handleSave = vi.fn((e) => e.preventDefault());

    render(
      <ProfileIdentityCard
        user={mockUser}
        profile={null}
        formattedDate="January 2025"
        displayName="Bookworm"
        onDisplayNameChange={handleNameChange}
        onSaveProfile={handleSave}
        isSaving={false}
        saveSuccess={true}
        saveError="Failed to save"
      />
    );

    const input = screen.getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Jane Reader' } });
    expect(handleNameChange).toHaveBeenCalledWith('Jane Reader');

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(handleSave).toHaveBeenCalled();

    expect(screen.getByText('Changes saved to cloud')).toBeInTheDocument();
    expect(screen.getByText('Failed to save')).toBeInTheDocument();
  });
});
