'use client';

import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { X, Mail, Lock, User as UserIcon, Sparkles, AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, type AuthModalView } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { generateStrongPassword as generatePasswordUtil, evaluatePasswordStrength } from '@/lib/password';
import { EmailSentView } from './EmailSentView';

export interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const AUTH_VIEW_CONFIG: Record<AuthModalView, { title: string; description: string; submitLabel: string }> = {
  sign_in: {
    title: 'Welcome Back',
    description: 'Sign in to access your custom bookshelves and sync reading progress across devices.',
    submitLabel: 'Sign In to Bookarium',
  },
  sign_up: {
    title: 'Create Your Bookshelf',
    description: 'Join Bookarium to organize personal reading lists and sync public domain masterworks.',
    submitLabel: 'Create Account',
  },
  forgot_password: {
    title: 'Reset Your Password',
    description: 'Enter your account email and we will send you a secure link to reset your password.',
    submitLabel: 'Send Password Reset Link',
  },
  magic_link: {
    title: 'Sign In via Magic Link',
    description: 'We will email you a secure login link with zero password required.',
    submitLabel: 'Send Magic Link',
  },
};

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalView,
    error,
    statusMessage,
    closeAuthModal,
    setAuthModalView,
    setError,
    signInWithPassword,
    signUpWithPassword,
    signInWithOtp,
    signInWithOAuth,
    resetPasswordForEmail,
    resendVerificationEmail,
  } = useAuthStore(
    useShallow((s) => ({
      isAuthModalOpen: s.isAuthModalOpen,
      authModalView: s.authModalView,
      error: s.error,
      statusMessage: s.statusMessage,
      closeAuthModal: s.closeAuthModal,
      setAuthModalView: s.setAuthModalView,
      setError: s.setError,
      signInWithPassword: s.signInWithPassword,
      signUpWithPassword: s.signUpWithPassword,
      signInWithOtp: s.signInWithOtp,
      signInWithOAuth: s.signInWithOAuth,
      resetPasswordForEmail: s.resetPasswordForEmail,
      resendVerificationEmail: s.resendVerificationEmail,
    }))
  );

  const syncWithCloud = useBookshelfStore((s) => s.syncWithCloud);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOAuthSubmitting, setIsOAuthSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const turnstileSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeAuthModalRef = useRef(closeAuthModal);

  const resetTurnstileWidget = useCallback(() => {
    setCaptchaToken(null);
    if (typeof window !== 'undefined' && window.turnstile && turnstileWidgetIdRef.current) {
      try {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      } catch {
        // Ignore reset errors on unmounted widgets
      }
    }
  }, []);

  const mountTurnstileWidget = useCallback(() => {
    if (
      !isAuthModalOpen ||
      !turnstileSiteKey ||
      typeof window === 'undefined' ||
      !window.turnstile ||
      !turnstileContainerRef.current
    ) {
      return;
    }
    if (turnstileWidgetIdRef.current) {
      try {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      } catch {
        // Ignore cleanup errors
      }
      turnstileWidgetIdRef.current = null;
    }
    setCaptchaToken(null);
    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      theme: 'auto',
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(null),
      'error-callback': () => setCaptchaToken(null),
    });
  }, [isAuthModalOpen, turnstileSiteKey]);

  useEffect(() => {
    if (!isAuthModalOpen || !turnstileSiteKey) return;
    const isSentView =
      (verificationEmailSent && authModalView === 'sign_up') ||
      (magicLinkSent && authModalView === 'magic_link') ||
      (resetPasswordSent && authModalView === 'forgot_password');
    if (isSentView) return;

    mountTurnstileWidget();

    return () => {
      if (typeof window !== 'undefined' && window.turnstile && turnstileWidgetIdRef.current) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          // Ignore cleanup errors
        }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [
    isAuthModalOpen,
    turnstileSiteKey,
    authModalView,
    verificationEmailSent,
    magicLinkSent,
    resetPasswordSent,
    mountTurnstileWidget,
  ]);

  useEffect(() => {
    closeAuthModalRef.current = closeAuthModal;
  }, [closeAuthModal]);

  // Focus trap & Escape dismissal effect
  useEffect(() => {
    if (!isAuthModalOpen) return;

    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }

    const getTabbableElements = (): HTMLElement[] => {
      if (!cardRef.current) return [];
      const selector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(cardRef.current.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    const timer = setTimeout(() => {
      if (cardRef.current && (!document.activeElement || !cardRef.current.contains(document.activeElement))) {
        const tabbables = getTabbableElements();
        if (tabbables.length > 0) {
          tabbables[0].focus({ preventScroll: true });
        }
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModalRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const tabbables = getTabbableElements();
        if (tabbables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = tabbables[0];
        const lastElement = tabbables[tabbables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !cardRef.current?.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus({ preventScroll: true });
          }
        } else {
          if (document.activeElement === lastElement || !cardRef.current?.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus({ preventScroll: true });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function' &&
        typeof document !== 'undefined' &&
        document.body.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [isAuthModalOpen]);

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
      const { error: resendErr } = captchaToken
        ? await resendVerificationEmail(email, captchaToken)
        : await resendVerificationEmail(email);
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
      resetTurnstileWidget();
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
    setError(null);

    if (honeypot.trim().length > 0) {
      setError('Automated submission blocked.');
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setError('Please complete the security verification check.');
      return;
    }

    setIsSubmitting(true);

    try {
      const tokenArg = captchaToken || undefined;
      if (authModalView === 'sign_in') {
        const { error: err, user: signedInUser } = tokenArg
          ? await signInWithPassword(email, password, tokenArg)
          : await signInWithPassword(email, password);
        if (!err && signedInUser?.id) {
          await syncWithCloud(signedInUser.id);
        }
      } else if (authModalView === 'sign_up') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        const { error: err, needsEmailConfirmation, user: signedUpUser } = tokenArg
          ? await signUpWithPassword(email, password, fullName, tokenArg)
          : await signUpWithPassword(email, password, fullName);
        if (!err) {
          if (needsEmailConfirmation) {
            setVerificationEmailSent(true);
          } else if (signedUpUser?.id) {
            await syncWithCloud(signedUpUser.id);
          }
        }
      } else if (authModalView === 'magic_link') {
        const { error: err } = tokenArg
          ? await signInWithOtp(email, tokenArg)
          : await signInWithOtp(email);
        if (!err) {
          setMagicLinkSent(true);
        }
      } else if (authModalView === 'forgot_password') {
        const { error: err } = tokenArg
          ? await resetPasswordForEmail(email, tokenArg)
          : await resetPasswordForEmail(email);
        if (!err) {
          setResetPasswordSent(true);
        }
      }
    } finally {
      setIsSubmitting(false);
      resetTurnstileWidget();
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setIsOAuthSubmitting(true);
    setError(null);
    try {
      await signInWithOAuth(provider);
    } finally {
      setIsOAuthSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        ref={cardRef}
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
            <h2 id={titleId} className="text-xl sm:text-2xl font-serif font-bold text-foreground">
              {AUTH_VIEW_CONFIG[authModalView].title}
            </h2>
            <p className="text-xs text-muted-foreground font-sans">
              {AUTH_VIEW_CONFIG[authModalView].description}
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

        {/* Status / Verification Notice Banner */}
        {statusMessage && (
          <div
            role="status"
            className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

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
          <EmailSentView
            email={email}
            messagePrefix="We sent a verification link to"
            subtitle="Please click the link in your email to activate your account. Verification links expire in 1 hour."
            resendSuccess={resendSuccess}
            onResend={handleResendVerification}
            isResending={isResending}
            resendCooldown={resendCooldown}
            onBackToSignIn={() => {
              setVerificationEmailSent(false);
              setAuthModalView('sign_in');
            }}
            backButtonLabel="Go to Sign In"
          />
        ) : /* Magic Link Sent Success */
        magicLinkSent && authModalView === 'magic_link' ? (
          <EmailSentView
            email={email}
            messagePrefix="We sent a magic sign-in link to"
            onBackToSignIn={() => {
              setMagicLinkSent(false);
              setAuthModalView('sign_in');
            }}
          />
        ) : /* Password Reset Email Sent Success */
        resetPasswordSent && authModalView === 'forgot_password' ? (
          <EmailSentView
            email={email}
            messagePrefix="We sent a password reset link to"
            subtitle="Click the link in your email to set a new password."
            onBackToSignIn={() => {
              setResetPasswordSent(false);
              setAuthModalView('sign_in');
            }}
          />
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {(authModalView === 'sign_in' || authModalView === 'sign_up') && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  isLoading={isOAuthSubmitting}
                  disabled={isSubmitting || isOAuthSubmitting}
                  onClick={() => handleOAuth('google')}
                  data-testid="google-oauth-button"
                  className="w-full font-mono text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </Button>

                <div className="relative flex items-center justify-center">
                  <div className="w-full border-t border-border" />
                  <span className="bg-card px-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
                    or continue with email
                  </span>
                  <div className="w-full border-t border-border" />
                </div>
              </div>
            )}

            <div className="sr-only" aria-hidden="true">
              <label htmlFor={`${titleId}-website`}>Website</label>
              <input
                id={`${titleId}-website`}
                type="text"
                name="website_url"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                data-testid="auth-honeypot-input"
              />
            </div>

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

            {turnstileSiteKey && (
              <div className="pt-1 flex justify-center">
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                  strategy="afterInteractive"
                  onReady={mountTurnstileWidget}
                />
                <div
                  ref={turnstileContainerRef}
                  data-testid="turnstile-widget-container"
                  className="min-h-[65px] flex items-center justify-center"
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="w-full font-mono text-xs uppercase tracking-wider font-bold"
            >
              <span>{AUTH_VIEW_CONFIG[authModalView].submitLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>

            {authModalView === 'sign_up' && (
              <p className="text-[11px] text-muted-foreground text-center pt-2 leading-relaxed font-sans">
                By creating an account, you confirm that you are at least 13 years of age (or the digital age of consent in your jurisdiction) and agree to our{' '}
                <Link
                  href={ROUTES.PRIVACY}
                  onClick={closeAuthModal}
                  className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                >
                  Privacy Architecture
                </Link>{' '}
                and{' '}
                <Link
                  href={ROUTES.COPYRIGHT}
                  onClick={closeAuthModal}
                  className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                >
                  Copyright Governance
                </Link>.
              </p>
            )}
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