'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Sparkles, AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export const AuthModal: React.FC = () => {
  const {
    user,
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
  } = useAuthStore();

  const { migrateLocalBooksToCloud } = useBookshelfStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);

  if (!isAuthModalOpen) return null;

  const generateStrongPassword = () => {
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const symbols = '!@#$%^&*-_+=';
    const all = lowercase + uppercase + numbers + symbols;

    const pwd = [
      lowercase[Math.floor(Math.random() * lowercase.length)],
      uppercase[Math.floor(Math.random() * uppercase.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];

    for (let i = 0; i < 12; i++) {
      pwd.push(all[Math.floor(Math.random() * all.length)]);
    }

    const result = pwd.sort(() => Math.random() - 0.5).join('');
    setPassword(result);
    setShowPassword(true);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(result).catch(() => {});
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd || pwd.length < 6) return { score: 0, label: 'Too short', color: 'bg-muted' };
    let score = 1;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd) && pwd.length >= 12) score++;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-destructive' };
    if (score === 2) return { score: 2, label: 'Moderate', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (authModalView === 'sign_in') {
        const { error: err } = await signInWithPassword(email, password);
        if (!err && user?.id) {
          await migrateLocalBooksToCloud(user.id);
        }
      } else if (authModalView === 'sign_up') {
        const { error: err, needsEmailConfirmation } = await signUpWithPassword(email, password, fullName);
        if (!err) {
          if (needsEmailConfirmation) {
            setVerificationEmailSent(true);
          } else if (user?.id) {
            await migrateLocalBooksToCloud(user.id);
          }
        }
      } else if (authModalView === 'magic_link') {
        const { error: err } = await signInWithOtp(email);
        if (!err) {
          setMagicLinkSent(true);
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
                : 'Sign In via Magic Link'}
            </h2>
            <p className="text-xs text-muted-foreground font-sans">
              {authModalView === 'sign_in'
                ? 'Sign in to access your custom bookshelves and sync reading progress across devices.'
                : authModalView === 'sign_up'
                ? 'Join Bookarium to organize personal reading lists and sync public domain masterworks.'
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

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
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
                Please click the link in your email to activate your account, then sign in below.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVerificationEmailSent(false);
                setAuthModalView('sign_in');
              }}
              className="font-mono text-xs"
            >
              Go to Sign In
            </Button>
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

            {authModalView !== 'magic_link' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Password
                  </label>
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

                {/* Password Strength Meter for Sign Up */}
                {authModalView === 'sign_up' && password.length > 0 && (
                  <div className="space-y-1 pt-1 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 h-1">
                      <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-muted'}`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-muted'}`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-muted'}`} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>Password strength:</span>
                      <span className="font-bold text-foreground">{strength.label}</span>
                    </div>
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
                  : 'Send Magic Link'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </form>
        )}

        {/* View Switchers */}
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
      </div>
    </div>
  );
};