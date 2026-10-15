import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountIdentityCard } from './AccountIdentityCard';

describe('AccountIdentityCard (Slim Scholar Identity Ribbon)', () => {
  const mockVerifiedUser = {
    id: 'u1',
    email: 'reader@bookarium.test',
    email_confirmed_at: '2026-01-01T12:00:00Z',
    user_metadata: { display_name: 'Test Reader' },
  } as any;

  const mockUnverifiedUser = {
    id: 'u2',
    email: 'unverified@bookarium.test',
    email_confirmed_at: null,
    user_metadata: { display_name: 'New Reader' },
  } as any;

  const mockProfile = {
    id: 'u1',
    display_name: 'Test Reader',
    username: 'test_scholar',
    preferred_theme: 'light',
  } as any;

  it('renders slim scholar identity ribbon with inline clickable stat pills and toggles quick name editor', () => {
    const handleDisplayNameChange = vi.fn();
    const handleSaveProfile = vi.fn((e) => e.preventDefault());

    render(
      <AccountIdentityCard
        user={mockVerifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={handleDisplayNameChange}
        onSaveProfile={handleSaveProfile}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        stats={{
          savedCount: 12,
          favoriteCount: 4,
          annotationCount: 9,
          customShelvesCount: 2,
          bookmarksCount: 3,
          readingStreak: 7,
        }}
      />
    );

    expect(screen.getByTestId('scholar-identity-ribbon')).toBeInTheDocument();
    expect(screen.getByText('Test Reader')).toBeInTheDocument();
    expect(screen.getByText('test_scholar')).toBeInTheDocument();
    expect(screen.getByText('reader@bookarium.test')).toBeInTheDocument();
    expect(screen.getByText('January 2026')).toBeInTheDocument();
    expect(screen.getByText('Verified Reader')).toBeInTheDocument();
    expect(screen.getByTestId('identity-ribbon-stat-strip')).toBeInTheDocument();
    expect(screen.getByText('🔥 7d Streak')).toBeInTheDocument();

    // Toggle quick name editor
    const toggleBtn = screen.getByRole('button', {
      name: /Toggle quick display name editor/i,
    });
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const input = screen.getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Updated Reader' } });
    expect(handleDisplayNameChange).toHaveBeenCalledWith('Updated Reader');

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);
    expect(handleSaveProfile).toHaveBeenCalled();
  });

  it('renders unverified badge and handles resend verification click', () => {
    const onResendVerification = vi.fn();

    render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={null}
        formattedDate="February 2026"
        displayName="New Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        onResendVerification={onResendVerification}
        isResendingVerification={false}
        resendCooldown={0}
      />
    );

    expect(screen.getByText('Email Unverified')).toBeInTheDocument();
    expect(screen.queryByText('Verified Reader')).not.toBeInTheDocument();
    expect(screen.getByText(/Please verify your email address/i)).toBeInTheDocument();

    const resendBtn = screen.getByRole('button', { name: 'Resend Verification Link' });
    fireEvent.click(resendBtn);
    expect(onResendVerification).toHaveBeenCalledTimes(1);
  });

  it('renders sending spinner and cooldown timer during resend verification states', () => {
    const { rerender } = render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={null}
        formattedDate="February 2026"
        displayName="New Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        onResendVerification={vi.fn()}
        isResendingVerification={true}
        resendCooldown={0}
      />
    );
    expect(screen.getByText('Sending...')).toBeInTheDocument();

    rerender(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={null}
        formattedDate="February 2026"
        displayName="New Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={false}
        saveError={null}
        onResendVerification={vi.fn()}
        isResendingVerification={false}
        resendCooldown={45}
      />
    );
    expect(screen.getByText('Resend in 45s')).toBeInTheDocument();
  });

  it('displays save error and save success alert banners', () => {
    render(
      <AccountIdentityCard
        user={mockUnverifiedUser}
        profile={mockProfile}
        formattedDate="January 2026"
        displayName="Test Reader"
        onDisplayNameChange={vi.fn()}
        onSaveProfile={vi.fn()}
        isSaving={false}
        saveSuccess={true}
        saveError="Failed to save changes"
        resendSuccess={true}
        resendError="Rate limit exceeded"
      />
    );

    expect(screen.getByText('Failed to save changes')).toBeInTheDocument();
    expect(screen.getByText('Changes saved to cloud')).toBeInTheDocument();
    expect(screen.getByText('Verification link sent! Check your inbox.')).toBeInTheDocument();
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
  });
});
