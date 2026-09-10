import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountPage from './page';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
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
    const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Passage in account test',
      color: 'yellow',
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
        { id: 's2', user_id: 'u1', name: 'Gothic Tales', is_default: false, created_at: '', updated_at: '' },
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
    expect(mockUpdateProfile).toHaveBeenCalledWith({ display_name: 'Jane Austen CBE' });

    // Library Statistics
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    const shelvedLink = screen.getByRole('link', { name: /View Shelved Volumes in Bookshelf/i });
    expect(shelvedLink).toHaveAttribute('href', ROUTES.BOOKSHELF);
    expect(screen.getByText('Shelved Volumes')).toBeInTheDocument();

    const favoritesLink = screen.getByRole('link', { name: /View Favorite Titles in Favorites/i });
    expect(favoritesLink).toHaveAttribute('href', ROUTES.FAVORITES);
    expect(screen.getByText('Favorite Titles')).toBeInTheDocument();

    const customShelvesLink = screen.getByRole('link', { name: /View Custom Shelves in Bookshelf/i });
    expect(customShelvesLink).toHaveAttribute('href', ROUTES.BOOKSHELF);
    expect(within(customShelvesLink).getByText('Custom Shelves')).toBeInTheDocument();
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('2');
    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('1');

    // Accolades Showcase
    expect(screen.getByText('Ex-Libris Bookplates & Accolades')).toBeInTheDocument();
    expect(screen.getByTestId('account-accolades-card')).toBeInTheDocument();

    useAnnotationStore.getState().clearAllAnnotations();
  });

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

    const habitsTab = screen.getByRole('tab', { name: /Habits & Accolades/i });
    const profileTab = screen.getByRole('tab', { name: /Public Scholar/i });
    const preferencesTab = screen.getByRole('tab', { name: /Preferences/i });
    const securityTab = screen.getByRole('tab', { name: /Security/i });

    expect(habitsTab).toHaveAttribute('aria-selected', 'true');
    expect(profileTab).toHaveAttribute('aria-selected', 'false');
    expect(preferencesTab).toHaveAttribute('aria-selected', 'false');
    expect(securityTab).toHaveAttribute('aria-selected', 'false');

    // Verify title tooltips for mobile/desktop discovery
    expect(habitsTab).toHaveAttribute('title', 'Habits & Accolades');
    expect(profileTab).toHaveAttribute('title', 'Public Scholar');
    expect(preferencesTab).toHaveAttribute('title', 'Preferences');
    expect(securityTab).toHaveAttribute('title', 'Security');

    // Verify adaptive mobile classes: active tab expands with text, inactive tabs collapse to icons
    expect(habitsTab).toHaveClass('flex-1', 'min-w-0');
    expect(profileTab).toHaveClass('shrink-0');
    expect(preferencesTab).toHaveClass('shrink-0');
    expect(securityTab).toHaveClass('shrink-0');

    // Verify truncation and visibility contracts on the text labels
    const habitsLabel = habitsTab.querySelector('span');
    const profileLabel = profileTab.querySelector('span');
    expect(habitsLabel).toHaveClass('truncate', 'min-w-0', 'inline');
    expect(profileLabel).toHaveClass('truncate', 'min-w-0', 'hidden', 'sm:inline');

    // Tab panels
    expect(document.getElementById('account-tabpanel-habits')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-profile')).toHaveClass('hidden');

    // Switch to Public Scholar
    fireEvent.click(profileTab);
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(habitsTab).toHaveAttribute('aria-selected', 'false');
    expect(profileTab).toHaveClass('flex-1', 'min-w-0');
    expect(habitsTab).toHaveClass('shrink-0');
    expect(profileTab.querySelector('span')).toHaveClass('inline');
    expect(habitsTab.querySelector('span')).toHaveClass('hidden', 'sm:inline');
    expect(document.getElementById('account-tabpanel-profile')).not.toHaveClass('hidden');
    expect(document.getElementById('account-tabpanel-habits')).toHaveClass('hidden');

    // Switch to Preferences
    fireEvent.click(preferencesTab);
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(preferencesTab).toHaveClass('flex-1', 'min-w-0');
    expect(profileTab).toHaveClass('shrink-0');
    expect(document.getElementById('account-tabpanel-preferences')).not.toHaveClass('hidden');

    // Switch to Security
    fireEvent.click(securityTab);
    expect(securityTab).toHaveAttribute('aria-selected', 'true');
    expect(securityTab).toHaveClass('flex-1', 'min-w-0');
    expect(preferencesTab).toHaveClass('shrink-0');
    expect(document.getElementById('account-tabpanel-security')).not.toHaveClass('hidden');
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

    // Touch isolation stops propagation
    const touchEvent = new CustomEvent('touchstart', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(touchEvent, 'stopPropagation');
    tablist.dispatchEvent(touchEvent);
    expect(stopPropagationSpy).toHaveBeenCalled();
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

    // Theme Switcher
    const sepiaBtn = screen.getByRole('button', { name: /Sepia/i });
    fireEvent.click(sepiaBtn);
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(mockUpdateProfile).toHaveBeenCalledWith({ preferred_theme: 'sepia' });

    // Sticky Scroll Navigation Setting
    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    const alwaysFixedBtn = screen.getByRole('button', { name: /Always Fixed/i });
    fireEvent.click(alwaysFixedBtn);
    expect(screen.getByText('Always Fixed Active')).toBeInTheDocument();

    const smartAutoHideBtn = screen.getByRole('button', { name: /Smart Auto-Hide/i });
    fireEvent.click(smartAutoHideBtn);
    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();
  });

  it('handles password security lifecycle: mismatch validation, strong password generation, and password update', async () => {
    const mockUpdatePassword = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      updatePassword: mockUpdatePassword,
    });

    render(<AccountPage />);

    // Switch to Security sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Security/i }));

    const newPwdInput = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPwdInput = screen.getByLabelText('Confirm New Password') as HTMLInputElement;
    const updateBtn = screen.getByRole('button', { name: /Update Password/i });

    // 1. Mismatch validation
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'different123' } });
    fireEvent.click(updateBtn);
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();

    // 2. Suggest Strong Password
    const suggestBtn = screen.getByRole('button', { name: /Suggest Strong Password/i });
    expect(suggestBtn).toBeInTheDocument();
    fireEvent.click(suggestBtn);
    expect(newPwdInput.value.length).toBeGreaterThanOrEqual(12);
    expect(newPwdInput.value).toBe(confirmPwdInput.value);
    expect(screen.getByText('Password strength:')).toBeInTheDocument();

    // 3. Valid update submission
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'password123' } });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('password123');
      expect(screen.getByText('Password successfully updated')).toBeInTheDocument();
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

    expect(screen.getByText(/Danger Zone: Delete Account/i)).toBeInTheDocument();

    // 1. Open and Cancel
    const deleteBtn = screen.getByRole('button', { name: /Delete Account/i });
    fireEvent.click(deleteBtn);
    expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
    expect(screen.getByText('Security Verification Required')).toBeInTheDocument();
    expect(screen.getByText(/For your security, deleting your account requires email confirmation/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(mockRequestAccountDeletion).not.toHaveBeenCalled();
    expect(screen.queryByText('Security Verification Required')).not.toBeInTheDocument();

    // 2. Re-open and Submit
    fireEvent.click(deleteBtn);
    const sendLinkBtn = screen.getByRole('button', { name: /Send Deletion Link/i });
    fireEvent.click(sendLinkBtn);

    await waitFor(() => {
      expect(mockRequestAccountDeletion).toHaveBeenCalled();
      expect(screen.getByText('Verification Link Sent')).toBeInTheDocument();
      expect(screen.getByText(/We sent a secure deletion confirmation link to/i)).toBeInTheDocument();
    });

    // 3. Dismiss confirmation screen
    const closeBtn = screen.getByRole('button', { name: /^Close$/i });
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

      expect(mockPush).toHaveBeenCalledWith(ROUTES.VIEW('bookmarks'));
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

    expect(screen.getByRole('region', { name: /public scholar profile settings/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('scholar_one')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Devoted scholar of classical literature.')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /save public settings/i });
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
});

