'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Share2,
  Check,
  Calendar,
  Flame,
  Target,
  BookOpen,
  Library,
  BookMarked,
  Shield,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/Button';
import { PrivateProfileNotice } from '@/components/profile/PrivateProfileNotice';
import { PinnedAccoladesShelf, type PinnedBookplateItem } from '@/components/profile/PinnedAccoladesShelf';

export interface PublicScholarProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  is_public: boolean;
  show_streak: boolean;
  show_challenge: boolean;
  show_bookshelves: boolean;
  show_saved_books?: boolean;
  show_custom_shelves?: boolean;
  created_at: string;
}

export interface PublicReadingHabits {
  current_streak: number;
  longest_streak: number;
  active_days: number;
  annual_goal: number;
  completed_books_count: number;
}

export interface PublicBookshelfItem {
  book_id: number;
  book_title: string;
  book_authors: string[];
  cover_url?: string;
}

export interface PublicBookshelfWithItems {
  id: string;
  name: string;
  description?: string | null;
  items: PublicBookshelfItem[];
}

export interface PublicProfileViewProps {
  profile: PublicScholarProfile;
  pinnedAccolades?: PinnedBookplateItem[];
  habits?: PublicReadingHabits | null;
  bookshelves?: PublicBookshelfWithItems[];
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  profile,
  pinnedAccolades = [],
  habits = null,
  bookshelves = [],
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  // Strict Opt-In Protection: If not public, render classical Private Sanctuary
  if (!profile.is_public) {
    return <PrivateProfileNotice username={profile.username || undefined} />;
  }

  // Safe zero-PII display name resolution (never display an email)
  const displayName = profile.display_name?.trim() || (profile.username ? `@${profile.username}` : 'Bookarium Scholar');
  const handle = profile.username ? `@${profile.username}` : null;

  // Format member-since date
  const memberSince = (() => {
    try {
      const date = new Date(profile.created_at);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return 'Ancient Scholar';
    }
  })();

  // Generate Monogram Initials
  const initials = (() => {
    if (profile.display_name?.trim()) {
      const parts = profile.display_name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (profile.username?.trim()) {
      return profile.username.trim().slice(0, 2).toUpperCase();
    }
    return 'BS';
  })();

  const handleShare = () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const hasTelemetry =
    (profile.show_streak && habits && habits.current_streak >= 0) ||
    (profile.show_challenge && habits && habits.annual_goal > 0);

  return (
    <article
      aria-label={`${displayName} Public Scholar Profile`}
      className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-8"
    >
      {/* Scholar Identity Header Card */}
      <header className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-booksaw relative overflow-hidden">
        {/* Subtle illuminated accent glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar & Core Metadata */}
          <div className="flex items-start sm:items-center gap-4 sm:gap-6 min-w-0">
            {/* Monogram Seal Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/15 to-muted/40 border border-primary/20 text-primary flex items-center justify-center font-serif font-bold text-xl sm:text-2xl shadow-inner shrink-0 select-none">
              {initials}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground truncate">
                  {displayName}
                </h1>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  <Globe className="w-3 h-3" />
                  <span>Public Scholar</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
                {handle && (
                  <span className="text-primary font-bold">
                    {handle}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Scholar since {memberSince}</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                  <Shield className="w-3 h-3 text-success shrink-0" />
                  <span>Verified Domain</span>
                </span>
              </div>
            </div>
          </div>

          {/* Share Profile Button */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              aria-label="Share scholar profile link"
              className="font-mono text-xs uppercase flex items-center gap-1.5"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-success" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Profile</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scholar Bio / Motto */}
        {profile.bio && (
          <div className="mt-6 pt-5 border-t border-border/80">
            <p className="font-serif italic text-sm sm:text-base text-foreground/90 max-w-3xl leading-relaxed">
              &ldquo;{profile.bio}&rdquo;
            </p>
          </div>
        )}
      </header>

      {/* Reading Telemetry & Milestone Progress (Controlled by Privacy Toggles) */}
      {hasTelemetry && (
        <section aria-label="Reading Milestones & Telemetry" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reading Streak Card */}
          {profile.show_streak && habits && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-booksaw space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-serif font-bold text-foreground">
                    Reading Consistency
                  </h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground">Habit Tracking</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                  <p className="text-2xl font-serif font-bold text-amber-600 dark:text-amber-400">
                    {habits.current_streak}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
                    Current Streak
                  </p>
                </div>
                <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {habits.longest_streak}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
                    Longest Streak
                  </p>
                </div>
                <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {habits.active_days}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
                    Active Days
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Annual Reading Goal Card */}
          {profile.show_challenge && habits && habits.annual_goal > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-booksaw space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-serif font-bold text-foreground">
                    Annual Reading Challenge
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold text-primary">
                  {Math.min(100, Math.round((habits.completed_books_count / habits.annual_goal) * 100))}%
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Volumes Read</span>
                  <span className="font-bold text-foreground">
                    {habits.completed_books_count} / {habits.annual_goal}
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/60">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((habits.completed_books_count / habits.annual_goal) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Pinned Accolades Shelf Showcase */}
      <PinnedAccoladesShelf pinnedItems={pinnedAccolades} />

      {/* Curated Public Bookshelves (Controlled by show_bookshelves) */}
      {profile.show_bookshelves && (
        <section aria-label="Curated Public Bookshelves" className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                <Library className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">
                Public Bookshelves & Preserved Works
              </h2>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {bookshelves.length} {bookshelves.length === 1 ? 'Shelf' : 'Shelves'}
            </span>
          </div>

          {bookshelves.length > 0 ? (
            <div className="space-y-6">
              {bookshelves.map((shelf) => (
                <div
                  key={shelf.id}
                  className="bg-card border border-border rounded-2xl p-6 shadow-booksaw space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                        <BookMarked className="w-4 h-4 text-primary" />
                        <span>{shelf.name}</span>
                      </h3>
                      {shelf.description && (
                        <p className="text-xs text-muted-foreground font-sans">{shelf.description}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-muted border border-border">
                      {shelf.items.length} {shelf.items.length === 1 ? 'book' : 'books'}
                    </span>
                  </div>

                  {shelf.items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                      {shelf.items.map((item) => (
                        <div
                          key={`item-${shelf.id}-${item.book_id}`}
                          className="group border border-border rounded-xl p-4 bg-muted/20 hover:bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <h4 className="font-serif font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                              {item.book_title}
                            </h4>
                            <p className="text-xs font-sans text-muted-foreground truncate">
                              {item.book_authors.length > 0 ? item.book_authors.join(', ') : 'Anonymous'}
                            </p>
                          </div>

                          <Link
                            href={ROUTES.READ(item.book_id)}
                            className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-mono bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Read Work</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-serif italic text-muted-foreground pt-2">
                      This shelf contains no public volumes yet.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-muted/10">
              <p className="text-sm font-serif italic text-muted-foreground">
                No public bookshelves published by this scholar yet.
              </p>
            </div>
          )}
        </section>
      )}
    </article>
  );
};

