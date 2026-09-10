'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { ROUTES } from '@/config/routes';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { PrivateProfileNotice } from '@/components/profile/PrivateProfileNotice';
import {
  PublicProfileView,
  type PublicScholarProfile,
  type PublicReadingHabits,
  type PublicBookshelfWithItems,
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
  const [bookshelves, setBookshelves] = useState<PublicBookshelfWithItems[]>([]);

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
        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name, username, bio, is_public, show_streak, show_challenge, show_bookshelves, show_saved_books, show_custom_shelves, created_at')
          .ilike('username', normalizedUsername)
          .eq('is_public', true)
          .maybeSingle();

        let resolvedProfile: PublicScholarProfile | null = profileRow as PublicScholarProfile | null;

        // Offline / Session fallback: Check if logged-in user matches this profile
        if (!resolvedProfile && !profileErr) {
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
        const titleName = resolvedProfile.display_name || `@${resolvedProfile.username}` || 'Scholar';
        if (typeof document !== 'undefined') {
          document.title = `${titleName} (@${resolvedProfile.username}) • Bookarium Scholar`;
        }

        // 2. Fetch pinned accolades if profile is found
        const { data: accoladesData } = await supabase
          .from('user_accolades')
          .select('accolade_id, unlocked_at, is_pinned')
          .eq('user_id', resolvedProfile.id)
          .eq('is_pinned', true);

        if (!isCancelled && accoladesData) {
          const pinned: PinnedBookplateItem[] = [];
          for (const row of accoladesData as any[]) {
            const def = ACCOLADES_CATALOG.find((d) => d.id === row.accolade_id);
            if (def) {
              pinned.push({
                definition: def,
                progress: {
                  id: def.id,
                  isUnlocked: true,
                  unlockedAt: row.unlocked_at,
                  isPinned: true,
                  current: def.target,
                  target: def.target,
                  percent: 100,
                },
              });
            }
          }

          setPinnedAccolades(pinned.slice(0, 3));
        }

        // 3. Fetch reading habits if enabled by privacy settings
        if (resolvedProfile.show_streak || resolvedProfile.show_challenge) {
          const { data: habitRow } = await supabase
            .from('user_reading_habits')
            .select('current_streak, longest_streak, active_dates, annual_goal, completed_books_count')
            .eq('user_id', resolvedProfile.id)
            .maybeSingle();

          if (!isCancelled && habitRow) {
            const row = habitRow as any;
            setHabits({
              current_streak: row.current_streak || 0,
              longest_streak: row.longest_streak || 0,
              active_days: Array.isArray(row.active_dates) ? row.active_dates.length : 0,
              annual_goal: row.annual_goal || 0,
              completed_books_count: row.completed_books_count || 0,
            });
          }
        }

        // 4. Fetch public bookshelves if enabled
        const showSavedBooks = resolvedProfile.show_saved_books ?? resolvedProfile.show_bookshelves ?? true;
        const showCustomShelves = resolvedProfile.show_custom_shelves ?? resolvedProfile.show_bookshelves ?? true;

        if (showSavedBooks || showCustomShelves) {
          const authUser = useAuthStore.getState().user;
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
            const eligibleShelves = (shelvesData as any[]).filter((s) => {
              if (s.is_default) {
                return showSavedBooks && s.is_public !== false;
              }
              return showCustomShelves && s.is_public !== false;
            });

            if (eligibleShelves.length > 0) {
              const shelfIds = eligibleShelves.map((s) => s.id);
              const { data: itemsData } = await supabase
                .from('bookshelf_items')
                .select('bookshelf_id, book_id, book_title, book_authors')
                .in('bookshelf_id', shelfIds);

              const itemsMap: Record<string, any[]> = {};
              (itemsData || []).forEach((item: any) => {
                if (!itemsMap[item.bookshelf_id]) itemsMap[item.bookshelf_id] = [];
                const rawAuthors = item.book_authors;
                const authors = Array.isArray(rawAuthors)
                  ? rawAuthors.map((a: any) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean)
                  : [];

                itemsMap[item.bookshelf_id].push({
                  book_id: item.book_id,
                  book_title: item.book_title,
                  book_authors: authors,
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
            const filteredLocalShelves = (localStore.cloudBookshelves || []).filter((s) => {
              if (s.is_default) return showSavedBooks && s.is_public !== false;
              return showCustomShelves && s.is_public !== false;
            });

            if (filteredLocalShelves.length > 0) {
              parsedShelves = filteredLocalShelves.map((s) => ({
                id: s.id,
                name: s.name,
                items: (localStore.cloudBookshelfItems || [])
                  .filter((item) => item.bookshelf_id === s.id)
                  .map((item) => ({
                    book_id: item.book_id,
                    book_title: item.book_title,
                    book_authors: Array.isArray(item.book_authors)
                      ? item.book_authors.map((a: any) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean)
                      : [],
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
                    book_authors: b.authors?.map((a) => a.name).filter(Boolean) || [],
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

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
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
            habits={habits}
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
