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
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, isLoading, updateProfile, signOut, openAuthModal } = useAuthStore();
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

            {/* Account Actions Card */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}