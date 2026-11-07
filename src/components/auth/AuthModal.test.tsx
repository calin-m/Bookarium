import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthModal } from './AuthModal';
import { useAuthStore } from '@/stores/useAuthStore';

const mockSignInWithPassword = vi.fn();
const mockSignUpWithPassword = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResendVerificationEmail = vi.fn();

vi.mock('@/stores/useAuthStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/useAuthStore')>();
  return {
    ...actual,
    useAuthStore: vi.fn(),
  };
});

const mockSyncWithCloud = vi.fn().mockResolvedValue(undefined);
vi.mock('@/stores/useBookshelfStore', () => ({
  useBookshelfStore: (selector?: (s: { syncWithCloud: typeof mockSyncWithCloud }) => unknown) => {
    const state = {
      syncWithCloud: mockSyncWithCloud,
      migrateLocalBooksToCloud: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

describe('AuthModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isAuthModalOpen is false', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: false,
      authModalView: 'sign_in',
      closeAuthModal: vi.fn(),
    });

    const { container } = render(<AuthModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Sign In view with email and password inputs', () => {
    const closeAuthModal = vi.fn();
    const setAuthModalView = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal,
      setAuthModalView,
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('reader@bookarium.org')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Bookarium/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close Authentication Modal'));
    expect(closeAuthModal).toHaveBeenCalled();
  });

  it('renders Sign Up view with inputs and create button', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signUpWithPassword: mockSignUpWithPassword,
    });

    render(<AuthModal />);

    expect(screen.getByText('Create Your Bookshelf')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('reader@bookarium.org')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('••••••••••••')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    expect(
      screen.getByText(/By creating an account, you confirm that you are at least 13 years of age/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy Architecture/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /Copyright Governance/i })).toHaveAttribute('href', '/copyright');
  });

  it('submits valid Sign Up credentials to auth store', async () => {
    mockSignUpWithPassword.mockResolvedValueOnce({ needsEmailConfirmation: false, error: null });

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signUpWithPassword: mockSignUpWithPassword,
    });

    render(<AuthModal />);

    fireEvent.change(screen.getByPlaceholderText('Jane Austen'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), { target: { value: 'jane@example.com' } });
    
    const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
    fireEvent.change(pwdInputs[0], { target: { value: 'secret123' } });
    fireEvent.change(pwdInputs[1], { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    await waitFor(() => {
      expect(mockSignUpWithPassword).toHaveBeenCalledWith('jane@example.com', 'secret123', 'Jane Doe');
    });
  });

  it('renders email verification screen and navigates to sign in when email confirmation is required', async () => {
    mockSignUpWithPassword.mockResolvedValueOnce({ needsEmailConfirmation: true, error: null });
    const setAuthModalView = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView,
      setError: vi.fn(),
      signUpWithPassword: mockSignUpWithPassword,
      resendVerificationEmail: mockResendVerificationEmail,
    });

    render(<AuthModal />);

    fireEvent.change(screen.getByPlaceholderText('Jane Austen'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), { target: { value: 'jane@example.com' } });
    
    const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
    fireEvent.change(pwdInputs[0], { target: { value: 'secret123' } });
    fireEvent.change(pwdInputs[1], { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    const verifyScreenTitle = await screen.findByText('Check your email');
    expect(verifyScreenTitle).toBeInTheDocument();
    expect(screen.getByText(/We sent a verification link to/i)).toBeInTheDocument();

    mockResendVerificationEmail.mockResolvedValueOnce({ error: null });
    const resendBtn = screen.getByRole('button', { name: /Resend Email/i });
    fireEvent.click(resendBtn);
    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('jane@example.com');
    });

    const goSignInBtn = screen.getByRole('button', { name: /Go to Sign In/i });
    fireEvent.click(goSignInBtn);
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');
  });

  it('validates password mismatch on Sign Up', () => {
    const mockSetError = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: mockSetError,
      signUpWithPassword: mockSignUpWithPassword,
    });

    render(<AuthModal />);

    fireEvent.change(screen.getByPlaceholderText('Jane Austen'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), { target: { value: 'jane@example.com' } });
    
    const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
    fireEvent.change(pwdInputs[0], { target: { value: 'secret123' } });
    fireEvent.change(pwdInputs[1], { target: { value: 'mismatch456' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(mockSetError).toHaveBeenCalledWith('Passwords do not match.');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('handles form submission in sign in mode', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    const setAuthModalView = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 'user-123' },
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView,
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);

    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In to Bookarium/i }));
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith('user@example.com', 'password123');
    });

    fireEvent.click(screen.getByRole('button', { name: /Use Magic Link/i }));
    expect(setAuthModalView).toHaveBeenCalledWith('magic_link');

    fireEvent.click(screen.getByRole('button', { name: /Sign Up →/i }));
    expect(setAuthModalView).toHaveBeenCalledWith('sign_up');
  });

  it('renders error alert when error exists', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: 'Invalid email or password',
      statusMessage: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });

  it('renders status notice banner when statusMessage exists', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      statusMessage: 'Email verified! Please sign in to access your bookshelf on this device.',
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Email verified! Please sign in to access your bookshelf on this device.'
    );
  });

  it('renders resend link when error indicates email not confirmed and executes resend', async () => {
    mockResendVerificationEmail.mockResolvedValueOnce({ error: null });

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: 'Email not confirmed',
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
      resendVerificationEmail: mockResendVerificationEmail,
    });

    render(<AuthModal />);
    expect(screen.getByText('Email not confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Didn't receive or link expired\?/i)).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('reader@bookarium.org');
    fireEvent.change(emailInput, { target: { value: 'unconfirmed@bookarium.org' } });

    const resendBtn = screen.getByRole('button', { name: 'Resend Link' });
    fireEvent.click(resendBtn);
    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('unconfirmed@bookarium.org');
    });
  });

  it('submits magic link request on valid email', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'magic_link',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithOtp: mockSignInWithOtp,
    });

    render(<AuthModal />);
    expect(screen.getByText('Sign In via Magic Link')).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'magic@bookarium.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Link/i }));
    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith('magic@bookarium.org');
    });
  });

  it('renders magic link confirmation screen and navigates back to sign in', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });
    const setAuthModalView = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'magic_link',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView,
      setError: vi.fn(),
      signInWithOtp: mockSignInWithOtp,
    });

    render(<AuthModal />);
    
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'magic@bookarium.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Link/i }));

    const backBtn = await screen.findByRole('button', { name: /Back to Sign In/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');
  });

  it('handles Suggest Strong Password generation and visibility toggle', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signUpWithPassword: mockSignUpWithPassword,
    });

    render(<AuthModal />);

    const suggestBtn = screen.getByRole('button', { name: /Suggest Strong Password/i });
    expect(suggestBtn).toBeInTheDocument();

    fireEvent.click(suggestBtn);

    // After clicking suggest, password should be revealed
    const hideBtn = screen.getByLabelText('Hide password');
    expect(hideBtn).toBeInTheDocument();

    // Toggle back to hidden
    fireEvent.click(hideBtn);
    expect(screen.getByLabelText('Show password')).toBeInTheDocument();
  });

  it('navigates from sign in view to forgot password view', () => {
    const setAuthModalView = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView,
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
      resetPasswordForEmail: mockResetPasswordForEmail,
    });

    render(<AuthModal />);

    const forgotBtn = screen.getByRole('button', { name: /Forgot password\?/i });
    expect(forgotBtn).toBeInTheDocument();
    fireEvent.click(forgotBtn);
    expect(setAuthModalView).toHaveBeenCalledWith('forgot_password');
  });

  it('submits password reset request and displays check email confirmation', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'forgot_password',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      resetPasswordForEmail: mockResetPasswordForEmail,
    });

    render(<AuthModal />);

    expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.getByText(/Enter your account email and we will send you a secure link/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'forgot@bookarium.org' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Send Password Reset Link/i }));
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('forgot@bookarium.org');
    });

    const emailSentTitle = await screen.findByText('Check your email');
    expect(emailSentTitle).toBeInTheDocument();
    expect(screen.getByText(/We sent a password reset link to/i)).toBeInTheDocument();
  });

  it('navigates back to sign in from confirmation screen', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const setAuthModalView = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthModalOpen: true,
      authModalView: 'forgot_password',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView,
      setError: vi.fn(),
      resetPasswordForEmail: mockResetPasswordForEmail,
    });

    render(<AuthModal />);

    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'forgot@bookarium.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Password Reset Link/i }));

    await screen.findByText('Check your email');
    const backBtn = screen.getByRole('button', { name: /Back to Sign In/i });
    fireEvent.click(backBtn);
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');
  });

  it('closes modal on Escape key press', () => {
    const closeAuthModal = vi.fn();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal,
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeAuthModal).toHaveBeenCalledTimes(1);
  });

  it('binds dynamic unique useId to dialog header', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);

    const dialog = screen.getByRole('dialog');
    const heading = screen.getByRole('heading', { level: 2, name: 'Welcome Back' });

    expect(dialog).toHaveAttribute('aria-labelledby');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(heading).toHaveAttribute('id', labelledById);
  });

  it('traps Tab and Shift+Tab focus within the auth dialog card', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);

    const dialog = screen.getByRole('dialog');
    const tabbableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const tabbables = Array.from(dialog.querySelectorAll<HTMLElement>(tabbableSelector)).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
    );
    expect(tabbables.length).toBeGreaterThan(2);

    const firstElement = tabbables[0];
    const lastElement = tabbables[tabbables.length - 1];

    // First element + Shift+Tab wraps directly to lastElement
    firstElement.focus();
    expect(document.activeElement).toBe(firstElement);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastElement);

    // Last element + Tab wraps directly to firstElement
    lastElement.focus();
    expect(document.activeElement).toBe(lastElement);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstElement);
  });

  it('restores focus to previous active element when unmounted', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Sign In Trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_in',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    const { unmount } = render(<AuthModal />);
    unmount();

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('executes useShallow selector, syncs cloud on sign-in/sign-up, switches views across all 4 modes, and handles resend verification errors', async () => {
    const setAuthModalView = vi.fn();
    const setError = vi.fn();
    const closeAuthModal = vi.fn();

    mockSignInWithPassword.mockResolvedValueOnce({
      error: null,
      user: { id: 'user-sync-1' },
    });

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (s: Record<string, unknown>) => unknown) => {
        const state = {
          isAuthModalOpen: true,
          authModalView: 'sign_in',
          error: 'Email not confirmed',
          statusMessage: null,
          closeAuthModal,
          setAuthModalView,
          setError,
          signInWithPassword: mockSignInWithPassword,
          signUpWithPassword: mockSignUpWithPassword,
          signInWithOtp: mockSignInWithOtp,
          signInWithOAuth: vi.fn(),
          resetPasswordForEmail: mockResetPasswordForEmail,
          resendVerificationEmail: mockResendVerificationEmail,
        };
        return typeof selector === 'function' ? selector(state) : state;
      }
    );

    const { rerender } = render(<AuthModal />);

    // Sign in with user.id triggers syncWithCloud
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'scholar@bookarium.org' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
      target: { value: 'SecretPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Bookarium/i }));

    await waitFor(() => {
      expect(mockSyncWithCloud).toHaveBeenCalledWith('user-sync-1');
    });

    // Resend verification error branch and catch branch
    mockResendVerificationEmail.mockResolvedValueOnce({
      error: { message: 'Rate limit exceeded' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resend Link' }));
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith('Rate limit exceeded');
    });

    mockResendVerificationEmail.mockRejectedValueOnce(new Error('Network offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Resend Link' }));
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Failed to resend verification email. Please try again.'
      );
    });

    // Switchers in sign_up, forgot_password, and magic_link views
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal,
      setAuthModalView,
      setError,
      signUpWithPassword: mockSignUpWithPassword,
    });
    rerender(<AuthModal />);
    fireEvent.click(screen.getByRole('button', { name: /Sign In →/i }));
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'forgot_password',
      error: null,
      closeAuthModal,
      setAuthModalView,
      setError,
      resetPasswordForEmail: mockResetPasswordForEmail,
    });
    rerender(<AuthModal />);
    fireEvent.click(screen.getByRole('button', { name: /← Back to Sign In/i }));
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'magic_link',
      error: null,
      closeAuthModal,
      setAuthModalView,
      setError,
      signInWithOtp: mockSignInWithOtp,
    });
    rerender(<AuthModal />);
    fireEvent.click(
      screen.getByRole('button', { name: /← Back to Email & Password Sign In/i })
    );
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');
  });

  it('blocks automated form submissions when the honeypot field is populated', async () => {
    const setError = vi.fn();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthModalOpen: true,
      authModalView: 'sign_up',
      error: null,
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError,
      signUpWithPassword: mockSignUpWithPassword,
    });

    render(<AuthModal />);

    fireEvent.change(screen.getByPlaceholderText('Jane Austen'), {
      target: { value: 'Bot Account' },
    });
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'bot@example.com' },
    });
    const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
    fireEvent.change(pwdInputs[0], { target: { value: 'secret123' } });
    fireEvent.change(pwdInputs[1], { target: { value: 'secret123' } });

    fireEvent.change(screen.getByTestId('auth-honeypot-input'), {
      target: { value: 'https://spam.example' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(setError).toHaveBeenCalledWith('Automated submission blocked.');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('mounts Cloudflare Turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured, enforces verification, forwards token, and resets widget', async () => {
    const prevKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAATestTurnstileKey';

    let capturedOptions: {
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    } = {};
    const mockTurnstileRender = vi.fn((_el: HTMLElement, opts: typeof capturedOptions) => {
      capturedOptions = opts;
      return 'turnstile-widget-1';
    });
    const mockTurnstileReset = vi.fn();
    const mockTurnstileRemove = vi.fn();
    window.turnstile = {
      render: mockTurnstileRender,
      reset: mockTurnstileReset,
      remove: mockTurnstileRemove,
    };

    const setError = vi.fn();
    mockSignUpWithPassword.mockResolvedValueOnce({
      needsEmailConfirmation: true,
      error: null,
    });

    try {
      (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthModalOpen: true,
        authModalView: 'sign_up',
        error: null,
        closeAuthModal: vi.fn(),
        setAuthModalView: vi.fn(),
        setError,
        signUpWithPassword: mockSignUpWithPassword,
      });

      const { unmount } = render(<AuthModal />);

      expect(screen.getByTestId('turnstile-widget-container')).toBeInTheDocument();
      expect(mockTurnstileRender).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByPlaceholderText('Jane Austen'), {
        target: { value: 'Jane Austen' },
      });
      fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
        target: { value: 'jane@bookarium.org' },
      });
      const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
      fireEvent.change(pwdInputs[0], { target: { value: 'StrongPass123!' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'StrongPass123!' } });

      // Submitting before Turnstile callback resolves should block submission
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
      expect(setError).toHaveBeenCalledWith(
        'Please complete the security verification check.'
      );
      expect(mockSignUpWithPassword).not.toHaveBeenCalled();

      // Trigger expired & error callbacks, then valid token callback
      await waitFor(() => {
        capturedOptions['expired-callback']?.();
        capturedOptions['error-callback']?.();
        capturedOptions.callback?.('turnstile-verified-token-123');
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(mockSignUpWithPassword).toHaveBeenCalledWith(
          'jane@bookarium.org',
          'StrongPass123!',
          'Jane Austen',
          'turnstile-verified-token-123'
        );
      });
      expect(mockTurnstileReset).toHaveBeenCalledWith('turnstile-widget-1');

      unmount();
    } finally {
      if (prevKey === undefined) {
        delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      } else {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevKey;
      }
      delete window.turnstile;
    }
  });
});