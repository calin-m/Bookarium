import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountIdentityCard } from './AccountIdentityCard';

describe('AccountIdentityCard', () => {
  const mockUser = {
    id: 'u1',
    email: 'reader@bookarium.test',
    user_metadata: { display_name: 'Test Reader' },
  } as any;

  const mockProfile = {
    id: 'u1',
    display_name: 'Test Reader',
    preferred_theme: 'light',
  } as any;

  it('renders user details and handles input change and submit', () => {
    const handleDisplayNameChange = vi.fn();
    const handleSaveProfile = vi.fn((e) => e.preventDefault());

    render(
      <AccountIdentityCard
        user={mockUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={handleDisplayNameChange}
        onSaveProfile={handleSaveProfile}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
      />
    );

    expect(screen.getByText('Test Reader')).toBeInTheDocument();
    expect(screen.getByText('reader@bookarium.test')).toBeInTheDocument();
    expect(screen.getByText('January 2026')).toBeInTheDocument();
    expect(screen.getByText('Verified Reader')).toBeInTheDocument();

    const input = screen.getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Updated Reader' } });
    expect(handleDisplayNameChange).toHaveBeenCalledWith('Updated Reader');

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    expect(handleSaveProfile).toHaveBeenCalled();
  });

  it('renders error message and success feedback', () => {
    const { rerender } = render(
      <AccountIdentityCard
        user={mockUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError="Failed to save changes"
      />
    );

    expect(screen.getByText('Failed to save changes')).toBeInTheDocument();

    rerender(
      <AccountIdentityCard
        user={mockUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={true}
        saveError={null}
      />
    );

    expect(screen.getByText('Changes saved to cloud')).toBeInTheDocument();
  });
});

