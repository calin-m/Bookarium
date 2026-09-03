'use client';

import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon, Sparkles, AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { generateStrongPassword as generatePasswordUtil, evaluatePasswordStrength } from '@/lib/password';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalView,
    error,
    closeAuthModal,
    setAuthModalView,
    setError,
    signInWithPassword,
    signUpWithPassword,
    signInWithOtp,
    signInWithOAuth,
    resetPasswordForEmail,
    resendVerificationEmail,
  } = useAuthStore();

  const { syncWithCloud } = useBookshelfStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!email || isResending || resendCooldown > 0) return;
    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const { error: resendErr } = await resendVerificationEmail(email);
      if (resendErr) {
        setError(resendErr.message);
      } else {
        setResendSuccess(true);
        setResendCooldown(60);
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch {
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  if (!isAuthModalOpen) return null;

  const generateStrongPassword = () => {
    const result = generatePasswordUtil();
    setPassword(result);
    setConfirmPassword(result);
    setShowPassword(true);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(result).catch(() => {});
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    }
  };

  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (authModalView === 'sign_in') {
        const { error: err, user: signedInUser } = await signInWithPassword(email, password);
        if (!err && signedInUser?.id) {
          await syncWithCloud(signedInUser.id);
        }
      } else if (authModalView === 'sign_up') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        const { error: err, needsEmailConfirmation, user: signedUpUser } = await signUpWithPassword(email, password, fullName);
        if (!err) {
          if (needsEmailConfirmation) {
            setVerificationEmailSent(true);
          } else if (signedUpUser?.id) {
            await syncWithCloud(signedUpUser.id);
          }
        }
      } else if (authModalView === 'magic_link') {
        const { error: err } = await signInWithOtp(email);
        if (!err) {
          setMagicLinkSent(true);
        }
      } else if (authModalView === 'forgot_password') {
        const { error: err } = await resetPasswordForEmail(email);
        if (!err) {
          setResetPasswordSent(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const _handleOAuth = async (provider: 'google' | 'github') => {
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithOAuth(provider);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 text-foreground space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bookarium Cloud</span>
            </div>
            <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-serif font-bold text-foreground">
              {authModalView === 'sign_in'
                ? 'Welcome Back'
                : authModalView === 'sign_up'
                ? 'Create Your Bookshelf'
                : authModalView === 'forgot_password'
                ? 'Reset Your Password'
                : 'Sign In via Magic Link'}
            </h2>
            <p className="text-xs text-muted-foreground font-sans">
              {authModalView === 'sign_in'
                ? 'Sign in to access your custom bookshelves and sync reading progress across devices.'
                : authModalView === 'sign_up'
                ? 'Join Bookarium to organize personal reading lists and sync public domain masterworks.'
                : authModalView === 'forgot_password'
                ? 'Enter your account email and we will send you a secure link to reset your password.'
                : 'We will email you a secure login link with zero password required.'}
            </p>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Close Authentication Modal"
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert with Optional Resend Action if Email Not Confirmed */}
        {error && (
          <div className="space-y-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {error.toLowerCase().includes('email not confirmed') && (
              <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-destructive/20">
                <span className="text-[11px] text-foreground/80">
                  Didn&apos;t receive or link expired?
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={isResending || resendCooldown > 0}
                  className="text-[11px] font-mono shrink-0 cursor-pointer h-7 px-2"
                >
                  {isResending
                    ? 'Sending...'
                    : resendCooldown > 0
                    ? `Wait ${resendCooldown}s`
                    : 'Resend Link'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Verification Email Sent Screen (Sign Up) */}
        {verificationEmailSent && authModalView === 'sign_up' ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif font-bold text-lg">Check your email</h3>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                We sent a verification link to <strong className="text-foreground">{email}</strong>.
              </p>
              <p className="text-[11px] text-muted-foreground font-sans">
                Please click the link in your email to activate your account. Verification links expire in 1 hour.
              </p>
              {resendSuccess && (
                <p className="text-xs font-mono text-success pt-1">
                  Fresh verification link sent! Please check your inbox.
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                disabled={isResending || resendCooldown > 0}
                className="font-mono text-xs cursor-pointer w-full sm:w-auto"
              >
                {isResending
                  ? 'Sending...'
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend Email'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setVerificationEmailSent(false);
                  setAuthModalView('sign_in');
                }}
                className="font-mono text-xs cursor-pointer w-full sm:w-auto"
              >
                Go to Sign In
              </Button>
            </div>
          </div>
        ) : /* Magic Link Sent Success */
        magicLinkSent && authModalView === 'magic_link' ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-base">Check your email</h3>
              <p className="text-xs text-muted-foreground font-mono">
                We sent a magic sign-in link to <strong className="text-foreground">{email}</strong>.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMagicLinkSent(false);
                setAuthModalView('sign_in');
              }}
            >
              Back to Sign In
            </Button>
          </div>
        ) : /* Password Reset Email Sent Success */
        resetPasswordSent && authModalView === 'forgot_password' ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-base">Check your email</h3>
              <p className="text-xs text-muted-foreground font-mono">
                We sent a password reset link to <strong className="text-foreground">{email}</strong>.
              </p>
              <p className="text-[11px] text-muted-foreground font-sans mt-2">
                Click the link in your email to set a new password.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResetPasswordSent(false);
                setAuthModalView('sign_in');
              }}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {authModalView === 'sign_up' && (
              <div className="space-y-1">
                <label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                  <UserIcon className="w-3 h-3" /> Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Jane Austen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email Address
              </label>
              <Input
                type="email"
                placeholder="reader@bookarium.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs font-mono"
                required
              />
            </div>

            {authModalView !== 'magic_link' && authModalView !== 'forgot_password' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Password
                  </label>
                  {authModalView === 'sign_in' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setAuthModalView('forgot_password');
                      }}
                      className="text-[11px] font-mono text-primary hover:underline cursor-pointer transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                  {authModalView === 'sign_up' && (
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer transition-colors"
                      aria-label="Suggest Strong Password"
                    >
                      {copiedPassword ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3 h-3" />
                          <span>Suggest Strong Password</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={authModalView === 'sign_up' ? 'new-password' : 'current-password'}
                    className="text-xs font-mono pr-9"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {authModalView === 'sign_up' && (
                  <div className="space-y-1.5 pt-1.5">
                    <label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Confirm Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="text-xs font-mono pr-9"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                )}

                {/* Password Strength Meter for Sign Up */}
                {authModalView === 'sign_up' && password.length > 0 && (
                  <div className="pt-1 animate-in fade-in duration-150">
                    <PasswordStrengthMeter strength={strength} />
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="w-full font-mono text-xs uppercase tracking-wider font-bold"
            >
              <span>
                {authModalView === 'sign_in'
                  ? 'Sign In to Bookarium'
                  : authModalView === 'sign_up'
                  ? 'Create Account'
                  : authModalView === 'forgot_password'
                  ? 'Send Password Reset Link'
                  : 'Send Magic Link'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </form>
        )}

        {/* View Switchers */}
        {!verificationEmailSent && !magicLinkSent && !resetPasswordSent && (
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
            {authModalView === 'sign_in' ? (
              <>
                <button
                  type="button"
                  onClick={() => setAuthModalView('magic_link')}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Use Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalView('sign_up')}
                  className="text-primary font-bold hover:underline cursor-pointer"
                >
                  Sign Up &rarr;
                </button>
              </>
            ) : authModalView === 'sign_up' ? (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => setAuthModalView('sign_in')}
                  className="text-primary font-bold hover:underline cursor-pointer"
                >
                  Sign In &rarr;
                </button>
              </>
            ) : authModalView === 'forgot_password' ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAuthModalView('sign_in');
                }}
                className="hover:text-primary transition-colors cursor-pointer mx-auto"
              >
                &larr; Back to Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalView('sign_in')}
                className="hover:text-primary transition-colors cursor-pointer mx-auto"
              >
                &larr; Back to Email & Password Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};