'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAccoladesStore } from '@/stores/useAccoladesStore';
import { useHabitsStore } from '@/stores/useHabitsStore';
import { ROUTES } from '@/config/routes';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';
import {
  calculateCompletedBooksCount,
  resolvePublicReadingHabits,
  type HabitTelemetryRow,
} from '@/lib/reading-analytics';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { PrivateProfileNotice } from '@/components/profile/PrivateProfileNotice';
import {
  PublicProfileView,
  type PublicScholarProfile,
  type PublicReadingHabits,
  type PublicBookshelfWithItems,
  type PublicBookshelfItem,
} from '@/components/profile/PublicProfileView';
import type { PinnedBookplateItem } from '@/components/profile/PinnedAccoladesShelf';

export default function PublicScholarProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawUsername = params?.username;
  const usernameParam = typeof rawUsername === 'string' ? rawUsername : Array.isArray(rawUsername) ? rawUsername[0] : '';
  const normalizedUsername = decodeURIComponent(usernameParam).toLowerCase().trim();

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<PublicScholarProfile | null>(null);
  const [pinnedAccolades, setPinnedAccolades] = useState<PinnedBookplateItem[]>([]);
  const [habits, setHabits] = useState<PublicReadingHabits | null>(null);
  const [habitRowState, setHabitRowState] = useState<HabitTelemetryRow | null>(null);
  const [bookshelves, setBookshelves] = useState<PublicBookshelfWithItems[]>([]);

  const authUserId = useAuthStore((s) => s.user?.id);
  const bookStatuses = useBookshelfStore((s) => s.bookStatuses);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const localActiveDates = useHabitsStore((s) => s.activeDates);
  const localAnnualGoal = useHabitsStore((s) => s.annualGoal);

  useEffect(() => {
    let isCancelled = false;

    async function loadScholarProfile() {
      if (!normalizedUsername) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const supabase = createClient();

        // 1. Fetch public scholar profile
        const { data: profileRow, error: _profileErr } = await supabase
          .from('profiles')
          .select('id, display_name, username, bio, is_public, show_streak, show_challenge, show_bookshelves, show_saved_books, show_custom_shelves, created_at')
          .ilike('username', normalizedUsername)
          .eq('is_public', true)
          .maybeSingle();

        let resolvedProfile: PublicScholarProfile | null = profileRow as PublicScholarProfile | null;

        // Offline / Session fallback: Check if logged-in user matches this profile
        if (!resolvedProfile) {
          const authProfile = useAuthStore.getState().profile;
          if (
            authProfile &&
            authProfile.username?.toLowerCase() === normalizedUsername &&
            authProfile.is_public
          ) {
            resolvedProfile = {
              id: authProfile.id,
              display_name: authProfile.display_name,
              username: authProfile.username,
              bio: authProfile.bio,
              is_public: authProfile.is_public,
              show_streak: authProfile.show_streak,
              show_challenge: authProfile.show_challenge,
              show_bookshelves: authProfile.show_bookshelves,
              show_saved_books: authProfile.show_saved_books ?? authProfile.show_bookshelves ?? true,
              show_custom_shelves: authProfile.show_custom_shelves ?? authProfile.show_bookshelves ?? true,
              created_at: authProfile.created_at,
            };
          }
        }

        if (isCancelled) return;

        if (!resolvedProfile || !resolvedProfile.is_public) {
          setProfile(null);
          setIsLoading(false);
          if (typeof document !== 'undefined') {
            document.title = 'Scholar Sanctuary Not Found • Bookarium';
          }
          return;
        }

        setProfile(resolvedProfile);

        // Update document title dynamically
        const titleName = resolvedProfile.display_name || `@${resolvedProfile.username}`;
        if (typeof document !== 'undefined') {
          document.title = `${titleName} (@${resolvedProfile.username}) • Bookarium Scholar`;
        }

        const authUser = useAuthStore.getState().user;
        const toPinnedBookplateItem = (
          accId: string,
          unlockedAt?: string,
          isUnlocked = true
        ): PinnedBookplateItem | null => {
          const def = ACCOLADES_CATALOG.find((d) => d.id === accId);
          if (!def) return null;
          return {
            definition: def,
            progress: {
              id: def.id,
              isUnlocked,
              unlockedAt,
              isPinned: true,
              current: def.target,
              target: def.target,
              percent: 100,
            },
          };
        };

        // 2. Fetch pinned accolades if profile is found
        const { data: accoladesData } = await supabase
          .from('user_accolades')
          .select('accolade_id, unlocked_at, is_pinned')
          .eq('user_id', resolvedProfile.id)
          .eq('is_pinned', true);

        if (!isCancelled && accoladesData && accoladesData.length > 0) {
          const pinned = accoladesData
            .map((row) => toPinnedBookplateItem(row.accolade_id, row.unlocked_at))
            .filter((item): item is PinnedBookplateItem => item !== null);
          setPinnedAccolades(pinned.slice(0, 3));
        } else if (!isCancelled && authUser?.id === resolvedProfile.id) {
          // Local offline fallback for authenticated user's own pinned accolades
          const localAccolades = useAccoladesStore.getState();
          const pinned = localAccolades.pinnedAccoladeIds
            .map((accId) => {
              const unlocked = localAccolades.unlockedAccolades[accId];
              return toPinnedBookplateItem(accId, unlocked?.unlockedAt, Boolean(unlocked));
            })
            .filter((item): item is PinnedBookplateItem => item !== null);
          setPinnedAccolades(pinned.slice(0, 3));
        }

        // 3. Fetch reading habits if enabled by privacy settings
        if (resolvedProfile.show_streak || resolvedProfile.show_challenge) {
          if (authUser?.id === resolvedProfile.id) {
            useBookshelfStore.getState().syncWithCloud(authUser.id).catch(() => {});
            useReaderStore.getState().syncWithCloud(authUser.id).catch(() => {});
          }

          const { data: habitRow } = await supabase
            .from('user_reading_habits')
            .select('*')
            .eq('user_id', resolvedProfile.id)
            .maybeSingle();

          if (!isCancelled) {
            const isOwnProfile = authUser?.id === resolvedProfile.id;
            const localCompleted = isOwnProfile
              ? calculateCompletedBooksCount(
                  useBookshelfStore.getState().bookStatuses,
                  useReaderStore.getState().readingProgress
                )
              : undefined;
            const localHabits = useHabitsStore.getState();
            const typedHabitRow = (habitRow as HabitTelemetryRow | null) ?? null;

            setHabitRowState(typedHabitRow);
            setHabits(
              resolvePublicReadingHabits(
                typedHabitRow,
                isOwnProfile
                  ? {
                      activeDates: localHabits.activeDates,
                      annualGoal: localHabits.annualGoal,
                      localCompletedBooksCount: localCompleted,
                    }
                  : undefined
              )
            );
          }
        }

        // 4. Fetch public bookshelves if enabled
        const showSavedBooks = resolvedProfile.show_saved_books ?? resolvedProfile.show_bookshelves ?? true;
        const showCustomShelves = resolvedProfile.show_custom_shelves ?? resolvedProfile.show_bookshelves ?? true;
        const isShelfEligible = (s: { is_default: boolean; is_public?: boolean | null }) =>
          (s.is_default ? showSavedBooks : showCustomShelves) && s.is_public !== false;
        const normalizeItemAuthors = (raw: unknown): string[] =>
          Array.isArray(raw)
            ? raw
                .map((a: unknown) =>
                  typeof a === 'string' ? a : (a as { name?: string })?.name || ''
                )
                .filter(Boolean)
            : [];

        if (showSavedBooks || showCustomShelves) {
          if (authUser?.id === resolvedProfile.id) {
            useBookshelfStore.getState().syncWithCloud(authUser.id).catch(() => {});
          }

          const { data: shelvesData } = await supabase
            .from('bookshelves')
            .select('id, name, is_default, is_public')
            .eq('user_id', resolvedProfile.id)
            .order('created_at', { ascending: true });

          let parsedShelves: PublicBookshelfWithItems[] = [];

          if (shelvesData && shelvesData.length > 0) {
            const eligibleShelves = shelvesData.filter(isShelfEligible);

            if (eligibleShelves.length > 0) {
              const shelfIds = eligibleShelves.map((s) => s.id);
              const { data: itemsData } = await supabase
                .from('bookshelf_items')
                .select('bookshelf_id, book_id, book_title, book_authors')
                .in('bookshelf_id', shelfIds);

              const itemsMap: Record<string, PublicBookshelfItem[]> = {};
              (itemsData || []).forEach((item) => {
                if (!itemsMap[item.bookshelf_id]) itemsMap[item.bookshelf_id] = [];
                itemsMap[item.bookshelf_id].push({
                  book_id: item.book_id,
                  book_title: item.book_title,
                  book_authors: normalizeItemAuthors(item.book_authors),
                });
              });

              parsedShelves = eligibleShelves.map((s) => ({
                id: s.id,
                name: s.name,
                items: itemsMap[s.id] || [],
              }));
            }
          }

          // Fallback if viewing own profile and remote shelves are empty or still syncing
          if (parsedShelves.length === 0 && authUser?.id === resolvedProfile.id) {
            const localStore = useBookshelfStore.getState();
            const filteredLocalShelves = localStore.cloudBookshelves.filter(isShelfEligible);

            if (filteredLocalShelves.length > 0) {
              parsedShelves = filteredLocalShelves.map((s) => ({
                id: s.id,
                name: s.name,
                items: localStore.cloudBookshelfItems
                  .filter((item) => item.bookshelf_id === s.id)
                  .map((item) => ({
                    book_id: item.book_id,
                    book_title: item.book_title,
                    book_authors: normalizeItemAuthors(item.book_authors),
                  })),
              }));
            } else if (showSavedBooks && localStore.savedBooks.length > 0) {
              parsedShelves = [
                {
                  id: 'general-default',
                  name: 'General',
                  items: localStore.savedBooks.map((b) => ({
                    book_id: b.id,
                    book_title: b.title,
                    book_authors: b.authors.map((a) => a.name).filter(Boolean),
                  })),
                },
              ];
            }
          }

          setBookshelves(parsedShelves);
        }
      } catch {
        if (!isCancelled) {
          setProfile(null);
          if (typeof document !== 'undefined') {
            document.title = 'Scholar Sanctuary Not Found • Bookarium';
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadScholarProfile();

    return () => {
      isCancelled = true;
    };
  }, [normalizedUsername]);

  const effectiveHabits = useMemo<PublicReadingHabits | null>(() => {
    if (!profile || (!profile.show_streak && !profile.show_challenge)) {
      return habits;
    }
    if (authUserId && authUserId === profile.id) {
      const localCompleted = calculateCompletedBooksCount(bookStatuses, readingProgress);
      return (
        resolvePublicReadingHabits(habitRowState, {
          activeDates: localActiveDates,
          annualGoal: localAnnualGoal,
          localCompletedBooksCount: localCompleted,
        }) ?? habits
      );
    }
    return habits;
  }, [
    profile,
    habits,
    authUserId,
    habitRowState,
    bookStatuses,
    readingProgress,
    localActiveDates,
    localAnnualGoal,
  ]);

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground transition-colors duration-theme">
      <Navbar
        isVisible={true}
        onViewChange={(view) => {
          router.push(ROUTES.VIEW(view));
        }}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading scholar sanctuary"
            className="max-w-xl mx-auto my-20 p-8 rounded-3xl border border-border bg-card shadow-booksaw text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="font-serif italic text-sm text-muted-foreground">
              Illuminating public scholar sanctuary...
            </p>
          </div>
        ) : profile && profile.is_public ? (
          <PublicProfileView
            profile={profile}
            pinnedAccolades={pinnedAccolades}
            habits={effectiveHabits}
            bookshelves={bookshelves}
          />
        ) : (
          <PrivateProfileNotice />
        )}
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}
