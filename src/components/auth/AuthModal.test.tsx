import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthModal } from './AuthModal';
import { useAuthStore } from '@/stores/useAuthStore';

const mockSignInWithPassword = vi.fn();
const mockSignUpWithPassword = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockResetPasswordForEmail = vi.fn();

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

  it('renders Sign Up view, submits with email confirmation required, and shows confirmation screen', async () => {
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
    });

    render(<AuthModal />);

    expect(screen.getByText('Create Your Bookshelf')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Jane Austen'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), { target: { value: 'jane@example.com' } });
    
    const pwdInputs = screen.getAllByPlaceholderText('••••••••••••');
    expect(pwdInputs).toHaveLength(2);
    fireEvent.change(pwdInputs[0], { target: { value: 'secret123' } });
    fireEvent.change(pwdInputs[1], { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(mockSignUpWithPassword).toHaveBeenCalledWith('jane@example.com', 'secret123', 'Jane Doe');

    // Should display verification screen
    const verifyScreenTitle = await screen.findByText('Check your email');
    expect(verifyScreenTitle).toBeInTheDocument();
    expect(screen.getByText(/We sent a verification link to/i)).toBeInTheDocument();

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

  it('handles magic link view and submission and email confirmation screen', async () => {
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
    expect(screen.getByText('Sign In via Magic Link')).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'magic@bookarium.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Link/i }));
    expect(mockSignInWithOtp).toHaveBeenCalledWith('magic@bookarium.org');

    // Email sent screen
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

  it('handles forgot password navigation from sign in view and submits reset email', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
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

    const { rerender } = render(<AuthModal />);

    // Click "Forgot password?" link on sign in
    const forgotBtn = screen.getByRole('button', { name: /Forgot password\?/i });
    expect(forgotBtn).toBeInTheDocument();
    fireEvent.click(forgotBtn);
    expect(setAuthModalView).toHaveBeenCalledWith('forgot_password');

    // Switch view to forgot_password
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

    rerender(<AuthModal />);

    expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.getByText(/Enter your account email and we will send you a secure link/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('reader@bookarium.org'), {
      target: { value: 'forgot@bookarium.org' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Send Password Reset Link/i }));
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('forgot@bookarium.org');

    // Should render check your email confirmation screen
    const emailSentTitle = await screen.findByText('Check your email');
    expect(emailSentTitle).toBeInTheDocument();
    expect(screen.getByText(/We sent a password reset link to/i)).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /Back to Sign In/i });
    fireEvent.click(backBtn);
    expect(setAuthModalView).toHaveBeenCalledWith('sign_in');
  });
});