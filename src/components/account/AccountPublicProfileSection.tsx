'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Lock,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  Flame,
  Target,
  Library,
  Bookmark,
  AtSign,
  Sparkles,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';
import { useAuthStore, validateUsername } from '@/stores/useAuthStore';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface AccountPublicProfileSectionProps {
  user: User;
  profile: Profile | null;
  onUpdateProfile?: (updates: {
    username?: string | null;
    bio?: string | null;
    is_public?: boolean;
    show_streak?: boolean;
    show_challenge?: boolean;
    show_bookshelves?: boolean;
    show_saved_books?: boolean;
    show_custom_shelves?: boolean;
  }) => Promise<{ error: Error | null }>;
}

export const AccountPublicProfileSection: React.FC<AccountPublicProfileSectionProps> = ({
  profile,
  onUpdateProfile,
}) => {
  const defaultUpdateProfile = useAuthStore((s) => s.updateProfile);
  const updateFn = onUpdateProfile || defaultUpdateProfile;

  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? false);
  const [showStreak, setShowStreak] = useState(profile?.show_streak ?? true);
  const [showChallenge, setShowChallenge] = useState(profile?.show_challenge ?? true);
  const [showSavedBooks, setShowSavedBooks] = useState(
    profile?.show_saved_books ?? profile?.show_bookshelves ?? true
  );
  const [showCustomShelves, setShowCustomShelves] = useState(
    profile?.show_custom_shelves ?? profile?.show_bookshelves ?? true
  );

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) {
    setPrevProfile(profile);
    setUsername(profile?.username || '');
    setBio(profile?.bio || '');
    setIsPublic(profile?.is_public ?? false);
    setShowStreak(profile?.show_streak ?? true);
    setShowChallenge(profile?.show_challenge ?? true);
    setShowSavedBooks(profile?.show_saved_books ?? profile?.show_bookshelves ?? true);
    setShowCustomShelves(profile?.show_custom_shelves ?? profile?.show_bookshelves ?? true);
  }

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    const trimmed = val.trim();
    if (trimmed.length > 0) {
      const res = validateUsername(trimmed);
      setUsernameError(res.isValid ? null : res.error);
    } else {
      setUsernameError(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    const trimmedUsername = username.trim();
    if (isPublic && !trimmedUsername) {
      setUsernameError('A username is required to publish your scholar profile.');
      return;
    }

    if (trimmedUsername) {
      const res = validateUsername(trimmedUsername);
      if (!res.isValid) {
        setUsernameError(res.error);
        return;
      }
    }

    setIsSaving(true);
    try {
      const { error } = await updateFn({
        username: trimmedUsername || null,
        bio: bio.trim() || null,
        is_public: isPublic,
        show_streak: showStreak,
        show_challenge: showChallenge,
        show_bookshelves: showSavedBooks || showCustomShelves,
        show_saved_books: showSavedBooks,
        show_custom_shelves: showCustomShelves,
      });

      if (error) {
        setSaveError(error.message);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch {
      setSaveError('Failed to update public profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const profileSlug = username.trim().toLowerCase();
  const profileUrl = profileSlug ? `${origin}${ROUTES.PUBLIC_PROFILE(profileSlug)}` : '';

  const handleCopyLink = () => {
    if (!profileUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(profileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <section
      aria-label="Public Scholar Profile Settings"
      className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
              <Globe className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              Public Scholar Profile
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-sans max-w-xl">
            Opt into an illuminated public scholar page (<code className="font-mono text-primary">/u/[username]</code>) to share your literary motto, pinned Ex-Libris bookplates, and reading achievements.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPublic ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-success/10 text-success border border-success/20">
              <Eye className="w-3.5 h-3.5" />
              <span>Public Sanctuary</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-muted text-muted-foreground border border-border">
              <Lock className="w-3.5 h-3.5" />
              <span>Private Sanctuary</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Master Public Profile Toggle */}
        <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label
              htmlFor="public-profile-toggle"
              className="text-sm font-serif font-bold text-foreground flex items-center gap-2 cursor-pointer"
            >
              {isPublic ? <Eye className="w-4 h-4 text-success" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <span>Enable Public Scholar Profile</span>
            </label>
            <p className="text-xs text-muted-foreground font-sans">
              When disabled, visiting your profile URL renders the classical Private Sanctuary shield.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              id="public-profile-toggle"
              type="checkbox"
              role="switch"
              aria-checked={isPublic}
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>

        {/* Scholar Handle & Bio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Username Configuration */}
          <div className="lg:col-span-6 space-y-2">
            <label
              htmlFor="scholar-username-input"
              className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground"
            >
              Scholar Handle (@username)
            </label>
            <div className="relative">
              <Input
                id="scholar-username-input"
                type="text"
                placeholder="e.g. jane_austen"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                icon={<AtSign className="w-4 h-4" />}
                className="font-mono text-sm"
                aria-invalid={Boolean(usernameError)}
                aria-describedby={usernameError ? 'username-error-desc' : undefined}
              />
            </div>
            {usernameError && (
              <p id="username-error-desc" className="text-xs font-mono text-destructive">
                {usernameError}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground font-sans">
              3–30 characters: letters, numbers, underscores, and hyphens. Case-insensitive.
            </p>
          </div>

          {/* Shareable Link Preview & Copy */}
          <div className="lg:col-span-6 space-y-2">
            <span className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Public Sanctuary URL
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-foreground truncate select-all">
                {profileSlug ? (
                  <span>{ROUTES.PUBLIC_PROFILE(profileSlug)}</span>
                ) : (
                  <span className="text-muted-foreground italic">Set a handle to generate link</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                disabled={!profileSlug}
                aria-label="Copy public profile URL"
                className="shrink-0 font-mono text-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-success" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
              {profileSlug && (
                <Link
                  href={ROUTES.PUBLIC_PROFILE(profileSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  title="Preview Public Profile"
                  aria-label="Preview public profile in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans flex items-center gap-1">
              <Shield className="w-3 h-3 text-primary shrink-0" />
              <span>Zero PII: Your email and password are never exposed publicly.</span>
            </p>
          </div>
        </div>

        {/* Scholar Bio / Motto */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="scholar-bio-input"
              className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground"
            >
              Scholar Bio & Literary Motto
            </label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {bio.length}/200
            </span>
          </div>
          <textarea
            id="scholar-bio-input"
            rows={3}
            maxLength={200}
            placeholder="A brief reflection, favorite literary era, or personal reading motto..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent resize-none transition-colors"
          />
        </div>

        {/* Granular Privacy Toggles */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Telemetry & Accomplishment Visibility</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Show Reading Streak */}
            <label className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showStreak}
                onChange={(e) => setShowStreak(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Reading Streak</span>
                </span>
                <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                  Display active reading streak & days
                </p>
              </div>
            </label>

            {/* Show Annual Challenge */}
            <label className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showChallenge}
                onChange={(e) => setShowChallenge(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Annual Goal</span>
                </span>
                <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                  Display yearly reading goal progress
                </p>
              </div>
            </label>

            {/* Show General Saved Books */}
            <label className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showSavedBooks}
                onChange={(e) => setShowSavedBooks(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Saved Works</span>
                </span>
                <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                  Display general saved books shelf
                </p>
              </div>
            </label>

            {/* Show Custom Bookshelves */}
            <label className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showCustomShelves}
                onChange={(e) => setShowCustomShelves(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5">
                  <Library className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Custom Shelves</span>
                </span>
                <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                  Display public curated bookshelves
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Feedback Messages & Submit Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border">
          <div className="text-xs font-mono">
            {saveError && <p className="text-destructive font-medium">{saveError}</p>}
            {saveSuccess && (
              <p className="text-success font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Scholar profile preferences saved successfully.</span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSaving || Boolean(usernameError)}
            className="font-mono text-xs uppercase self-end sm:self-auto"
          >
            {isSaving ? 'Saving Profile...' : 'Save Public Settings'}
          </Button>
        </div>
      </form>
    </section>
  );
};
