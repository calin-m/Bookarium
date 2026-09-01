'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Sparkles,
  BookOpen,
  Bookmark,
  Heart,
  Sun,
  Moon,
  Coffee,
  Check,
  ArrowLeft,
  LogOut,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Trash2,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, isLoading, updateProfile, updatePassword, requestAccountDeletion, deleteAccount, signOut, openAuthModal } = useAuthStore();
  const { savedCount, likedCount, cloudBookshelves } = useHydratedBookshelf();
  const customShelvesCount = useMemo(
    () => cloudBookshelves.filter((s) => !s.is_default).length,
    [cloudBookshelves]
  );
  const { theme, setTheme } = useThemeStore();
  const { stickyScrollEnabled, setStickyScrollEnabled } = usePreferencesStore();

  const defaultName = profile?.display_name || user?.user_metadata?.display_name || '';
  const [customName, setCustomName] = useState<string | null>(null);
  const displayName = customName !== null ? customName : defaultName;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Security & Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Danger Zone / Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSendingDeletionEmail, setIsSendingDeletionEmail] = useState(false);
  const [deletionEmailSent, setDeletionEmailSent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { error } = await updateProfile({
        display_name: displayName.trim(),
      });

      if (error) {
        setSaveError(error.message);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

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
    setNewPassword(result);
    setConfirmPassword(result);
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

  const strength = getPasswordStrength(newPassword);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 3500);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleRequestDeletion = async () => {
    setIsSendingDeletionEmail(true);
    setDeleteError(null);

    try {
      const { error } = await requestAccountDeletion();
      if (error) {
        setDeleteError(error.message);
      } else {
        setDeletionEmailSent(true);
      }
    } finally {
      setIsSendingDeletionEmail(false);
    }
  };

  const handleThemeChange = async (newTheme: AppTheme) => {
    setTheme(newTheme);
    if (user) {
      await updateProfile({ preferred_theme: newTheme });
    }
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Member';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200">
      <Navbar
        onViewChange={(view) => {
          if (view === 'catalog') {
            router.push('/');
          } else {
            router.push(`/?view=${view}`);
          }
        }}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Library</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-border">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bookarium Account</span>
          </div>
        </div>

        {/* Guest View Prompt */}
        {!isLoading && !user && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-border text-primary flex items-center justify-center mx-auto">
              <UserIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold">Guest Reader</h2>
              <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">
                Sign in or create an account to customize your profile, sync bookshelves to the cloud, and save your reading preferences across devices.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => openAuthModal('sign_in')}
                className="font-mono text-xs uppercase"
              >
                Sign In / Sign Up
              </Button>
              <Link href="/">
                <Button variant="outline" size="md" className="font-mono text-xs uppercase">
                  Browse Catalog
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Authenticated View */}
        {user && (
          <div className="space-y-6">
            {/* Account Hero Card */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-border text-primary flex items-center justify-center shadow-inner">
                    <UserIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-serif font-bold text-foreground">
                      {profile?.display_name || user?.user_metadata?.display_name || 'Reader'}
                    </h1>
                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-success/10 text-success border border-border">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Reader</span>
                  </div>
                </div>
              </div>

              {/* Profile Editor Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
                  Profile Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="display-name" className="text-xs font-mono text-foreground font-bold">
                      Display Name
                    </label>
                    <Input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Your reading pen name"
                      className="text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground">
                      Account Email
                    </label>
                    <Input
                      type="email"
                      value={user.email ?? ''}
                      disabled
                      className="text-xs font-mono opacity-70 bg-muted cursor-not-allowed"
                    />
                  </div>
                </div>

                {saveError && (
                  <p className="text-xs font-mono text-destructive">{saveError}</p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="chip"
                    isLoading={isSaving}
                    aria-label="Save Changes"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </Button>
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-success animate-in fade-in duration-150">
                      <Check className="w-3.5 h-3.5" />
                      <span>Changes saved to cloud</span>
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Reading & Navigation Preferences Card */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
                Reading & Navigation Preferences
              </h2>

              <div className="space-y-3">
                <label className="text-xs font-mono text-foreground font-bold block">
                  Default Reading Atmosphere & Theme
                </label>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-mono font-bold transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'bg-primary/10 text-primary shadow-xs'
                        : 'bg-card hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('sepia')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-mono font-bold transition-all cursor-pointer ${
                      theme === 'sepia'
                        ? 'bg-primary/10 text-primary shadow-xs'
                        : 'bg-card hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Coffee className="w-4 h-4" />
                    <span>Sepia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-mono font-bold transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-primary/10 text-primary shadow-xs'
                        : 'bg-card hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Catalog Sticky Navigation Mode */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="text-xs font-mono text-foreground font-bold block">
                    Catalog Navigation & Sticky Scroll
                  </label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {stickyScrollEnabled ? 'Smart Auto-Hide Active' : 'Always Fixed Active'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStickyScrollEnabled(true)}
                    className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      stickyScrollEnabled
                        ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                        : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-mono font-bold text-foreground">Smart Auto-Hide</span>
                      {stickyScrollEnabled && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
                      Directional scroll auto-hides header and filter bar during browsing to maximize book reading space.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStickyScrollEnabled(false)}
                    className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      !stickyScrollEnabled
                        ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                        : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-mono font-bold text-foreground">Always Fixed</span>
                      {!stickyScrollEnabled && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
                      Keeps the header and filter toolbar stationary at the top of your screen at all times.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Security & Password Card */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-border">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Security & Password
                  </h2>
                  <p className="text-xs text-muted-foreground font-sans">
                    Update your account password to protect your cloud reading lists.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="new-password" className="text-xs font-mono text-foreground font-bold">
                        New Password
                      </label>
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
                    </div>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="text-xs font-mono pr-9"
                        minLength={6}
                        required
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
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm-password" className="text-xs font-mono text-foreground font-bold">
                      Confirm New Password
                    </label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="text-xs font-mono"
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                {/* Password Strength Meter for Profile */}
                {newPassword.length > 0 && (
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

                {passwordError && (
                  <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="chip"
                    isLoading={isUpdatingPassword}
                    aria-label="Update Password"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Update Password</span>
                  </Button>
                  {passwordSuccess && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-success animate-in fade-in duration-150">
                      <Check className="w-3.5 h-3.5" />
                      <span>Password successfully updated</span>
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Cloud Library Statistics Card */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
                  Cloud Library Statistics
                </h2>
                <Link
                  href="/?view=bookshelf"
                  className="text-xs font-mono text-primary hover:underline font-bold"
                >
                  Open Bookshelf →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                    <Bookmark className="w-3.5 h-3.5 text-primary" />
                    <span>Saved Volumes</span>
                  </div>
                  <p className="text-2xl font-mono font-bold text-foreground">{savedCount}</p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                    <Heart className="w-3.5 h-3.5 text-destructive" />
                    <span>Liked Titles</span>
                  </div>
                  <p className="text-2xl font-mono font-bold text-foreground">{likedCount}</p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>Custom Shelves</span>
                  </div>
                  <p data-testid="custom-shelves-count" className="text-2xl font-mono font-bold text-foreground">{customShelvesCount}</p>
                </div>
              </div>
            </div>

            {/* Account Actions & Danger Zone */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-mono font-bold text-foreground">Sign Out of Bookarium</h3>
                  <p className="text-xs text-muted-foreground font-sans">
                    Your reading progress and cloud bookshelves are securely saved in Supabase.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={async () => {
                    await signOut();
                    router.push('/');
                  }}
                  className="font-mono text-xs uppercase text-destructive hover:bg-destructive/10 border border-border shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  <span>Sign Out</span>
                </Button>
              </div>

              {/* Danger Zone */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-mono font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Danger Zone: Delete Account</span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-sans">
                    Permanently delete your profile and purge all custom cloud bookshelves. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="font-mono text-xs uppercase bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Delete Account</span>
                </Button>
              </div>
            </div>

            {/* Delete Account Confirmation Modal */}
            <Modal
              isOpen={isDeleteModalOpen}
              onClose={() => {
                setIsDeleteModalOpen(false);
                setDeletionEmailSent(false);
                setDeleteError(null);
              }}
              title={deletionEmailSent ? 'Check Your Email' : 'Request Account Deletion'}
              maxWidth="md"
            >
              <div className="p-6 space-y-5" data-testid="delete-account-dialog">
                {deletionEmailSent ? (
                  <div className="space-y-4 text-center py-2">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 text-destructive flex items-center justify-center mx-auto">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-serif font-bold text-base text-foreground">
                        Verification Link Sent
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                        We sent a secure deletion confirmation link to <strong className="text-foreground">{user.email}</strong>.
                      </p>
                      <p className="text-[11px] text-muted-foreground font-sans leading-relaxed pt-1">
                        Please open the email on your device and click the link to finalize the permanent deletion of your account and cloud bookshelves.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsDeleteModalOpen(false);
                          setDeletionEmailSent(false);
                        }}
                        className="font-mono text-xs uppercase"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground text-sm sm:text-base">
                          Security Verification Required
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          For your security, deleting your account requires email confirmation. Clicking below will send a one-time verification link to <strong className="text-foreground">{user.email}</strong>. Your account will <strong className="text-foreground">remain active</strong> until you click the confirmation link in that email.
                        </p>
                      </div>
                    </div>

                    {deleteError && (
                      <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{deleteError}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDeleteModalOpen(false)}
                        className="text-xs font-mono uppercase"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isSendingDeletionEmail}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
                        onClick={handleRequestDeletion}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Deletion Link</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Modal>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}