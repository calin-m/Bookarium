'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
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
  Layers,
  AtSign,
  Sparkles,
  User as UserIcon,
  Mail,
  Pencil,
  Highlighter,
  BookOpen,
  X,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';
import { useAuthStore, validateUsername } from '@/stores/useAuthStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ROUTES } from '@/config/routes';
import { SCHOLAR_BIO_MAX_LENGTH } from '@/config/site-config';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import type { SelectedHighlightMotto } from '@/components/account/HighlightBioPickerModal';

const HighlightBioPickerModal = dynamic(
  () =>
    import('@/components/account/HighlightBioPickerModal').then(
      (mod) => mod.HighlightBioPickerModal
    ),
  { ssr: false }
);

export interface AccountPublicProfileSectionProps {
  user: User;
  profile: Profile | null;
  onUpdateProfile?: (updates: {
    display_name?: string;
    username?: string | null;
    bio?: string | null;
    bio_book_id?: number | null;
    bio_book_title?: string | null;
    bio_book_author?: string | null;
    is_public?: boolean;
    show_streak?: boolean;
    show_challenge?: boolean;
    show_bookshelves?: boolean;
    show_saved_books?: boolean;
    show_custom_shelves?: boolean;
  }) => Promise<{ error: Error | null }>;
}

interface ProfileFormState {
  displayName: string;
  username: string;
  bio: string;
  bioBookId: number | null;
  bioBookTitle: string | null;
  bioBookAuthor: string | null;
  isPublic: boolean;
  showStreak: boolean;
  showChallenge: boolean;
  showSavedBooks: boolean;
  showCustomShelves: boolean;
}

function resolveBaselineProfileState(user: User, profile: Profile | null): ProfileFormState {
  const fallbackDisplayName =
    typeof user?.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : '';
  const validBookId =
    typeof profile?.bio_book_id === 'number' &&
    Number.isInteger(profile.bio_book_id) &&
    profile.bio_book_id > 0
      ? profile.bio_book_id
      : null;

  return {
    displayName: profile?.display_name ?? fallbackDisplayName ?? '',
    username: profile?.username || '',
    bio: profile?.bio || '',
    bioBookId: validBookId,
    bioBookTitle: validBookId ? profile?.bio_book_title || null : null,
    bioBookAuthor: validBookId ? profile?.bio_book_author || null : null,
    isPublic: profile?.is_public ?? false,
    showStreak: profile?.show_streak ?? true,
    showChallenge: profile?.show_challenge ?? true,
    showSavedBooks: profile?.show_saved_books ?? profile?.show_bookshelves ?? true,
    showCustomShelves: profile?.show_custom_shelves ?? profile?.show_bookshelves ?? true,
  };
}

export const AccountPublicProfileSection: React.FC<AccountPublicProfileSectionProps> = ({
  user,
  profile,
  onUpdateProfile,
}) => {
  const defaultUpdateProfile = useAuthStore((s) => s.updateProfile);
  const updateFn = onUpdateProfile || defaultUpdateProfile;
  const { isOffline } = useNetworkStatus();

  const [draft, setDraft] = useState<ProfileFormState>(() =>
    resolveBaselineProfileState(user, profile)
  );
  const [committedProfile, setCommittedProfile] = useState<ProfileFormState>(() =>
    resolveBaselineProfileState(user, profile)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);

  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) {
    setPrevProfile(profile);
    const nextBaseline = resolveBaselineProfileState(user, profile);
    setCommittedProfile(nextBaseline);
    setDraft(nextBaseline);
  }

  const handleUsernameChange = (val: string) => {
    setDraft((prev) => ({ ...prev, username: val }));
    const trimmed = val.trim();
    if (trimmed.length > 0) {
      const res = validateUsername(trimmed);
      setUsernameError(res.isValid ? null : res.error);
    } else {
      setUsernameError(null);
    }
  };

  const handleEnterEdit = () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsHighlightPickerOpen(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(committedProfile);
    setUsernameError(null);
    setSaveError(null);
    setIsHighlightPickerOpen(false);
    setIsEditing(false);
  };

  const handleBioChange = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      bio: value,
      // Any manual edit switches to custom prose and clears linked book attribution
      bioBookId: null,
      bioBookTitle: null,
      bioBookAuthor: null,
    }));
  };

  const handleSelectHighlightMotto = (selection: SelectedHighlightMotto) => {
    setDraft((prev) => ({
      ...prev,
      bio: selection.bio,
      bioBookId: selection.bookId,
      bioBookTitle: selection.bookTitle,
      bioBookAuthor: selection.bookAuthor,
    }));
  };

  const handleClearBioAttribution = () => {
    setDraft((prev) => ({
      ...prev,
      bioBookId: null,
      bioBookTitle: null,
      bioBookAuthor: null,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    setSaveError(null);
    setSaveSuccess(false);

    const trimmedDisplayName = draft.displayName.trim();
    if (!trimmedDisplayName) {
      setSaveError('Display name is required.');
      return;
    }

    const trimmedUsername = draft.username.trim();
    if (draft.isPublic && !trimmedUsername) {
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

    const trimmedBio = draft.bio.trim().slice(0, SCHOLAR_BIO_MAX_LENGTH) || null;
    const hasValidAttribution = Boolean(
      trimmedBio &&
        draft.bioBookId &&
        Number.isInteger(draft.bioBookId) &&
        draft.bioBookId > 0
    );

    setIsSaving(true);
    try {
      const { error } = await updateFn({
        display_name: trimmedDisplayName,
        username: trimmedUsername || null,
        bio: trimmedBio,
        bio_book_id: hasValidAttribution ? draft.bioBookId : null,
        bio_book_title: hasValidAttribution ? draft.bioBookTitle : null,
        bio_book_author: hasValidAttribution ? draft.bioBookAuthor : null,
        is_public: draft.isPublic,
        show_streak: draft.showStreak,
        show_challenge: draft.showChallenge,
        show_bookshelves: draft.showSavedBooks || draft.showCustomShelves,
        show_saved_books: draft.showSavedBooks,
        show_custom_shelves: draft.showCustomShelves,
      });

      if (error) {
        setSaveError(error.message);
      } else {
        const committedState: ProfileFormState = {
          ...draft,
          displayName: trimmedDisplayName,
          username: trimmedUsername,
          bio: trimmedBio || '',
          bioBookId: hasValidAttribution ? draft.bioBookId : null,
          bioBookTitle: hasValidAttribution ? draft.bioBookTitle : null,
          bioBookAuthor: hasValidAttribution ? draft.bioBookAuthor : null,
        };
        setCommittedProfile(committedState);
        setDraft(committedState);
        setIsHighlightPickerOpen(false);
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch {
      setSaveError('Failed to update scholar profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const profileSlug = draft.username.trim().toLowerCase();
  const profileUrl = profileSlug ? `${origin}${ROUTES.PUBLIC_PROFILE(profileSlug)}` : '';

  const handleCopyLink = () => {
    if (!profileUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(profileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const visibilityItems = [
    {
      id: 'streak' as const,
      label: 'Reading Streak',
      description: 'Display active reading streak & days',
      checked: draft.showStreak,
      icon: <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />,
      onToggle: (checked: boolean) => setDraft((prev) => ({ ...prev, showStreak: checked })),
    },
    {
      id: 'challenge' as const,
      label: 'Annual Goal',
      description: 'Display yearly reading goal progress',
      checked: draft.showChallenge,
      icon: <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />,
      onToggle: (checked: boolean) => setDraft((prev) => ({ ...prev, showChallenge: checked })),
    },
    {
      id: 'saved_books' as const,
      label: 'Saved Works',
      description: 'Display general saved books shelf',
      checked: draft.showSavedBooks,
      icon: <Library className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />,
      onToggle: (checked: boolean) => setDraft((prev) => ({ ...prev, showSavedBooks: checked })),
    },
    {
      id: 'custom_shelves' as const,
      label: 'Custom Shelves',
      description: 'Display public curated bookshelves',
      checked: draft.showCustomShelves,
      icon: <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" aria-hidden="true" />,
      onToggle: (checked: boolean) =>
        setDraft((prev) => ({ ...prev, showCustomShelves: checked })),
    },
  ];

  return (
    <section
      id="scholar-profile-section"
      aria-label="Scholar Profile Settings"
      className="bg-card border border-border rounded-3xl p-5 sm:p-6 lg:p-8 shadow-xs space-y-6"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-border text-primary flex items-center justify-center shadow-xs shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              Scholar Profile
            </h2>
            {draft.isPublic ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-success/10 text-success border border-border whitespace-nowrap">
                <Eye className="w-3 h-3" />
                <span>Public Sanctuary</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-muted text-muted-foreground border border-border whitespace-nowrap">
                <Lock className="w-3 h-3" />
                <span>Private Sanctuary</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-sans max-w-2xl">
            Manage your scholar identity and control what appears on your separate public showcase (<code className="font-mono text-primary">/u/[username]</code>). Account email and private settings stay strictly on this private dashboard.
          </p>
        </div>

        {draft.isPublic && profileSlug && (
          <Link
            href={ROUTES.PUBLIC_PROFILE(profileSlug)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${ROUTES.PUBLIC_PROFILE(profileSlug)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-mono font-semibold text-foreground transition-colors self-start sm:self-center shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>Public View</span>
          </Link>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Two 2-Column Identity & Address Rows + Full-Width Bio */}
        <div className="space-y-5">
          {/* Row 1: Display Name + Account Email (Private) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Display Name */}
            <div className="space-y-1.5 min-w-0">
              {isEditing ? (
                <>
                  <label
                    htmlFor="scholar-display-name"
                    className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Display Name
                  </label>
                  <Input
                    id="scholar-display-name"
                    type="text"
                    value={draft.displayName}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    placeholder="Your reading pen name"
                    icon={<UserIcon className="w-4 h-4" />}
                    className="font-mono text-sm"
                    required
                  />
                </>
              ) : (
                <>
                  <span className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    Display Name
                  </span>
                  <div
                    data-testid="scholar-display-name-indicator"
                    className="min-h-[42px] rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 flex items-center gap-2.5 text-sm font-mono text-foreground"
                  >
                    <UserIcon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    {draft.displayName.trim() ? (
                      <span className="truncate">{draft.displayName.trim()}</span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Not set</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Account Email (Private) */}
            <div className="space-y-1.5 min-w-0">
              {isEditing ? (
                <>
                  <label
                    htmlFor="scholar-private-email"
                    className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Account Email (Private)
                  </label>
                  <Input
                    id="scholar-private-email"
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    className="font-mono text-xs opacity-75 bg-muted cursor-not-allowed"
                  />
                </>
              ) : (
                <>
                  <span className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    Account Email (Private)
                  </span>
                  <div
                    data-testid="scholar-private-email-indicator"
                    className="min-h-[42px] rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-mono text-foreground"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Mail
                        className="w-4 h-4 text-muted-foreground shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{user?.email || 'No email linked'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border shrink-0">
                      <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>Private</span>
                    </span>
                  </div>
                </>
              )}
              <p className="text-[11px] text-muted-foreground font-sans flex items-center gap-1">
                <Lock className="w-3 h-3 text-primary shrink-0" />
                <span>Private — never displayed on /u/[username].</span>
              </p>
            </div>
          </div>

          {/* Row 2: Scholar Handle (@username) + Public Sanctuary URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Scholar Handle */}
            <div className="space-y-1.5 min-w-0">
              {isEditing ? (
                <>
                  <label
                    htmlFor="scholar-username-input"
                    className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Scholar Handle (@username)
                  </label>
                  <Input
                    id="scholar-username-input"
                    type="text"
                    placeholder="e.g. jane_austen"
                    value={draft.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    disabled={isOffline}
                    icon={<AtSign className="w-4 h-4" />}
                    className="font-mono text-sm"
                    aria-invalid={Boolean(usernameError)}
                    aria-describedby={usernameError ? 'username-error-desc' : undefined}
                  />
                  {isOffline && (
                    <p
                      data-testid="username-offline-hint"
                      className="text-xs font-mono text-muted-foreground"
                    >
                      Username changes require an internet connection to verify handle availability.
                    </p>
                  )}
                  {usernameError && (
                    <p id="username-error-desc" className="text-xs font-mono text-destructive">
                      {usernameError}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground font-sans">
                    3–30 characters: letters, numbers, underscores, and hyphens. Case-insensitive.
                  </p>
                </>
              ) : (
                <>
                  <span className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    Scholar Handle (@username)
                  </span>
                  <div
                    data-testid="scholar-username-indicator"
                    className="min-h-[42px] rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 flex items-center gap-2 text-sm font-mono text-foreground"
                  >
                    <AtSign className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    {profileSlug ? (
                      <span className="truncate">{draft.username.trim()}</span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        No handle claimed yet
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Shareable Public Sanctuary URL (Interactive in both View and Edit states) */}
            <div className="space-y-1.5 min-w-0">
              <span className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Public Sanctuary URL
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 min-h-[42px] bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-foreground truncate select-all flex items-center">
                  {profileSlug ? (
                    <span className="truncate">{ROUTES.PUBLIC_PROFILE(profileSlug)}</span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Set a handle to generate link
                    </span>
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
                    className="inline-flex items-center justify-center p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
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

          {/* Row 3 (Full Width): Scholar Bio & Literary Motto */}
          <div className="space-y-1.5">
            {isEditing ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="scholar-bio-input"
                    className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Scholar Bio & Literary Motto
                  </label>
                  <div className="flex items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsHighlightPickerOpen(true)}
                      data-testid="pick-highlight-bio-btn"
                      className="font-mono text-xs h-7 px-2.5"
                    >
                      <Highlighter className="w-3.5 h-3.5 mr-1.5 text-primary" aria-hidden="true" />
                      <span>Pick from Highlights</span>
                    </Button>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {draft.bio.length}/{SCHOLAR_BIO_MAX_LENGTH}
                    </span>
                  </div>
                </div>
                <Textarea
                  id="scholar-bio-input"
                  rows={3}
                  maxLength={SCHOLAR_BIO_MAX_LENGTH}
                  placeholder="Write a custom bio, literary motto, or pick a saved highlight..."
                  value={draft.bio}
                  onChange={(e) => handleBioChange(e.target.value)}
                />
                {draft.bioBookId && draft.bio.trim() && (
                  <div
                    data-testid="scholar-bio-attribution-edit-pill"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-primary/5 px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-1.5 text-foreground min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                      <span className="truncate font-sans">
                        Highlighted from{' '}
                        <span className="font-serif font-bold">
                          &ldquo;{draft.bioBookTitle || `Volume #${draft.bioBookId}`}&rdquo;
                        </span>
                        {draft.bioBookAuthor ? ` by ${draft.bioBookAuthor}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearBioAttribution}
                      aria-label="Remove highlighted book link"
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                      <span>Remove book link</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="block text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  Scholar Bio & Literary Motto
                </span>
                <div
                  data-testid="scholar-bio-indicator"
                  className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm font-sans text-foreground/90 leading-relaxed min-h-[72px] space-y-2"
                >
                  {draft.bio.trim() ? (
                    <>
                      <p className="whitespace-pre-line">{draft.bio.trim()}</p>
                      {draft.bioBookId && (
                        <p
                          data-testid="scholar-bio-source-indicator"
                          className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/60"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                          <span>
                            From{' '}
                            <span className="font-serif font-semibold text-foreground">
                              {draft.bioBookTitle || `Volume #${draft.bioBookId}`}
                            </span>
                            {draft.bioBookAuthor ? ` by ${draft.bioBookAuthor}` : ''}
                          </span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground italic text-xs">
                      No literary motto or scholar bio added yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Public Sanctuary & Granular Visibility Indicators / Controls */}
        <div className="pt-6 border-t border-border space-y-4">
          {isEditing ? (
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <label
                  htmlFor="public-profile-toggle"
                  className="text-sm font-serif font-bold text-foreground flex items-center gap-2 cursor-pointer"
                >
                  {draft.isPublic ? (
                    <Eye className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span>Enable Public Scholar Profile</span>
                </label>
                <p className="text-xs text-muted-foreground font-sans">
                  When disabled, visiting your public URL renders the Private Sanctuary shield.
                </p>
              </div>

              <Switch
                id="public-profile-toggle"
                mode="checkbox"
                checked={draft.isPublic}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, isPublic: checked }))
                }
              />
            </div>
          ) : (
            <div
              data-testid="public-profile-status-indicator"
              className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 flex items-center justify-between gap-4"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="text-sm font-serif font-bold text-foreground flex items-center gap-2">
                  {draft.isPublic ? (
                    <Eye className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                  ) : (
                    <EyeOff
                      className="w-4 h-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>Public Scholar Profile</span>
                </div>
                <p className="text-xs text-muted-foreground font-sans">
                  {draft.isPublic
                    ? 'Visible to readers via your public sanctuary link.'
                    : 'When disabled, visiting your public URL renders the Private Sanctuary shield.'}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border shrink-0 whitespace-nowrap ${
                  draft.isPublic
                    ? 'bg-success/10 text-success border-border'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {draft.isPublic ? (
                  <>
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Publicly Visible</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Private Shield</span>
                  </>
                )}
              </span>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Telemetry & Accomplishment Visibility</span>
            </h3>

            {isEditing ? (
              <div className="space-y-2.5">
                {visibilityItems.map((item) => (
                  <label
                    key={item.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-start sm:items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onToggle(e.target.checked)}
                      className="mt-0.5 sm:mt-0 rounded border-border text-primary focus:ring-primary/20 shrink-0"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 flex-1 min-w-0">
                      <span className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5">
                        {item.icon}
                        <span>{item.label}</span>
                      </span>
                      <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                        {item.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div
                data-testid="sanctuary-visibility-indicators"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {visibilityItems.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`visibility-indicator-${item.id}`}
                    className="p-3 sm:p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-serif font-bold text-foreground flex items-center gap-2 min-w-0">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border shrink-0 ${
                        item.checked
                          ? 'bg-success/10 text-success border-border'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {item.checked ? (
                        <>
                          <Eye className="w-3 h-3" aria-hidden="true" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" aria-hidden="true" />
                          <span>Hidden</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feedback Messages & Footer-Only Edit / Cancel + Save Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border">
          <div className="text-xs font-mono">
            {saveError && <p className="text-destructive font-medium">{saveError}</p>}
            {saveSuccess && (
              <p className="text-success font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Scholar profile saved successfully.</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {isEditing ? (
              <>
                <Button
                  key="profile-cancel-button"
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isSaving}
                  onClick={handleCancelEdit}
                  className="font-mono text-xs uppercase"
                >
                  Cancel
                </Button>
                <Button
                  key="profile-save-button"
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSaving || Boolean(usernameError)}
                  className="font-mono text-xs uppercase"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button
                key="profile-edit-button"
                type="button"
                variant="outline"
                size="md"
                onClick={handleEnterEdit}
                className="font-mono text-xs uppercase"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                <span>Edit</span>
              </Button>
            )}
          </div>
        </div>
      </form>

      {isEditing && isHighlightPickerOpen && (
        <HighlightBioPickerModal
          isOpen={isHighlightPickerOpen}
          onClose={() => setIsHighlightPickerOpen(false)}
          currentBio={draft.bio}
          currentBookId={draft.bioBookId}
          onSelectHighlight={handleSelectHighlightMotto}
        />
      )}
    </section>
  );
};
