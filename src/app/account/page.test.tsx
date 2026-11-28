import React from 'react';
import { render, screen, fireEvent, waitFor, within, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AccountPage from './page';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { cancelPendingPreferencesCloudSync } from '@/lib/preferences-sync';
import { ROUTES } from '@/config/routes';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/account',
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/components/presentation/Footer', () => ({
  Footer: () => (
    <footer data-testid="footer-mock">
      <a aria-label="Bookarium GitHub repository" href="https://github.com">GitHub</a>
    </footer>
  ),
}));

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    useThemeStore.setState({ theme: 'light' });
    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: false,
      isPasswordRecovery: false,
      verifyPasswordRecoverySession: vi.fn().mockResolvedValue(false),
      listActiveSessions: vi.fn().mockResolvedValue({ sessions: [], error: null }),
      revokeSession: vi.fn().mockResolvedValue({ error: null }),
      signOutOtherDevices: vi.fn().mockResolvedValue({ error: null }),
      clearGuestDeviceData: vi.fn().mockResolvedValue(undefined),
    });
    useFellowshipStore.setState({ fetchFellowshipData: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(async () => {
    cleanup();
    cancelPendingPreferencesCloudSync();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('renders guest prompt when unauthenticated and handles scroll to top via AccountBottomDock', () => {
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: false,
    });

    render(<AccountPage />);

    expect(screen.getByText('Guest Reader')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In \/ Sign Up/i })).toBeInTheDocument();
    expect(screen.queryByText('Back to Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Bookarium Account')).not.toBeInTheDocument();

    // Guest dock hidden at scrollY = 0, revealed when scrolled down
    expect(screen.queryByRole('button', { name: /Scroll to top/i })).not.toBeInTheDocument();
    window.scrollY = 400;
    fireEvent.scroll(window);
    const scrollTopBtn = screen.getByRole('button', { name: /Scroll to top/i });
    expect(scrollTopBtn).toBeInTheDocument();
    fireEvent.click(scrollTopBtn);
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('renders Scholar Profile by default with serene identity ribbon, streak badge jump, and un-tabbed Habits & Accolades', async () => {
    useAnnotationStore.setState({
      annotations: [
        {
          id: 'a1',
          bookId: 1342,
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Passage in account test',
          color: 'yellow',
          createdAt: '2026-01-01T00:00:00Z',
        } as any,
      ],
    });

    const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test', created_at: '2026-01-01T00:00:00Z' } as any,
      profile: { id: 'u1', display_name: 'Jane Austen', is_public: false } as any,
      isLoading: false,
      updateProfile: mockUpdateProfile,
    });

    useBookshelfStore.setState({
      savedBooks: [{ id: 1, title: 'Pride and Prejudice', authors: [], formats: {} } as any],
      favoriteBookIds: [1, 2, 3],
      cloudBookshelves: [
        { id: 's0', user_id: 'u1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 's1', user_id: 'u1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
        { id: 's2', user_id: 'u1', name: 'Gothic Tales', is_default: false, created_at: '' , updated_at: '' },
      ],
    });

    render(<AccountPage />);

    // Serene top identity ribbon (no Edit Name toggle on top card, no email leaked on ribbon)
    const ribbon = screen.getByTestId('scholar-identity-ribbon');
    expect(within(ribbon).getByRole('heading', { level: 1, name: 'Jane Austen' })).toBeInTheDocument();
    expect(within(ribbon).queryByRole('button', { name: /Edit display name/i })).not.toBeInTheDocument();
    expect(within(ribbon).queryByText('austen@bookarium.test')).not.toBeInTheDocument();
    expect(screen.queryByText('Back to Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Bookarium Account')).not.toBeInTheDocument();

    // Display Name edit now lives inside default Scholar Profile card alongside read-only private email
    const profilePanel = document.getElementById('account-tabpanel-profile')!;
    expect(profilePanel).not.toHaveClass('hidden');
    expect(
      within(profilePanel).getByTestId('scholar-private-email-indicator')
    ).toHaveTextContent('austen@bookarium.test');
    fireEvent.click(within(profilePanel).getByRole('button', { name: /^edit$/i }));
    expect(within(profilePanel).getByLabelText(/Account Email \(Private\)/i)).toHaveValue(
      'austen@bookarium.test'
    );
    const input = within(profilePanel).getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Jane Austen CBE' } });
    fireEvent.click(within(profilePanel).getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'Jane Austen CBE' })
      );
    });

    // Verify duplicate collection stat strip is absent from top ribbon while keeping streak pill
    expect(screen.queryByTestId('identity-ribbon-stat-strip')).not.toBeInTheDocument();
    expect(within(ribbon).queryByRole('link', { name: /Shelved/i })).not.toBeInTheDocument();
    expect(within(ribbon).queryByRole('link', { name: /Favorites/i })).not.toBeInTheDocument();

    // Clicking the Streak badge switches directly to Habits & Accolades (un-tabbed)
    const streakPillBtn = screen.getByRole('button', { name: /🔥 \d+d Streak/i });
    fireEvent.click(streakPillBtn);
    expect(document.getElementById('account-tabpanel-habits')).not.toHaveClass('hidden');
    expect(screen.getByText('Reading Habits & Challenges')).toBeInTheDocument();
    expect(screen.getByText('Ex-Libris Bookplates & Accolades')).toBeInTheDocument();
    expect(screen.getByTestId('account-accolades-card')).toBeInTheDocument();

    // Filter accolades via AccountBottomDock category popover
    fireEvent.click(screen.getByTestId('account-dock-filter-btn'));
    fireEvent.click(screen.getByTestId('account-dock-category-streaks'));
    expect(screen.getByTestId('accolades-open-filter-btn')).toHaveTextContent('Streaks');
    expect(screen.getByText('Seven-Day Sage')).toBeInTheDocument();
    expect(screen.queryByText('The Marathon Reader')).not.toBeInTheDocument();

    act(() => {
      useAnnotationStore.setState({ annotations: [] });
    });
  }, 15000);

  it('renders 4 segmented tabs led by Scholar Profile with swipe guard, tablet md:inline labels, and tab switching', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    // Check tablist exists with data-no-swipe="true" and single-row container
    const tablist = screen.getByRole('tablist', { name: /Account sections/i });
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveAttribute('data-no-swipe', 'true');
    expect(tablist).toHaveClass('relative', 'grid', 'grid-cols-4', 'w-full', 'bg-muted/55', 'rounded-2xl');

    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    const profileTab = within(tablist).getByRole('tab', { name: /Scholar Profile/i });
    const habitsTab = within(tablist).getByRole('tab', { name: /Habits & Accolades/i });
    const preferencesTab = within(tablist).getByRole('tab', { name: /Preferences/i });
    const securityTab = within(tablist).getByRole('tab', { name: /Security/i });

    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(habitsTab).toHaveAttribute('aria-selected', 'false');
    expect(preferencesTab).toHaveAttribute('aria-selected', 'false');
    expect(securityTab).toHaveAttribute('aria-selected', 'false');

    expect(profileTab).toHaveAttribute('title', 'Scholar Profile');
    expect(habitsTab).toHaveAttribute('title', 'Habits & Accolades');
    expect(preferencesTab).toHaveAttribute('title', 'Preferences');
    expect(securityTab).toHaveAttribute('title', 'Security');

    // Locked equal-width padding & stacked mobile labels prevent active-tab shifting across screens
    expect(profileTab).toHaveClass('w-full', 'min-w-0', 'px-1.5', 'sm:px-2.5', 'md:px-3', 'font-semibold', 'whitespace-nowrap', 'border', 'bg-card', 'border-primary');
    expect(habitsTab).toHaveClass('w-full', 'min-w-0', 'px-1.5', 'sm:px-2.5', 'md:px-3', 'font-semibold', 'whitespace-nowrap', 'border', 'border-transparent');
    expect(preferencesTab).toHaveClass('w-full', 'min-w-0', 'px-1.5', 'sm:px-2.5', 'md:px-3', 'font-semibold', 'whitespace-nowrap', 'border', 'border-transparent');
    expect(securityTab).toHaveClass('w-full', 'min-w-0', 'px-1.5', 'sm:px-2.5', 'md:px-3', 'font-semibold', 'whitespace-nowrap', 'border', 'border-transparent');

    // Pointy SVG border chevrons omitted cleanly on recessed track
    expect(tablist.querySelector('[data-scrub-chevron]')).toBeNull();

    expect(within(profileTab).getByText('Profile')).toHaveClass('md:hidden');
    expect(within(profileTab).getByText('Scholar Profile')).toHaveClass('hidden', 'md:inline');
    expect(within(habitsTab).getByText('Habits')).toHaveClass('md:hidden');
    expect(within(habitsTab).getByText('Habits & Accolades')).toHaveClass('hidden', 'md:inline');
    expect(within(preferencesTab).getByText('Prefs')).toHaveClass('md:hidden');
    expect(within(preferencesTab).getByText('Preferences')).toHaveClass('hidden', 'md:inline');
    expect(within(securityTab).getAllByText('Security')).toHaveLength(2);

    // Zero Tier-2 underline sub-tabs anywhere in Scholar Profile or Habits
    expect(document.getElementById('account-tabpanel-profile')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-habits')).toHaveClass('hidden');
    expect(screen.getAllByRole('tablist')).toHaveLength(1);

    // Switch to Habits & Accolades
    fireEvent.click(habitsTab);
    expect(habitsTab).toHaveAttribute('aria-selected', 'true');
    expect(habitsTab).toHaveClass('bg-card', 'border-primary');
    expect(profileTab).toHaveAttribute('aria-selected', 'false');
    expect(tablist.querySelector('[data-scrub-chevron]')).toBeNull();
    expect(document.getElementById('account-tabpanel-habits')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-profile')).toHaveClass('hidden');

    // Switch to Preferences
    fireEvent.click(preferencesTab);
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(preferencesTab).toHaveClass('bg-card', 'border-primary');
    expect(document.getElementById('account-tabpanel-preferences')).not.toHaveClass('hidden');

    // Switch to Security
    fireEvent.click(securityTab);
    expect(securityTab).toHaveAttribute('aria-selected', 'true');
    expect(securityTab).toHaveClass('bg-card', 'border-primary');
    expect(tablist.querySelector('[data-scrub-chevron]')).toBeNull();
    expect(document.getElementById('account-tabpanel-security')).not.toHaveClass('hidden');
    await waitFor(() => {
      expect(useAuthStore.getState().listActiveSessions).toHaveBeenCalled();
    });
  });

  it('glides GPU active tab capsule smoothly via translate3d when tab layout geometry is measurable', () => {
    const origLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
    const origTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    const origWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const origHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.id === 'account-tab-profile') return 6;
        if (this.id === 'account-tab-habits') return 220;
        return 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        return this.id.startsWith('account-tab-') ? 6 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.id === 'account-tab-profile') return 208;
        if (this.id === 'account-tab-habits') return 196;
        return 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.id.startsWith('account-tab-') ? 42 : 0;
      },
    });

    try {
      useAuthStore.setState({
        user: { id: 'u1', email: 'austen@bookarium.test' } as any,
        profile: { id: 'u1', display_name: 'Jane Austen' } as any,
        isLoading: false,
      });

      const { unmount } = render(<AccountPage />);

      const capsule = screen.getByTestId('account-tab-active-capsule');
      expect(capsule).toHaveClass('bg-card', 'border-primary', 'shadow-xs', 'rounded-xl');
      expect(capsule).toHaveStyle({
        transform: 'translate3d(6px, 6px, 0)',
        width: '208px',
        height: '42px',
      });

      fireEvent.click(screen.getByRole('tab', { name: /Habits & Accolades/i }));

      expect(screen.getByTestId('account-tab-active-capsule')).toHaveStyle({
        transform: 'translate3d(220px, 6px, 0)',
        width: '196px',
        height: '42px',
      });

      unmount();
    } finally {
      if (origLeft) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', origLeft);
      if (origTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', origTop);
      if (origWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origWidth);
      if (origHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origHeight);
    }
  });

  it('supports keyboard navigation across 4 tabs with ArrowRight and ArrowLeft', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    const tablist = screen.getByRole('tablist', { name: /Account sections/i });
    const profileTab = screen.getByRole('tab', { name: /Scholar Profile/i });
    const habitsTab = screen.getByRole('tab', { name: /Habits & Accolades/i });
    const securityTab = screen.getByRole('tab', { name: /Security/i });

    expect(profileTab).toHaveAttribute('aria-selected', 'true');

    // ArrowRight -> Habits & Accolades
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(habitsTab).toHaveAttribute('aria-selected', 'true');

    // ArrowLeft -> Scholar Profile
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');

    // ArrowLeft wraps around to Security
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(securityTab).toHaveAttribute('aria-selected', 'true');

    // Non-arrow key should be ignored
    fireEvent.keyDown(tablist, { key: 'Enter' });
    expect(securityTab).toHaveAttribute('aria-selected', 'true');

    // Touch isolation stops propagation and supports live touch-swipe tab scrubbing
    const touchEvent = new CustomEvent('touchstart', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(touchEvent, 'stopPropagation');
    tablist.dispatchEvent(touchEvent);
    expect(stopPropagationSpy).toHaveBeenCalled();

    vi.spyOn(habitsTab, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 200,
      width: 100,
      top: 0,
      bottom: 40,
      height: 40,
      x: 100,
      y: 0,
      toJSON: () => {},
    });
    fireEvent.touchStart(tablist, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchMove(tablist, { touches: [{ clientX: 150, clientY: 20 }] });
    fireEvent.touchEnd(tablist);
    expect(habitsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('initializes active tab from URL search parameters (?tab=preferences), maps ?tab=symposiums to Scholar Profile, and deletes tab param on profile return', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    mockSearchParams = new URLSearchParams('tab=preferences');

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    const { unmount } = render(<AccountPage />);

    const preferencesTab = screen.getByRole('tab', { name: /Preferences/i });
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    // Switch back to default Scholar Profile clears ?tab= from URL
    const profileTab = screen.getByRole('tab', { name: /Scholar Profile/i });
    fireEvent.click(profileTab);
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, '', expect.not.stringContaining('?tab='));
    unmount();

    // Legacy ?tab=symposiums resolves cleanly into Scholar Profile with Fellowships visible
    mockSearchParams = new URLSearchParams('tab=symposiums');
    render(<AccountPage />);
    expect(screen.getByRole('tab', { name: /Scholar Profile/i })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('account-symposium-section')).toBeInTheDocument();
    replaceStateSpy.mockRestore();
  });

  it('falls back to Scholar Profile tab when search param has invalid value', () => {
    mockSearchParams = new URLSearchParams('tab=invalid_tab_name');

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    const profileTab = screen.getByRole('tab', { name: /Scholar Profile/i });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
  });

  it('handles user preferences: atmosphere themes and catalog sticky scroll navigation', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      updateProfile: mockUpdateProfile,
    });

    render(<AccountPage />);

    // Switch to Preferences sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Preferences/i }));
    const preferencesPanel = document.getElementById('account-tabpanel-preferences')!;

    // Theme Switcher (single unified schedulePreferencesCloudSync write; no duplicate preferred_theme write)
    fireEvent.click(within(preferencesPanel).getByText('Sepia'));
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      preferences: expect.objectContaining({
        active: expect.objectContaining({
          theme: 'sepia',
          fontSize: expect.any(Number),
        }),
      }),
    });
    expect(mockUpdateProfile.mock.calls[0][0]).not.toHaveProperty('preferred_theme');
    expect(mockUpdateProfile.mock.calls[0][0]).not.toHaveProperty('font_size');

    // Sticky Scroll Navigation Setting
    expect(within(preferencesPanel).getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    fireEvent.click(within(preferencesPanel).getByText('Always Fixed'));
    expect(within(preferencesPanel).getByText('Always Fixed Active')).toBeInTheDocument();

    fireEvent.click(within(preferencesPanel).getByText('Smart Auto-Hide'));
    expect(within(preferencesPanel).getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    // Typography, Reading Flow, Column Width, Spoiler Shield, Save as My Default & Factory Reset
    fireEvent.click(within(preferencesPanel).getByText('Mono'));
    expect(useReaderStore.getState().fontFamily).toBe('mono');

    fireEvent.click(within(preferencesPanel).getByText('22px'));
    expect(useReaderStore.getState().fontSize).toBe(22);

    fireEvent.click(within(preferencesPanel).getByText('2.1x'));
    expect(useReaderStore.getState().lineHeight).toBe(2.1);

    fireEvent.click(within(preferencesPanel).getByText('75%'));
    expect(useReaderStore.getState().brightness).toBe(75);

    fireEvent.click(within(preferencesPanel).getByText('Scroll'));
    expect(useReaderStore.getState().readingMode).toBe('scroll');

    fireEvent.click(within(preferencesPanel).getByText('narrow'));
    expect(useReaderStore.getState().columnWidth).toBe('narrow');

    fireEvent.click(within(preferencesPanel).getByText('Show All Marginalia'));
    expect(useAnnotationStore.getState().spoilerShieldEnabled).toBe(false);

    // Exit Bookmark Prompt Toggle
    fireEvent.click(within(preferencesPanel).getByTestId('exit-bookmark-prompt-disabled-btn'));
    expect(usePreferencesStore.getState().exitBookmarkReminderEnabled).toBe(false);

    fireEvent.click(within(preferencesPanel).getByTestId('exit-bookmark-prompt-enabled-btn'));
    expect(usePreferencesStore.getState().exitBookmarkReminderEnabled).toBe(true);

    // Read-Aloud Studio sits directly below Typography in the un-tabbed Preferences Studio
    act(() => {
      usePreferencesStore.setState({ speechVoiceURI: 'en-GB-voice' });
    });
    fireEvent.click(within(preferencesPanel).getByText('1.25x'));
    expect(usePreferencesStore.getState().speechRate).toBe(1.25);

    const voiceSelect = within(preferencesPanel).getByLabelText('Preferred narrator voice');
    fireEvent.change(voiceSelect, { target: { value: '' } });
    expect(usePreferencesStore.getState().speechVoiceURI).toBeNull();

    fireEvent.click(within(preferencesPanel).getByText('Auto-Page Advance'));
    expect(usePreferencesStore.getState().speechAutoPageAdvance).toBe(false);

    fireEvent.click(within(preferencesPanel).getByText('Sentence Highlighting'));
    expect(usePreferencesStore.getState().speechHighlightEnabled).toBe(false);

    fireEvent.click(
      within(preferencesPanel).getByTitle('Reset speech settings to defaults')
    );
    fireEvent.click(screen.getByTestId('confirm-reset-speech-btn'));
    expect(usePreferencesStore.getState().speechRate).toBe(1);

    // Cycle theme directly from AccountBottomDock Preferences quick toggle
    fireEvent.click(screen.getByTestId('account-dock-cycle-theme-btn'));
    expect(useThemeStore.getState().theme).toBe('dark');

    // Save current as custom default preset
    fireEvent.click(within(preferencesPanel).getByTestId('save-custom-defaults-btn'));
    expect(within(preferencesPanel).getByTestId('preferences-preset-status')).toHaveTextContent(
      'My Default Active'
    );

    // Modify font size to 15px, then revert to My Default (22px)
    fireEvent.click(within(preferencesPanel).getByText('15px'));
    expect(useReaderStore.getState().fontSize).toBe(15);
    fireEvent.click(within(preferencesPanel).getByTestId('revert-custom-defaults-btn'));
    expect(useReaderStore.getState().fontSize).toBe(22);

    // Reset to Factory Defaults via confirmation modal
    fireEvent.click(within(preferencesPanel).getByTestId('reset-factory-defaults-btn'));
    fireEvent.click(screen.getByTestId('confirm-reset-factory-preferences-btn'));
    expect(useReaderStore.getState().fontSize).toBe(18);
    expect(useReaderStore.getState().fontFamily).toBe('serif');
    expect(useReaderStore.getState().readingMode).toBe('paginated');
    expect(useThemeStore.getState().theme).toBe('light');
  }, 15000);

  it('handles password security lifecycle: current password validation, mismatch validation, strong password generation, forgot-password reset link, and password update', async () => {
    const mockUpdatePassword = vi.fn().mockResolvedValue({ error: null });
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      isPasswordRecovery: false,
      updatePassword: mockUpdatePassword,
      resetPasswordForEmail: mockResetPasswordForEmail,
    });

    render(<AccountPage />);

    // Switch to Security sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Security/i }));
    const securityPanel = document.getElementById('account-tabpanel-security')!;

    const currentPwdInput = within(securityPanel).getByLabelText('Current Password') as HTMLInputElement;
    const newPwdInput = within(securityPanel).getByLabelText('New Password') as HTMLInputElement;
    const confirmPwdInput = within(securityPanel).getByLabelText('Confirm New Password') as HTMLInputElement;
    const updateBtn = within(securityPanel).getByRole('button', { name: /Update Password/i });

    // 1. Missing current password validation
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'password123' } });
    fireEvent.click(updateBtn);
    expect(
      within(securityPanel).getByText(
        'Please enter your current password, or send a reset link to your email.'
      )
    ).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();

    // 2. Mismatch validation
    fireEvent.change(currentPwdInput, { target: { value: 'oldPassword123' } });
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'different123' } });
    fireEvent.click(updateBtn);
    expect(within(securityPanel).getByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();

    // 3. Same password as current password validation
    fireEvent.change(newPwdInput, { target: { value: 'oldPassword123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'oldPassword123' } });
    fireEvent.click(updateBtn);
    expect(
      within(securityPanel).getByText('New password must be different from your current password.')
    ).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();

    // 4. Suggest Strong Password
    const suggestBtn = within(securityPanel).getByRole('button', { name: /Suggest Strong Password/i });
    expect(suggestBtn).toBeInTheDocument();
    fireEvent.click(suggestBtn);
    expect(newPwdInput.value.length).toBeGreaterThanOrEqual(12);
    expect(newPwdInput.value).toBe(confirmPwdInput.value);
    expect(within(securityPanel).getByText('Password strength:')).toBeInTheDocument();

    // 5. Forgot current password? Send reset link
    const sendResetBtn = within(securityPanel).getByRole('button', {
      name: /Forgot current password\? Send reset link/i,
    });
    fireEvent.click(sendResetBtn);
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('austen@bookarium.test');
      expect(within(securityPanel).getByTestId('password-reset-sent-banner')).toBeInTheDocument();
    });

    // 6. Valid re-authenticated update submission
    fireEvent.change(currentPwdInput, { target: { value: 'oldPassword123' } });
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'password123' } });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('password123', 'oldPassword123');
      expect(within(securityPanel).getByText('Password successfully updated')).toBeInTheDocument();
    });
  }, 15000);

  it('supports verified email recovery mode (?tab=security&recovery=true) without requiring current password', async () => {
    mockSearchParams = new URLSearchParams('tab=security&recovery=true');
    const mockUpdatePassword = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      isPasswordRecovery: true,
      updatePassword: mockUpdatePassword,
    });

    render(<AccountPage />);

    const securityPanel = document.getElementById('account-tabpanel-security')!;
    expect(within(securityPanel).getByTestId('password-recovery-banner')).toBeInTheDocument();
    expect(within(securityPanel).queryByLabelText('Current Password')).not.toBeInTheDocument();

    const newPwdInput = within(securityPanel).getByLabelText('New Password') as HTMLInputElement;
    const confirmPwdInput = within(securityPanel).getByLabelText('Confirm New Password') as HTMLInputElement;
    const updateBtn = within(securityPanel).getByRole('button', { name: /Update Password/i });

    fireEvent.change(newPwdInput, { target: { value: 'recoveredPass123!' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'recoveredPass123!' } });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('recoveredPass123!');
      expect(within(securityPanel).getByText('Password successfully updated')).toBeInTheDocument();
    });
  });

  it('handles account deletion modal lifecycle: opening, cancellation, submission, and confirmation dismissal', async () => {
    const mockRequestAccountDeletion = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      requestAccountDeletion: mockRequestAccountDeletion,
    });

    render(<AccountPage />);

    // Switch to Security sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Security/i }));
    const securityPanel = document.getElementById('account-tabpanel-security')!;

    expect(within(securityPanel).getByText(/Danger Zone: Delete Account/i)).toBeInTheDocument();

    // 1. Open and Cancel
    const deleteBtn = within(securityPanel).getByRole('button', { name: /Delete Account/i });
    fireEvent.click(deleteBtn);
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('Request Account Deletion')).toBeInTheDocument();
    expect(within(modal).getByText('Security Verification Required')).toBeInTheDocument();
    expect(within(modal).getByText(/For your security, deleting your account requires email confirmation/i)).toBeInTheDocument();

    const cancelBtn = within(modal).getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(mockRequestAccountDeletion).not.toHaveBeenCalled();
    expect(screen.queryByText('Security Verification Required')).not.toBeInTheDocument();

    // 2. Re-open and Submit
    fireEvent.click(deleteBtn);
    const reopenedModal = screen.getByRole('dialog');
    const sendLinkBtn = within(reopenedModal).getByRole('button', { name: /Send Deletion Link/i });
    fireEvent.click(sendLinkBtn);

    await waitFor(() => {
      expect(mockRequestAccountDeletion).toHaveBeenCalled();
      expect(within(reopenedModal).getByText('Verification Link Sent')).toBeInTheDocument();
      expect(within(reopenedModal).getByText(/We sent a secure deletion confirmation link to/i)).toBeInTheDocument();
    });

    // 3. Dismiss confirmation screen
    const closeBtn = within(reopenedModal).getByRole('button', { name: /^Close$/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Verification Link Sent')).not.toBeInTheDocument();
  });

  it('handles resending email verification on unverified account', async () => {
    const mockResendVerificationEmail = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'unverified@bookarium.test', email_confirmed_at: null } as any,
      profile: { id: 'u1', display_name: 'Unconfirmed Reader' } as any,
      isLoading: false,
      resendVerificationEmail: mockResendVerificationEmail,
    });

    render(<AccountPage />);

    expect(screen.getByText('Email Unverified')).toBeInTheDocument();
    const resendBtn = screen.getByRole('button', { name: 'Resend Verification Link' });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('unverified@bookarium.test');
      expect(screen.getByText(/Verification link sent! Check your inbox./i)).toBeInTheDocument();
    });
  });

  it('navigates back to bookmarks when swiping right on mobile', () => {
    vi.useFakeTimers();
    try {
      useAuthStore.setState({
        user: null,
        profile: null,
        isLoading: false,
      });

      render(<AccountPage />);
      const mainEl = screen.getByRole('main');

      // Swipe right: touchStart at 400, touchEnd at 500 (distance = 100px)
      fireEvent.touchStart(mainEl, {
        touches: [{ clientX: 400, clientY: 300 }],
        changedTouches: [{ clientX: 400, clientY: 300 }],
      });

      vi.advanceTimersByTime(100);

      fireEvent.touchEnd(mainEl, {
        touches: [],
        changedTouches: [{ clientX: 500, clientY: 300 }],
      });

      expect(mockPush).toHaveBeenCalledWith(`${ROUTES.VIEW('bookmarks')}?dir=backward`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders Scholar Profile section on default tab and handles saving public preferences', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'scholar@bookarium.test' } as any,
      profile: {
        id: 'u1',
        display_name: 'Scholar Reader',
        username: 'scholar_one',
        bio: 'Devoted scholar of classical literature.',
        is_public: true,
        show_streak: true,
        show_challenge: true,
        show_bookshelves: true,
      } as any,
      isLoading: false,
      updateProfile: mockUpdateProfile,
    });

    render(<AccountPage />);

    const profilePanel = document.getElementById('account-tabpanel-profile')!;
    expect(profilePanel).not.toHaveClass('hidden');
    expect(within(profilePanel).getByRole('region', { name: /scholar profile settings/i })).toBeInTheDocument();
    expect(within(profilePanel).getByTestId('scholar-username-indicator')).toHaveTextContent('scholar_one');
    expect(within(profilePanel).getByTestId('scholar-bio-indicator')).toHaveTextContent(
      'Devoted scholar of classical literature.'
    );

    fireEvent.click(within(profilePanel).getByRole('button', { name: /^edit$/i }));
    const submitBtn = within(profilePanel).getByRole('button', { name: /^save$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Scholar Reader',
          username: 'scholar_one',
          is_public: true,
        })
      );
    });
  });

  describe('Mobile Swipe & Directional Transitions', () => {
    it('applies animate-view-slide-left when ?dir=forward is present and settles on animationEnd', () => {
      mockSearchParams = new URLSearchParams('dir=forward');
      render(<AccountPage />);

      const mainEl = screen.getByRole('main');
      expect(mainEl).toHaveClass('animate-view-slide-left');

      fireEvent.animationEnd(mainEl);
      expect(mainEl).not.toHaveClass('animate-view-slide-left');
    });

    it('applies animate-view-slide-right when ?dir=backward is present and settles on animationEnd', () => {
      mockSearchParams = new URLSearchParams('dir=backward');
      render(<AccountPage />);

      const mainEl = screen.getByRole('main');
      expect(mainEl).toHaveClass('animate-view-slide-right');

      fireEvent.animationEnd(mainEl);
      expect(mainEl).not.toHaveClass('animate-view-slide-right');
    });

    it('swipes left on Account to wrap forward to Catalog with ?dir=forward', () => {
      vi.useFakeTimers();
      try {
        render(<AccountPage />);
        const mainEl = screen.getByRole('main');

        // Swipe left: touchStart at 450, touchEnd at 350 (|deltaX| = 100px)
        fireEvent.touchStart(mainEl, {
          touches: [{ clientX: 450, clientY: 300 }],
          changedTouches: [{ clientX: 450, clientY: 300 }],
        });

        vi.advanceTimersByTime(100);

        fireEvent.touchEnd(mainEl, {
          touches: [],
          changedTouches: [{ clientX: 350, clientY: 300 }],
        });

        expect(mockPush).toHaveBeenCalledWith(`${ROUTES.HOME}?dir=forward`);
      } finally {
        vi.useRealTimers();
      }
    });

    it('swipes right on Account to return backward to Bookmarks with ?dir=backward', () => {
      vi.useFakeTimers();
      try {
        render(<AccountPage />);
        const mainEl = screen.getByRole('main');

        // Swipe right: touchStart at 350, touchEnd at 450 (deltaX = +100px)
        fireEvent.touchStart(mainEl, {
          touches: [{ clientX: 350, clientY: 300 }],
          changedTouches: [{ clientX: 350, clientY: 300 }],
        });

        vi.advanceTimersByTime(100);

        fireEvent.touchEnd(mainEl, {
          touches: [],
          changedTouches: [{ clientX: 450, clientY: 300 }],
        });

        expect(mockPush).toHaveBeenCalledWith(`${ROUTES.VIEW('bookmarks')}?dir=backward`);
      } finally {
        vi.useRealTimers();
      }
    });

    it('enforces overflow-x-clip on root and main layout containers and solid border-primary on active Tier-1 tab', () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'austen@bookarium.test' } as any,
        profile: { id: 'u1', display_name: 'Jane Austen' } as any,
        isLoading: false,
      });
      render(<AccountPage />);

      const main = screen.getByRole('main');
      expect(main).toHaveClass('overflow-x-clip');

      const root = main.parentElement;
      expect(root).toHaveClass('overflow-x-clip');

      const activeProfileTab = screen.getByRole('tab', { name: /Scholar Profile/i });
      expect(activeProfileTab).toHaveClass('border-primary');
      expect(activeProfileTab).not.toHaveClass('border-primary/30');
    });

    it('covers guest modal trigger, Navbar navigation, and preview mode (?preview=true)', () => {
      const openAuthModalSpy = vi.fn();
      useAuthStore.setState({
        user: null,
        profile: null,
        isLoading: false,
        openAuthModal: openAuthModalSpy,
      });

      const { unmount } = render(<AccountPage />);
      fireEvent.click(screen.getByRole('button', { name: /Sign In \/ Sign Up/i }));
      expect(openAuthModalSpy).toHaveBeenCalledWith('sign_in');

      fireEvent.click(screen.getByRole('button', { name: /^Bookshelf$/i }));
      expect(mockPush).toHaveBeenCalledWith('/bookshelf');
      unmount();

      // Preview mode (?preview=true) when unauthenticated
      mockSearchParams = new URLSearchParams('preview=true');
      render(<AccountPage />);
      expect(screen.getAllByText('Scholar Reader').length).toBeGreaterThan(0);
    });

    it('covers sign out, completedBooksCount, and error/catch recovery across profile, password, and deletion actions', async () => {
      mockSearchParams = new URLSearchParams();

      useBookshelfStore.setState({
        bookStatuses: { 1342: 'finished', 84: 'currently_reading' },
      } as unknown as Partial<ReturnType<typeof useBookshelfStore.getState>>);
      useReaderStore.setState({
        readingProgress: { 84: 100, 2701: 45 },
      });
      useFellowshipStore.setState({
        circles: [
          {
            id: 'c-pend',
            requester_id: 'u2',
            requester_username: 'shelley',
            requester_display_name: 'Mary Shelley',
            recipient_id: 'u1',
            recipient_username: 'austen',
            recipient_display_name: 'Jane Austen',
            status: 'pending',
            created_at: '',
            updated_at: '',
          },
        ],
      });

      const updateProfileMock = vi
        .fn()
        .mockResolvedValueOnce({ error: { message: 'Profile save error' } })
        .mockRejectedValueOnce(new Error('Profile crash'));
      const resendVerificationMock = vi
        .fn()
        .mockResolvedValueOnce({ error: { message: 'Resend limit error' } })
        .mockRejectedValueOnce(new Error('Resend crash'));
      const updatePasswordMock = vi
        .fn()
        .mockResolvedValueOnce({ error: { message: 'Weak password error' } })
        .mockRejectedValueOnce(new Error('Password crash'));
      const requestDeletionMock = vi
        .fn()
        .mockResolvedValueOnce({ error: { message: 'Deletion service error' } })
        .mockRejectedValueOnce(new Error('Deletion crash'));
      const signOutMock = vi.fn().mockResolvedValue(undefined);

      useAuthStore.setState({
        user: { id: 'u1', email: 'austen@bookarium.test', email_confirmed_at: null } as any,
        profile: { id: 'u1', display_name: 'Jane Austen' } as any,
        isLoading: false,
        updateProfile: updateProfileMock,
        resendVerificationEmail: resendVerificationMock,
        updatePassword: updatePasswordMock,
        requestAccountDeletion: requestDeletionMock,
        signOut: signOutMock,
      });

      render(<AccountPage />);

      // Verify pending invite count pill surfaces cleanly on Scholar Profile tab and Bottom Dock
      expect(within(screen.getByRole('tab', { name: /Scholar Profile/i })).getByText('1')).toBeInTheDocument();
      expect(screen.getByTestId('account-dock-invites-badge')).toHaveTextContent('1');

      // Profile save error & catch via Scholar Profile form
      fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(await screen.findByText('Profile save error')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(
        await screen.findByText('Failed to update scholar profile. Please try again.')
      ).toBeInTheDocument();

      // Resend verification error & catch
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
      expect(await screen.findByText('Resend limit error')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Link' }));
      expect(
        await screen.findByText('Failed to resend verification email. Please try again later.')
      ).toBeInTheDocument();

      // Switch to Security tab so Security controls are visible
      fireEvent.click(screen.getByRole('tab', { name: /Security/i }));
      const securityPanel = document.getElementById('account-tabpanel-security')!;

      const currentPwdInput = within(securityPanel).getByLabelText('Current Password');
      const newPwdInput = within(securityPanel).getByLabelText('New Password');
      const confirmPwdInput = within(securityPanel).getByLabelText('Confirm New Password');
      const updatePwdBtn = within(securityPanel).getByRole('button', { name: /Update Password/i });

      // Short password (< 6 chars) validation
      fireEvent.change(currentPwdInput, { target: { value: 'oldpass123' } });
      fireEvent.change(newPwdInput, { target: { value: '123' } });
      fireEvent.change(confirmPwdInput, { target: { value: '123' } });
      fireEvent.click(updatePwdBtn);
      expect(
        within(securityPanel).getByText('Password must be at least 6 characters long.')
      ).toBeInTheDocument();

      // Toggle show/hide password
      fireEvent.click(within(securityPanel).getByRole('button', { name: /Show password/i }));
      expect(within(securityPanel).getByRole('button', { name: /Hide password/i })).toBeInTheDocument();

      // Update password error & catch
      fireEvent.change(newPwdInput, { target: { value: 'validpass123' } });
      fireEvent.change(confirmPwdInput, { target: { value: 'validpass123' } });
      fireEvent.click(updatePwdBtn);
      expect(await within(securityPanel).findByText('Weak password error')).toBeInTheDocument();

      fireEvent.click(updatePwdBtn);
      expect(
        await within(securityPanel).findByText(
          'An unexpected error occurred while updating your password.'
        )
      ).toBeInTheDocument();

      // Request account deletion error & catch
      fireEvent.click(within(securityPanel).getByRole('button', { name: /Delete Account/i }));
      const modal = screen.getByRole('dialog');
      fireEvent.click(within(modal).getByRole('button', { name: /Send Deletion Link/i }));
      expect(await within(modal).findByText('Deletion service error')).toBeInTheDocument();

      fireEvent.click(within(modal).getByRole('button', { name: /Send Deletion Link/i }));
      expect(
        await within(modal).findByText(
          'An unexpected error occurred while requesting account deletion.'
        )
      ).toBeInTheDocument();
      fireEvent.click(within(modal).getByRole('button', { name: /Cancel/i }));

      // Sign Out button in security panel and top-level identity ribbon require confirmation
      fireEvent.click(
        within(securityPanel).getByRole('button', { name: /Sign Out This Browser/i })
      );
      expect(signOutMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('confirm-sign-out-local-button'));
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(1);
        expect(signOutMock).toHaveBeenCalledWith('local');
        expect(mockPush).toHaveBeenCalledWith(ROUTES.HOME);
      });

      fireEvent.click(screen.getByTestId('identity-sign-out-button'));
      expect(signOutMock).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('confirm-identity-sign-out-button'));
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(2);
      });
    }, 15000);

    it('manages Active Device Sessions revocation, Sign Out Other Devices, and confirmed Sign Out All Devices on Security tab', async () => {
      const listActiveSessionsMock = vi.fn().mockResolvedValue({
        sessions: [
          {
            id: 'sess-cur',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
            ipAddress: '203.0.113.x',
            createdAt: '2026-11-14T09:00:00Z',
            updatedAt: '2026-11-14T10:00:00Z',
            refreshedAt: '2026-11-14T10:30:00Z',
            notAfter: null,
            isCurrent: true,
          },
          {
            id: 'sess-ipad',
            userAgent:
              'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
            ipAddress: '198.51.100.x',
            createdAt: '2026-11-13T08:00:00Z',
            updatedAt: '2026-11-13T08:00:00Z',
            refreshedAt: null,
            notAfter: null,
            isCurrent: false,
          },
        ],
        error: null,
      });
      const revokeSessionMock = vi.fn().mockResolvedValue({ error: null });
      const signOutOtherDevicesMock = vi.fn().mockResolvedValue({ error: null });
      const signOutMock = vi.fn().mockResolvedValue(undefined);

      useAuthStore.setState({
        user: { id: 'u1', email: 'austen@bookarium.test' } as any,
        profile: { id: 'u1', display_name: 'Jane Austen' } as any,
        isLoading: false,
        listActiveSessions: listActiveSessionsMock,
        revokeSession: revokeSessionMock,
        signOutOtherDevices: signOutOtherDevicesMock,
        signOut: signOutMock,
      });

      render(<AccountPage />);

      fireEvent.click(screen.getByRole('tab', { name: /Security/i }));
      const securityPanel = document.getElementById('account-tabpanel-security')!;

      expect(await within(securityPanel).findByText('Chrome on Windows')).toBeInTheDocument();
      expect(within(securityPanel).getByText('Safari on iPadOS')).toBeInTheDocument();
      expect(within(securityPanel).getByTestId('session-ip-sess-cur')).toHaveTextContent(
        'IP: 203.0.113.x'
      );

      // Revoke individual remote device (requires confirmation)
      fireEvent.click(
        within(securityPanel).getByRole('button', { name: /Revoke session on Safari on iPadOS/i })
      );
      expect(revokeSessionMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('confirm-revoke-session-button'));
      await waitFor(() => {
        expect(revokeSessionMock).toHaveBeenCalledWith('sess-ipad');
        expect(within(securityPanel).queryByText('Safari on iPadOS')).not.toBeInTheDocument();
      });

      // Refresh & test confirmed Sign Out Other Devices
      fireEvent.click(
        within(securityPanel).getByRole('button', { name: /Refresh active device sessions/i })
      );
      await waitFor(() => {
        expect(listActiveSessionsMock).toHaveBeenCalledTimes(2);
        expect(within(securityPanel).getByText('Safari on iPadOS')).toBeInTheDocument();
      });

      fireEvent.click(
        within(securityPanel).getByRole('button', { name: /Sign Out Other Devices/i })
      );
      expect(signOutOtherDevicesMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('confirm-sign-out-others-button'));
      await waitFor(() => {
        expect(signOutOtherDevicesMock).toHaveBeenCalledTimes(1);
        expect(within(securityPanel).getByTestId('sessions-success-banner')).toHaveTextContent(
          'Signed out from all other devices.'
        );
      });

      // Sign Out All Devices asks for confirmation before executing global sign-out
      fireEvent.click(
        within(securityPanel).getByRole('button', { name: /Sign Out All Devices/i })
      );
      const cancelDialog = screen.getByRole('dialog');
      fireEvent.click(within(cancelDialog).getByTestId('cancel-sign-out-all-button'));
      expect(signOutMock).not.toHaveBeenCalled();

      fireEvent.click(
        within(securityPanel).getByRole('button', { name: /Sign Out All Devices/i })
      );
      const confirmDialog = screen.getByRole('dialog');
      fireEvent.click(within(confirmDialog).getByTestId('confirm-sign-out-all-button'));
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledWith('global');
        expect(mockPush).toHaveBeenCalledWith(ROUTES.HOME);
      });
    }, 15000);

    it('renders offline banner and guest local workspace when offline as a guest, and authenticated offline banner when signed in', () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

      try {
        // 1. Guest Offline Mode
        useAuthStore.setState({
          user: null,
          profile: null,
          isLoading: false,
        });

        const { unmount } = render(<AccountPage />);
        expect(screen.getByTestId('account-offline-banner')).toHaveTextContent(
          /Offline Mode — Manage your local reading preferences, streaks, and accolades offline/i
        );
        expect(screen.getByRole('button', { name: /Sign In \/ Sign Up/i })).toBeDisabled();
        const guestWorkspace = screen.getByTestId('guest-offline-workspace');
        const guestSignInCard = screen.getByTestId('guest-signin-card');
        expect(guestWorkspace).toBeInTheDocument();
        expect(screen.getByText('Reading & Navigation Preferences')).toBeInTheDocument();
        expect(screen.queryByTestId('account-habits-card')).not.toBeInTheDocument();

        // Switch Guest Offline Workspace tab to Local Habits & Accolades via inline or bottom pill
        fireEvent.click(screen.getByRole('tab', { name: /Local Habits & Accolades/i }));
        expect(screen.getByTestId('account-habits-card')).toBeInTheDocument();
        expect(screen.getByTestId('account-accolades-card')).toBeInTheDocument();
        expect(
          guestWorkspace.compareDocumentPosition(guestSignInCard) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        unmount();

        // 2. Authenticated Offline Mode (defaults to Preferences tab when no ?tab= param is set)
        useAuthStore.setState({
          user: { id: 'u1', email: 'austen@bookarium.test' } as any,
          profile: { id: 'u1', display_name: 'Jane Austen' } as any,
          isLoading: false,
        });

        render(<AccountPage />);
        expect(screen.getByTestId('account-offline-banner')).toHaveTextContent(
          /Offline Mode — Changes to your preferences, habits, and profile are saved locally and will sync automatically when you reconnect/i
        );
        const preferencesTab = screen.getByRole('tab', { name: /Preferences/i });
        expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
        expect(document.getElementById('account-tabpanel-preferences')).not.toHaveClass('hidden');
      } finally {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
      }
    });

    it('automatically defaults to security tab in recovery mode when session verifies and tabParam is omitted (?recovery=true)', async () => {
      type StoreState = ReturnType<typeof useAuthStore.getState>;
      mockSearchParams = new URLSearchParams('recovery=true');
      const verifyMock = vi.fn(async () => {
        useAuthStore.setState({ isPasswordRecovery: true });
        return true;
      });
      useAuthStore.setState({
        user: {
          id: 'u1',
          email: 'austen@bookarium.test',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00.000Z',
        } as NonNullable<StoreState['user']>,
        profile: {
          id: 'u1',
          display_name: 'Jane Austen',
        } as NonNullable<StoreState['profile']>,
        isLoading: false,
        verifyPasswordRecoverySession: verifyMock,
      });
      await act(async () => {
        render(<AccountPage />);
      });

      await waitFor(() => {
        expect(verifyMock).toHaveBeenCalledTimes(1);
      });

      const securityTab = screen.getByRole('tab', { name: /Security/i });
      expect(securityTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('password-recovery-banner')).toBeInTheDocument();
      await waitFor(() => {
        expect(useAuthStore.getState().listActiveSessions).toHaveBeenCalled();
      });
    });

    it('strips spoofed or unverified ?recovery=true from URL and keeps Current Password required', async () => {
      type StoreState = ReturnType<typeof useAuthStore.getState>;
      const originalHref = window.location.href;
      mockSearchParams = new URLSearchParams('tab=security&recovery=true');
      window.location.href = 'http://localhost:3000/account?tab=security&recovery=true';
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const verifyMock = vi.fn().mockResolvedValue(false);
      const originalUpdatePassword = useAuthStore.getState().updatePassword;
      const updatePasswordSpy = vi.fn().mockResolvedValue({ error: null });

      useAuthStore.setState({
        user: {
          id: 'u1',
          email: 'austen@bookarium.test',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00.000Z',
        } as NonNullable<StoreState['user']>,
        profile: {
          id: 'u1',
          display_name: 'Jane Austen',
        } as NonNullable<StoreState['profile']>,
        isLoading: false,
        isPasswordRecovery: false,
        verifyPasswordRecoverySession: verifyMock,
        updatePassword: updatePasswordSpy,
      });

      try {
        await act(async () => {
          render(<AccountPage />);
        });

        await waitFor(() => {
          expect(verifyMock).toHaveBeenCalledTimes(1);
          expect(useAuthStore.getState().listActiveSessions).toHaveBeenCalled();
        });
        await waitFor(() => {
          expect(replaceStateSpy).toHaveBeenCalledWith(
            null,
            '',
            'http://localhost:3000/account?tab=security'
          );
        });
        expect(screen.queryByTestId('password-recovery-banner')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Current Password/i)).toBeInTheDocument();

        fireEvent.change(document.getElementById('new-password') as HTMLInputElement, {
          target: { value: 'StrongPass!99' },
        });
        fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
          target: { value: 'StrongPass!99' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

        expect(
          await screen.findByText(
            'Please enter your current password, or send a reset link to your email.'
          )
        ).toBeInTheDocument();
        expect(updatePasswordSpy).not.toHaveBeenCalled();
      } finally {
        useAuthStore.setState({ updatePassword: originalUpdatePassword });
        window.location.href = originalHref;
        replaceStateSpy.mockRestore();
      }
    });

    it('suppresses history.replaceState when tab scrubbing is active in DOM ([data-scrubbing="true"])', () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      document.body.setAttribute('data-scrubbing', 'true');
      useAuthStore.setState({
        user: { id: 'u1', email: 'austen@bookarium.test' } as any,
        profile: { id: 'u1', display_name: 'Jane Austen' } as any,
        isLoading: false,
      });
      try {
        render(<AccountPage />);
        const preferencesTab = screen.getByRole('tab', { name: /Preferences/i });
        fireEvent.click(preferencesTab);
        expect(replaceStateSpy).not.toHaveBeenCalled();
      } finally {
        document.body.removeAttribute('data-scrubbing');
        replaceStateSpy.mockRestore();
      }
    });

    it('handles generic collection view swipe navigation fallback from Account view', async () => {
      const swipeModule = await import('@/hooks/useMobileViewSwipe');
      let capturedOnViewChange: ((view: any) => void) | undefined;
      const swipeSpy = vi.spyOn(swipeModule, 'useMobileViewSwipe').mockImplementation((options) => {
        capturedOnViewChange = options.onViewChange;
        return {
          handleTouchStart: vi.fn(),
          handleTouchEnd: vi.fn(),
          handleTouchCancel: vi.fn(),
          lastSwipeDirection: null,
        };
      });

      render(<AccountPage />);
      expect(capturedOnViewChange).toBeDefined();

      capturedOnViewChange?.('bookshelf');
      expect(mockPush).toHaveBeenCalledWith(ROUTES.VIEW('bookshelf'));

      capturedOnViewChange?.('favorites');
      expect(mockPush).toHaveBeenCalledWith(ROUTES.VIEW('favorites'));

      swipeSpy.mockRestore();
    });

    it('renders Clear All Local Data controls for online and offline guests and invokes clearGuestDeviceData on confirm', async () => {
      const clearGuestMock = vi.fn().mockResolvedValue(undefined);
      useAuthStore.setState({
        user: null,
        profile: null,
        isLoading: false,
        clearGuestDeviceData: clearGuestMock,
      });

      const { rerender } = render(<AccountPage />);
      expect(screen.getByTestId('guest-local-data-card')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('guest-clear-local-data-btn'));
      expect(screen.getByTestId('guest-clear-local-data-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-guest-clear-local-data-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('guest-clear-local-data-modal')).not.toBeInTheDocument();
      });
      expect(clearGuestMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('guest-clear-local-data-btn'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-guest-clear-local-data-btn'));
        await Promise.resolve();
      });

      expect(clearGuestMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('guest-local-data-cleared-notice')).toHaveTextContent(
        /All local guest data, offline books, and device caches on this browser have been erased/i
      );

      // Signed-in users must not render the guest local data wipe card
      useAuthStore.setState({
        user: { id: 'u1', email: 'austen@bookarium.test' } as any,
        profile: { id: 'u1', display_name: 'Jane Austen' } as any,
        isLoading: false,
      });
      rerender(<AccountPage />);
      expect(screen.queryByTestId('guest-local-data-card')).not.toBeInTheDocument();
    });
  });
});

