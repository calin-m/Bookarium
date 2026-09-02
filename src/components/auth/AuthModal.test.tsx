import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('@/stores/useBookshelfStore', () => ({
  useBookshelfStore: () => ({
    migrateLocalBooksToCloud: vi.fn(),
  }),
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
  });

  it('submits valid Sign Up credentials to auth store', () => {
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
    expect(mockSignUpWithPassword).toHaveBeenCalledWith('jane@example.com', 'secret123', 'Jane Doe');
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
    expect(mockResendVerificationEmail).toHaveBeenCalledWith('jane@example.com');

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
    expect(mockSignInWithPassword).toHaveBeenCalledWith('user@example.com', 'password123');

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
      closeAuthModal: vi.fn(),
      setAuthModalView: vi.fn(),
      setError: vi.fn(),
      signInWithPassword: mockSignInWithPassword,
    });

    render(<AuthModal />);
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
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
    expect(mockResendVerificationEmail).toHaveBeenCalledWith('unconfirmed@bookarium.org');
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
    expect(mockSignInWithOtp).toHaveBeenCalledWith('magic@bookarium.org');
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
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('forgot@bookarium.org');

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
});