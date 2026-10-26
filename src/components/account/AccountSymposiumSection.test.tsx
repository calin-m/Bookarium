import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountSymposiumSection } from './AccountSymposiumSection';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useAuthStore } from '@/stores/useAuthStore';

let mockAccountOfflineIds: number[] = [];
vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBookIds: mockAccountOfflineIds,
    isBookOffline: (id: number) => mockAccountOfflineIds.includes(id),
  }),
}));

describe('AccountSymposiumSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountOfflineIds = [];
    useFellowshipStore.getState().clearFellowshipState();
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', username: 'jane_austen', display_name: 'Jane Austen' } as any,
    });
  });

  it('switches between Active Symposiums, Reader Circle, and Invitations sub-tabs', async () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c-accepted',
          requester_id: 'u1',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u2',
          recipient_username: 'bronte',
          recipient_display_name: 'Charlotte Brontë',
          status: 'accepted',
          created_at: '',
          updated_at: '',
        },
        {
          id: 'c-pending',
          requester_id: 'u3',
          requester_username: 'shelley',
          requester_display_name: 'Mary Shelley',
          recipient_id: 'u1',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
      symposiums: [
        {
          id: 's-active',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          host_id: 'u1',
          host_username: 'jane_austen',
          host_display_name: 'Jane Austen',
          fellow_id: 'u2',
          fellow_username: 'bronte',
          fellow_display_name: 'Charlotte Brontë',
          status: 'active',
          host_chapter: 2,
          host_progress: 35,
          fellow_chapter: 4,
          fellow_progress: 60,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<AccountSymposiumSection userId="u1" />);

    // Default sub-tab: Active Symposiums
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Charlotte Brontë (Sec. 5)')).toBeInTheDocument();

    const section = screen.getByTestId('account-symposium-section');
    expect(section.innerHTML).not.toContain('border-border/60');
    expect(section.innerHTML).not.toContain('border-primary/20');

    // Assert editorial underline sub-tab bar
    const tablist = screen.getByRole('tablist', { name: /Symposium and Reader Circle sections/i });
    expect(tablist).toHaveClass('flex', 'items-center', 'overflow-x-auto');
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => {
      expect(tab).toHaveClass('border-b-2', 'whitespace-nowrap', 'shrink-0');
    });

    const activeSympTab = screen.getByRole('tab', { name: /Active Symposiums/i });
    const circleTab = screen.getByRole('tab', { name: /Reader Circle/i });
    expect(within(activeSympTab).getByText('Active Symposiums')).toHaveClass('inline');
    expect(within(circleTab).getByText('Reader Circle')).toHaveClass('hidden', 'md:inline');

    // Switch to Reader Circle sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));
    expect(screen.getByText('Charlotte Brontë')).toBeInTheDocument();
    expect(screen.getByText('@bronte')).toBeInTheDocument();

    // Switch to Invitations sub-tab and accept incoming request
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText(/Mary Shelley \(@shelley\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Accept Fellow/i }));

    await waitFor(() => {
      expect(useFellowshipStore.getState().getAcceptedFellows('u1')).toHaveLength(2);
    });
  });

  it('renders empty states when there are zero symposiums, circle fellows, or invitations', () => {
    render(<AccountSymposiumSection userId="u1" />);

    // Empty symposiums
    expect(screen.getByText('No Active Literary Symposiums')).toBeInTheDocument();

    // Switch to Reader Circle -> Empty
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));
    expect(screen.getByText(/No connected Fellow Scholars yet/i)).toBeInTheDocument();

    // Switch to Invitations -> Empty
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText(/No pending Reader Circle or Symposium invitations/i)).toBeInTheDocument();
  });

  it('handles fellow invitation form submission with error and success banners', async () => {
    render(<AccountSymposiumSection userId="u1" />);

    // Switch to Reader Circle
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));

    const input = screen.getByLabelText(/Invite Fellow Scholar/i);
    const submitBtn = screen.getByRole('button', { name: /Send Circle Invitation/i });

    // Empty input submission does nothing
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(submitBtn);
    expect(screen.queryByText(/Fellowship invitation sent/i)).not.toBeInTheDocument();

    // Mock inviteFellowByUsername failure
    const mockStore = useFellowshipStore.getState();
    const originalInvite = mockStore.inviteFellowByUsername;
    mockStore.inviteFellowByUsername = vi.fn().mockResolvedValue({
      error: { message: 'Scholar handle not found.' },
      circle: null,
    });

    fireEvent.change(input, { target: { value: 'unknown_scholar' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Scholar handle not found.')).toBeInTheDocument();
    });

    // Mock inviteFellowByUsername success
    mockStore.inviteFellowByUsername = vi.fn().mockResolvedValue({
      error: null,
      circle: { recipient_username: 'woolf' },
    });

    fireEvent.change(input, { target: { value: 'woolf' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Fellowship invitation sent to @woolf\./i)).toBeInTheDocument();
    });

    mockStore.inviteFellowByUsername = originalInvite;
  });

  it('allows declining an incoming circle invitation', async () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c-decline',
          requester_id: 'u4',
          requester_username: 'dickens',
          requester_display_name: 'Charles Dickens',
          recipient_id: 'u1',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<AccountSymposiumSection userId="u1" />);

    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText(/Charles Dickens \(@dickens\)/i)).toBeInTheDocument();

    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(useFellowshipStore.getState().circles.find((c) => c.id === 'c-decline')).toBeUndefined();
    });
  });

  it('renders completed companion symposium cards, opens New Symposium Pact modal, and handles leaving a symposium', async () => {
    const leaveSpy = vi.fn().mockResolvedValue({ error: null });
    useFellowshipStore.setState({
      leaveSymposium: leaveSpy,
      symposiums: [
        {
          id: 's-completed-fellow',
          book_id: 84,
          book_title: '',
          host_id: 'u2',
          host_username: 'shelley',
          host_display_name: '',
          fellow_id: 'u1',
          fellow_username: 'jane_austen',
          fellow_display_name: 'Jane Austen',
          status: 'completed',
          host_chapter: 9,
          host_progress: 100,
          fellow_chapter: 9,
          fellow_progress: 100,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<AccountSymposiumSection userId="u1" />);

    expect(screen.getByText('Completed Pact')).toBeInTheDocument();
    expect(screen.getByText('Volume #84')).toBeInTheDocument();
    expect(screen.getByText('@shelley (Sec. 10)')).toBeInTheDocument();

    // Open New Symposium Pact modal and close it
    fireEvent.click(screen.getByRole('button', { name: /New Symposium Pact/i }));
    const closeModalBtn = await screen.findByRole('button', {
      name: /^Close$/i,
    });
    fireEvent.click(closeModalBtn);

    // Leave symposium
    fireEvent.click(screen.getByRole('button', { name: /Leave Symposium/i }));
    expect(leaveSpy).toHaveBeenCalledWith('s-completed-fellow');
  });

  it('supports Reader Circle fellow Symposium launch, fellow removal, and all pending invitation actions', async () => {
    const removeFellowSpy = vi.fn().mockResolvedValue({ error: null });
    const respondSymposiumSpy = vi.fn().mockResolvedValue({ error: null });
    const leaveSymposiumSpy = vi.fn().mockResolvedValue({ error: null });

    useFellowshipStore.setState({
      removeFellow: removeFellowSpy,
      respondToSymposiumInvite: respondSymposiumSpy,
      leaveSymposium: leaveSymposiumSpy,
      circles: [
        {
          id: 'c-accepted-fellow',
          requester_id: 'u2',
          requester_username: 'bronte',
          requester_display_name: 'Charlotte Brontë',
          recipient_id: 'u1',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'accepted',
          created_at: '',
          updated_at: '',
        },
        {
          id: 'c-outgoing',
          requester_id: 'u1',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u5',
          recipient_username: 'melville',
          recipient_display_name: 'Herman Melville',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
      symposiums: [
        {
          id: 'sym-incoming',
          book_id: 2701,
          book_title: '',
          host_id: 'u2',
          host_username: 'bronte',
          host_display_name: 'Charlotte Brontë',
          fellow_id: 'u1',
          fellow_username: 'jane_austen',
          fellow_display_name: 'Jane Austen',
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'sym-outgoing',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          host_id: 'u1',
          host_username: 'jane_austen',
          host_display_name: 'Jane Austen',
          fellow_id: 'u2',
          fellow_username: 'bronte',
          fellow_display_name: 'Charlotte Brontë',
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<AccountSymposiumSection userId="u1" />);

    // Switch to Reader Circle and trigger Symposium button + Remove button
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Symposium$/i }));
    expect(await screen.findByTestId('symposium-invite-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove @bronte from Reader Circle/i }));
    expect(removeFellowSpy).toHaveBeenCalledWith('c-accepted-fellow');

    // Switch to Invitations sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText('Sent Circle Request')).toBeInTheDocument();
    expect(screen.getByText('Incoming Symposium Pact')).toBeInTheDocument();
    expect(screen.getByText('Volume #2701')).toBeInTheDocument();
    expect(screen.getByText('Sent Symposium Pact')).toBeInTheDocument();

    // Cancel outgoing circle request
    fireEvent.click(screen.getByRole('button', { name: /Cancel Request/i }));
    expect(removeFellowSpy).toHaveBeenCalledWith('c-outgoing');

    // Accept and Decline incoming symposium pact
    fireEvent.click(screen.getByRole('button', { name: /Accept Pact/i }));
    expect(respondSymposiumSpy).toHaveBeenCalledWith('sym-incoming', 'accept');

    fireEvent.click(screen.getByRole('button', { name: /^Decline$/i }));
    expect(respondSymposiumSpy).toHaveBeenCalledWith('sym-incoming', 'decline');

    // Cancel outgoing symposium pact
    fireEvent.click(screen.getByRole('button', { name: /Cancel Pact/i }));
    expect(leaveSymposiumSpy).toHaveBeenCalledWith('sym-outgoing');

    // Switch back to Active Symposiums tab
    fireEvent.click(screen.getByRole('tab', { name: /Active Symposiums/i }));
    expect(screen.getByText('No Active Literary Symposiums')).toBeInTheDocument();
  });

  it('disables live invitation controls and enforces offline parity for uncached symposiums when offline', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    // 1342 is not downloaded, 84 is downloaded
    mockAccountOfflineIds = [84];

    useFellowshipStore.setState({
      symposiums: [
        {
          id: 's-uncached',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          host_id: 'u1',
          host_username: 'jane_austen',
          host_display_name: 'Jane Austen',
          fellow_id: 'u2',
          fellow_username: 'bronte',
          fellow_display_name: 'Charlotte Brontë',
          status: 'active',
          host_chapter: 1,
          host_progress: 10,
          fellow_chapter: 1,
          fellow_progress: 15,
          created_at: '',
          updated_at: '',
        },
        {
          id: 's-cached',
          book_id: 84,
          book_title: 'Frankenstein',
          host_id: 'u1',
          host_username: 'jane_austen',
          host_display_name: 'Jane Austen',
          fellow_id: 'u3',
          fellow_username: 'shelley',
          fellow_display_name: 'Mary Shelley',
          status: 'active',
          host_chapter: 2,
          host_progress: 25,
          fellow_chapter: 2,
          fellow_progress: 30,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'sym-incoming-offline',
          book_id: 2701,
          book_title: 'Moby Dick',
          host_id: 'u4',
          host_username: 'melville',
          host_display_name: 'Herman Melville',
          fellow_id: 'u1',
          fellow_username: 'jane_austen',
          fellow_display_name: 'Jane Austen',
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'sym-outgoing-offline',
          book_id: 11,
          book_title: "Alice's Adventures in Wonderland",
          host_id: 'u1',
          host_username: 'jane_austen',
          host_display_name: 'Jane Austen',
          fellow_id: 'u5',
          fellow_username: 'carroll',
          fellow_display_name: 'Lewis Carroll',
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        },
      ],
      circles: [
        {
          id: 'c-active-offline',
          requester_id: 'u1',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u2',
          recipient_username: 'bronte',
          recipient_display_name: 'Charlotte Brontë',
          status: 'accepted',
          created_at: '',
          updated_at: '',
        },
        {
          id: 'c-incoming-offline',
          requester_id: 'u3',
          requester_username: 'shelley',
          requester_display_name: 'Mary Shelley',
          recipient_id: 'u1',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
        {
          id: 'c-outgoing-offline',
          requester_id: 'u1',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u4',
          recipient_username: 'melville',
          recipient_display_name: 'Herman Melville',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
    });

    try {
      render(<AccountSymposiumSection userId="u1" />);

      // Active Symposiums sub-tab checks
      expect(screen.getByRole('button', { name: /New Symposium Pact/i })).toBeDisabled();

      // Uncached symposium (1342) shows Not Downloaded badge & disabled Unavailable Offline button
      expect(screen.getByTestId('symposium-offline-badge-1342')).toHaveTextContent('Not Downloaded');
      expect(screen.getByTestId('symposium-read-disabled-1342')).toBeDisabled();
      expect(screen.getByTestId('symposium-read-disabled-1342')).toHaveTextContent('Unavailable Offline');

      // Cached symposium (84) does NOT show Not Downloaded badge and has active Read link
      expect(screen.queryByTestId('symposium-offline-badge-84')).toBeNull();
      expect(screen.getByRole('link', { name: /^Read$/i })).toHaveAttribute('href', '/read/84');

      // Leave symposium buttons are disabled when offline
      const leaveButtons = screen.getAllByRole('button', { name: /Leave Symposium/i });
      leaveButtons.forEach((btn) => expect(btn).toBeDisabled());

      // Reader Circle sub-tab checks
      fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));
      expect(screen.getByLabelText(/Invite Fellow Scholar/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /Send Circle Invitation/i })).toBeDisabled();
      expect(screen.getByTestId('circle-invite-offline-hint')).toHaveTextContent(
        /Inviting Fellow Scholars requires an internet connection/i
      );
      expect(screen.getByRole('button', { name: /^Symposium$/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Remove @bronte from Reader Circle/i })).toBeDisabled();

      // Invitations sub-tab checks
      fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
      expect(screen.getByRole('button', { name: /Accept Fellow/i })).toBeDisabled();
      const declineButtons = screen.getAllByRole('button', { name: /^Decline$/i });
      expect(declineButtons).toHaveLength(2);
      declineButtons.forEach((btn) => expect(btn).toBeDisabled());
      expect(screen.getByRole('button', { name: /Cancel Request/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Accept Pact/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Cancel Pact/i })).toBeDisabled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });
});

