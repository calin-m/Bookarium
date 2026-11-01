import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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
    useAuthStore.setState({ isPasswordRecovery: false });
    useFellowshipStore.setState({ fetchFellowshipData: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    cancelPendingPreferencesCloudSync();
  });

  it('renders guest prompt when unauthenticated and handles scroll to top', () => {
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

    // Scroll to top behavior
    expect(screen.queryByRole('button', { name: /Back to top/i })).not.toBeInTheDocument();
    window.scrollY = 400;
    fireEvent.scroll(window);
    const backToTopBtn = screen.getByRole('button', { name: /Back to top/i });
    expect(backToTopBtn).toBeInTheDocument();
    fireEvent.click(backToTopBtn);
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('renders authenticated dashboard with profile identity, library statistics, and accolades', async () => {
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
      profile: { id: 'u1', display_name: 'Jane Austen' } as any,
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

    // Profile Identity
    expect(screen.getAllByText('Jane Austen').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('austen@bookarium.test').length).toBeGreaterThanOrEqual(1);

    // Display Name edit
    const input = screen.getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Jane Austen CBE' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ display_name: 'Jane Austen CBE' });
    });

    // Verify Collection stats in Slim Scholar Identity Ribbon
    const statStrip = screen.getByTestId('identity-ribbon-stat-strip');
    const shelvedLink = within(statStrip).getByRole('link', { name: /1 Shelved/i });
    expect(shelvedLink).toHaveAttribute('href', ROUTES.BOOKSHELF);

    const favoritesLink = within(statStrip).getByRole('link', { name: /3 Favorites/i });
    expect(favoritesLink).toHaveAttribute('href', ROUTES.FAVORITES);

    const notesLink = within(statStrip).getByRole('link', { name: /1 Notes/i });
    expect(notesLink).toHaveAttribute('href', ROUTES.NOTEBOOK);

    const shelvesLink = within(statStrip).getByRole('link', { name: /2 Shelves/i });
    expect(shelvesLink).toHaveAttribute('href', ROUTES.BOOKSHELF);

    // Switch to Accolades Compendium sub-tab and verify Accolades Showcase
    fireEvent.click(screen.getByRole('tab', { name: /Accolades Compendium/i }));
    expect(screen.getByText('Ex-Libris Bookplates & Accolades')).toBeInTheDocument();
    expect(screen.getByTestId('account-accolades-card')).toBeInTheDocument();

    // Clicking the Streak badge in AccountIdentityCard switches back to Habits -> Streaks & Challenge
    const streakPillBtn = screen.getByRole('button', { name: /🔥 \d+d Streak/i });
    fireEvent.click(streakPillBtn);
    expect(document.getElementById('habits-subpanel-streaks')).not.toHaveClass('hidden');

    act(() => {
      useAnnotationStore.setState({ annotations: [] });
    });
  }, 15000);

  it('renders segmented sub-tabs navigation and switches active tabs', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    // Check tablist exists with accessible label and single-row container
    const tablist = screen.getByRole('tablist', { name: /Account sections/i });
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveClass('flex', 'w-full');

    const habitsTab = within(tablist).getByRole('tab', { name: /Habits & Accolades/i });
    const profileTab = within(tablist).getByRole('tab', { name: /Public Scholar/i });
    const symposiumsTab = within(tablist).getByRole('tab', { name: /Symposiums & Circle/i });
    const preferencesTab = within(tablist).getByRole('tab', { name: /Preferences/i });
    const securityTab = within(tablist).getByRole('tab', { name: /Security/i });

    expect(habitsTab).toHaveAttribute('aria-selected', 'true');
    expect(profileTab).toHaveAttribute('aria-selected', 'false');
    expect(symposiumsTab).toHaveAttribute('aria-selected', 'false');
    expect(preferencesTab).toHaveAttribute('aria-selected', 'false');
    expect(securityTab).toHaveAttribute('aria-selected', 'false');

    // Verify title tooltips for mobile/desktop discovery
    expect(habitsTab).toHaveAttribute('title', 'Habits & Accolades');
    expect(profileTab).toHaveAttribute('title', 'Public Scholar');
    expect(symposiumsTab).toHaveAttribute('title', 'Symposiums & Circle');
    expect(preferencesTab).toHaveAttribute('title', 'Preferences');
    expect(securityTab).toHaveAttribute('title', 'Security');

    // Verify adaptive mobile classes: active tab expands with text, inactive tabs collapse to icons
    expect(habitsTab).toHaveClass('flex-[1.8]', 'font-semibold', 'whitespace-nowrap', 'border');
    expect(profileTab).toHaveClass('flex-[1.15]', 'font-semibold', 'whitespace-nowrap', 'border');
    expect(symposiumsTab).toHaveClass('flex-1', 'font-semibold', 'whitespace-nowrap', 'border');
    expect(preferencesTab).toHaveClass('shrink-0', 'font-semibold', 'whitespace-nowrap', 'border');
    expect(securityTab).toHaveClass('shrink-0', 'font-semibold', 'whitespace-nowrap', 'border');

    // Verify persistent outward border arrows on the active tab (first tab has right arrow only)
    expect(habitsTab.querySelector('[data-scrub-chevron="left"]')).toBeNull();
    expect(habitsTab.querySelector('[data-scrub-chevron="right"]')).not.toBeNull();
    expect(profileTab.querySelector('[data-scrub-chevron="left"]')).toBeNull();
    expect(profileTab.querySelector('[data-scrub-chevron="right"]')).toBeNull();

    // Verify distance-graded accordion truncation and visibility contracts on the text labels
    const habitsLabel = habitsTab.querySelector('span');
    const profileLabel = profileTab.querySelector('span');
    const symposiumsLabel = symposiumsTab.querySelector('span');
    const preferencesLabel = preferencesTab.querySelector('span');
    expect(habitsLabel).toHaveClass('min-w-0', 'inline-block', 'max-w-[220px]', 'opacity-100');
    expect(profileLabel).toHaveClass('min-w-0', 'inline-block', 'max-w-[88px]', 'opacity-85', 'lg:inline');
    expect(symposiumsLabel).toHaveClass('min-w-0', 'inline-block', 'max-w-[44px]', 'opacity-65', 'lg:inline');
    expect(preferencesLabel).toHaveClass('min-w-0', 'inline-block', 'max-w-0', 'opacity-0', 'lg:inline');

    // Verify Tier-2 Sub-Tabs inside Habits & Accolades (2 tabs: Streaks & Challenge, Accolades Compendium)
    const habitsSubTablist = screen.getByRole('tablist', { name: /Habits and library sub-sections/i });
    expect(habitsSubTablist).toHaveClass('flex', 'items-center', 'overflow-x-auto');

    const streaksSubTab = within(habitsSubTablist).getByRole('tab', { name: /Streaks & Challenge/i });
    const accoladesSubTab = within(habitsSubTablist).getByRole('tab', { name: /Accolades Compendium/i });
    expect(within(habitsSubTablist).queryByRole('tab', { name: /Library Breakdown/i })).not.toBeInTheDocument();

    expect(streaksSubTab).toHaveClass('border-b-2', 'whitespace-nowrap', 'shrink-0');
    expect(accoladesSubTab).toHaveClass('border-b-2', 'whitespace-nowrap', 'shrink-0');

    // Verify fit-first 2-tab sub-bar label contract (both labels fit and stay inline across all viewports)
    expect(within(streaksSubTab).getByText('Streaks & Challenge')).toHaveClass('inline');
    expect(within(accoladesSubTab).getByText('Accolades Compendium')).toHaveClass('inline');

    expect(document.getElementById('habits-subpanel-streaks')).not.toHaveClass('hidden');
    expect(document.getElementById('habits-subpanel-streaks')).not.toHaveAttribute('hidden');
    expect(document.getElementById('habits-subpanel-accolades')).toHaveClass('hidden');
    expect(document.getElementById('habits-subpanel-accolades')).toHaveAttribute('hidden');
    fireEvent.click(accoladesSubTab);
    expect(within(accoladesSubTab).getByText('Accolades Compendium')).toHaveClass('inline');
    expect(within(streaksSubTab).getByText('Streaks & Challenge')).toHaveClass('inline');
    expect(document.getElementById('habits-subpanel-accolades')).not.toHaveClass('hidden');
    expect(document.getElementById('habits-subpanel-accolades')).not.toHaveAttribute('hidden');

    // Tab panels
    expect(document.getElementById('account-tabpanel-habits')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-habits')).not.toHaveAttribute('hidden');
    expect(document.getElementById('account-tabpanel-profile')).toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-profile')).toHaveAttribute('hidden');

    // Switch to Public Scholar
    fireEvent.click(profileTab);
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(habitsTab).toHaveAttribute('aria-selected', 'false');
    expect(profileTab).toHaveClass('flex-[1.8]', 'justify-center');
    expect(habitsTab).toHaveClass('flex-[1.15]', 'justify-center');
    expect(profileTab.querySelector('[data-scrub-chevron="left"]')).not.toBeNull();
    expect(profileTab.querySelector('[data-scrub-chevron="right"]')).not.toBeNull();
    expect(habitsTab.querySelector('[data-scrub-chevron="right"]')).toBeNull();
    expect(profileTab.querySelector('span')).toHaveClass('inline-block', 'max-w-[220px]', 'opacity-100');
    expect(habitsTab.querySelector('span')).toHaveClass('inline-block', 'max-w-[88px]', 'opacity-85', 'lg:inline');
    expect(document.getElementById('account-tabpanel-profile')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-profile')).not.toHaveAttribute('hidden');
    expect(document.getElementById('account-tabpanel-habits')).toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-habits')).toHaveAttribute('hidden');

    // Switch to Symposiums & Circle
    fireEvent.click(symposiumsTab);
    expect(symposiumsTab).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('account-tabpanel-symposiums')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-symposiums')).not.toHaveAttribute('hidden');

    // Switch to Preferences
    fireEvent.click(preferencesTab);
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(preferencesTab).toHaveClass('flex-[1.8]', 'justify-center');
    expect(profileTab).toHaveClass('justify-center');
    expect(document.getElementById('account-tabpanel-preferences')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-preferences')).not.toHaveAttribute('hidden');

    // Switch to Security
    fireEvent.click(securityTab);
    expect(securityTab).toHaveAttribute('aria-selected', 'true');
    expect(securityTab).toHaveClass('flex-[1.8]', 'justify-center');
    expect(securityTab.querySelector('[data-scrub-chevron="left"]')).not.toBeNull();
    expect(securityTab.querySelector('[data-scrub-chevron="right"]')).toBeNull();
    expect(preferencesTab).toHaveClass('flex-[1.15]', 'justify-center');
    expect(document.getElementById('account-tabpanel-security')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-security')).not.toHaveAttribute('hidden');
  });

  it('supports keyboard navigation across sub-tabs with ArrowRight and ArrowLeft', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    const tablist = screen.getByRole('tablist', { name: /Account sections/i });
    const habitsTab = screen.getByRole('tab', { name: /Habits & Accolades/i });
    const profileTab = screen.getByRole('tab', { name: /Public Scholar/i });
    const securityTab = screen.getByRole('tab', { name: /Security/i });

    expect(habitsTab).toHaveAttribute('aria-selected', 'true');

    // ArrowRight -> Public Scholar
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');

    // ArrowLeft -> Habits & Accolades
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(habitsTab).toHaveAttribute('aria-selected', 'true');

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

    vi.spyOn(profileTab, 'getBoundingClientRect').mockReturnValue({
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
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
  });

  it('initializes active tab from URL search parameters (?tab=preferences) and handles tab delete when switching back to habits', () => {
    mockSearchParams = new URLSearchParams('tab=preferences');

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    const preferencesTab = screen.getByRole('tab', { name: /Preferences/i });
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    // Switch back to habits
    const habitsTab = screen.getByRole('tab', { name: /Habits & Accolades/i });
    fireEvent.click(habitsTab);
    expect(habitsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to habits tab when search param has invalid value', () => {
    mockSearchParams = new URLSearchParams('tab=invalid_tab_name');

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<AccountPage />);

    const habitsTab = screen.getByRole('tab', { name: /Habits & Accolades/i });
    expect(habitsTab).toHaveAttribute('aria-selected', 'true');
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

    // Theme Switcher
    fireEvent.click(within(preferencesPanel).getByText('Sepia'));
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(mockUpdateProfile).toHaveBeenCalledWith({ preferred_theme: 'sepia' });

    // Sticky Scroll Navigation Setting
    expect(within(preferencesPanel).getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    fireEvent.click(within(preferencesPanel).getByText('Always Fixed'));
    expect(within(preferencesPanel).getByText('Always Fixed Active')).toBeInTheDocument();

    fireEvent.click(within(preferencesPanel).getByText('Smart Auto-Hide'));
    expect(within(preferencesPanel).getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    // Typography, Reading Flow, Column Width, Spoiler Shield, Save as My Default & Factory Reset
    fireEvent.click(within(preferencesPanel).getByText('Mono'));
    expect(useReaderStore.getState().fontFamily).toBe('mono');

    fireEvent.click(within(preferencesPanel).getByText('24px'));
    expect(useReaderStore.getState().fontSize).toBe(24);

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

    // Switch to Audio & Read Aloud sub-tab inside Preferences and exercise speech callbacks
    act(() => {
      usePreferencesStore.setState({ speechVoiceURI: 'en-GB-voice' });
    });
    fireEvent.click(within(preferencesPanel).getByTitle('Read-Aloud Studio'));
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

    fireEvent.click(within(preferencesPanel).getByTitle('Appearance & Scroll'));

    // Save current as custom default preset
    fireEvent.click(within(preferencesPanel).getByTestId('save-custom-defaults-btn'));
    expect(within(preferencesPanel).getByTestId('preferences-preset-status')).toHaveTextContent(
      'My Default Active'
    );

    // Modify font size to 14px, then revert to My Default (24px)
    fireEvent.click(within(preferencesPanel).getByText('14px'));
    expect(useReaderStore.getState().fontSize).toBe(14);
    fireEvent.click(within(preferencesPanel).getByTestId('revert-custom-defaults-btn'));
    expect(useReaderStore.getState().fontSize).toBe(24);

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

  it('renders Public Scholar Profile section and handles saving public preferences', async () => {
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

    // Switch to Public Scholar sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Public Scholar/i }));
    const profilePanel = document.getElementById('account-tabpanel-profile')!;

    expect(within(profilePanel).getByRole('region', { name: /public scholar profile settings/i })).toBeInTheDocument();
    expect(within(profilePanel).getByDisplayValue('scholar_one')).toBeInTheDocument();
    expect(within(profilePanel).getByDisplayValue('Devoted scholar of classical literature.')).toBeInTheDocument();

    const submitBtn = within(profilePanel).getByRole('button', { name: /save public settings/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
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

    it('enforces overflow-x-clip on root and main layout containers and solid border-primary on active Tier-2 Habits sub-tabs', () => {
      render(<AccountPage />);

      const main = screen.getByRole('main');
      expect(main).toHaveClass('overflow-x-clip');

      const root = main.parentElement;
      expect(root).toHaveClass('overflow-x-clip');

      const streaksTab = screen.getByRole('tab', { name: 'Streaks & Challenge' });
      expect(streaksTab).toHaveClass('border-primary');
      expect(streaksTab).not.toHaveClass('border-primary/30');
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

      // Switch between Accolades Compendium and Streaks & Challenge sub-tabs
      fireEvent.click(screen.getByRole('tab', { name: /Accolades Compendium/i }));
      fireEvent.click(screen.getByRole('tab', { name: /Streaks & Challenge/i }));

      // Profile save error & catch (open quick profile editor first)
      fireEvent.click(screen.getByRole('button', { name: /Toggle quick display name editor/i }));
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
      expect(await screen.findByText('Profile save error')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
      expect(
        await screen.findByText('An unexpected error occurred while saving your profile.')
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

      // Sign Out button in security panel
      fireEvent.click(within(securityPanel).getByRole('button', { name: /Sign Out/i }));
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(1);
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
  });
});

