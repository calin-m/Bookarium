import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { ReaderCircleRow, SymposiumSessionRow } from '@/types/database.types';

export function isPlaceholderUsername(username?: string | null): boolean {
  if (!username) return true;
  const clean = username.trim().toLowerCase();
  return clean === '' || clean === 'scholar' || clean === 'fellow_scholar';
}

export function formatFellowScholarLabel(
  displayName?: string | null,
  username?: string | null
): string {
  const cleanDisplayName = displayName?.trim();
  const cleanUsername = username?.trim();
  const isPlaceholder = isPlaceholderUsername(cleanUsername);

  if (
    cleanDisplayName &&
    !isPlaceholder &&
    cleanUsername &&
    cleanDisplayName !== cleanUsername
  ) {
    return `${cleanDisplayName} (@${cleanUsername})`;
  }
  if (!isPlaceholder && cleanUsername) {
    return `@${cleanUsername}`;
  }
  return cleanDisplayName || 'Fellow Scholar';
}

export interface AcceptedFellowSummary {
  circleId: string;
  fellowId: string;
  username: string;
  displayName: string;
}

export interface PendingSymposiumProgressUpdate {
  chapterIndex: number;
  progressPct: number;
  status: SymposiumSessionRow['status'];
  isHost: boolean;
  updatedAt: string;
}

export interface FellowshipState {
  circles: ReaderCircleRow[];
  symposiums: SymposiumSessionRow[];
  pendingSymposiumProgress: Record<string, PendingSymposiumProgressUpdate>;
  isLoading: boolean;
  error: string | null;

  fetchFellowshipData: (userId?: string) => Promise<void>;
  syncWithCloud: (userId?: string) => Promise<void>;
  inviteFellowByUsername: (
    username: string
  ) => Promise<{ error: Error | null; circle?: ReaderCircleRow }>;
  inviteFellowByProfile: (recipient: {
    id: string;
    username: string;
    displayName: string;
  }) => Promise<{ error: Error | null; circle?: ReaderCircleRow }>;
  respondToCircleInvite: (
    circleId: string,
    action: 'accept' | 'decline'
  ) => Promise<{ error: Error | null }>;
  removeFellow: (circleId: string) => Promise<{ error: Error | null }>;

  createSymposiumInvite: (params: {
    bookId: number;
    bookTitle: string;
    fellowId: string;
    fellowUsername: string;
    fellowDisplayName: string;
  }) => Promise<{ error: Error | null; session?: SymposiumSessionRow }>;
  respondToSymposiumInvite: (
    sessionId: string,
    action: 'accept' | 'decline'
  ) => Promise<{ error: Error | null }>;
  leaveSymposium: (sessionId: string) => Promise<{ error: Error | null }>;
  syncSymposiumProgress: (
    bookId: number,
    chapterIndex: number,
    progressPct: number
  ) => Promise<void>;

  getAcceptedFellows: (currentUserId?: string) => AcceptedFellowSummary[];
  getPendingInviteCount: (currentUserId?: string) => number;
  getActiveSymposiumForBook: (
    bookId: number,
    currentUserId?: string
  ) => SymposiumSessionRow | undefined;
  clearFellowshipState: () => void;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fellow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function healProfileIdentity(
  profileMap: Map<string, { username: string | null; display_name: string | null }>,
  userId: string,
  currentUsername: string,
  currentDisplayName: string
): [string, string] {
  const p = profileMap.get(userId);
  if (!p) return [currentUsername, currentDisplayName];
  return [
    p.username && isPlaceholderUsername(currentUsername) ? p.username : currentUsername,
    p.display_name || currentDisplayName,
  ];
}

async function resolveSelfScholarIdentity(
  currentUser: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
  currentProfile: ReturnType<typeof useAuthStore.getState>['profile'],
  supabase: ReturnType<typeof createClient>
): Promise<{ myUsername: string; myDisplayName: string }> {
  let myUsername = currentProfile?.username || '';
  let myDisplayName =
    currentProfile?.display_name || currentUser.user_metadata?.display_name || '';

  if (isPlaceholderUsername(myUsername) && supabase) {
    try {
      const { data: selfProf } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (selfProf?.username) myUsername = selfProf.username;
      if (selfProf?.display_name) myDisplayName = selfProf.display_name;
    } catch {
      // Non-blocking fallback
    }
  }
  return {
    myUsername: myUsername || 'scholar',
    myDisplayName: myDisplayName || 'Scholar',
  };
}

export const useFellowshipStore = create<FellowshipState>()(
  persist(
    (set, get) => ({
      circles: [],
      symposiums: [],
      pendingSymposiumProgress: {},
      isLoading: false,
      error: null,

      syncWithCloud: async (explicitUserId) => {
        await get().fetchFellowshipData(explicitUserId);
      },

      fetchFellowshipData: async (explicitUserId) => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

        const authState = useAuthStore.getState();
        const userId = explicitUserId || authState.user?.id;
        if (!userId) return;

        const supabase = createClient();
        if (!supabase) return;

        // Flush any queued offline symposium progress updates before pulling remote rows
        const pendingEntries = Object.entries(get().pendingSymposiumProgress);
        if (pendingEntries.length > 0) {
          const flushedUpdatedAtMap = new Map<string, string>();
          for (const [sessionId, pending] of pendingEntries) {
            try {
              const { error: flushErr } = await supabase
                .from('symposium_sessions')
                .update(
                  pending.isHost
                    ? {
                        host_chapter: pending.chapterIndex,
                        host_progress: pending.progressPct,
                        status: pending.status,
                        updated_at: pending.updatedAt,
                      }
                    : {
                        fellow_chapter: pending.chapterIndex,
                        fellow_progress: pending.progressPct,
                        status: pending.status,
                        updated_at: pending.updatedAt,
                      }
                )
                .eq('id', sessionId);
              if (!flushErr) {
                flushedUpdatedAtMap.set(sessionId, pending.updatedAt);
              }
            } catch {
              // Keep in pendingSymposiumProgress for next retry
            }
          }
          if (flushedUpdatedAtMap.size > 0) {
            set((state) => {
              const nextPending = { ...state.pendingSymposiumProgress };
              flushedUpdatedAtMap.forEach((flushedAt, sessionId) => {
                if (nextPending[sessionId]?.updatedAt === flushedAt) {
                  delete nextPending[sessionId];
                }
              });
              return { pendingSymposiumProgress: nextPending };
            });
          }
        }

        set({ isLoading: true, error: null });
        try {
          const [circlesRes, symposiumsRes] = await Promise.all([
            supabase
              .from('reader_circles')
              .select('*')
              .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
              .order('created_at', { ascending: false }),
            supabase
              .from('symposium_sessions')
              .select('*')
              .or(`host_id.eq.${userId},fellow_id.eq.${userId}`)
              .order('updated_at', { ascending: false }),
          ]);

          const rawCircles = !circlesRes.error && circlesRes.data ? circlesRes.data : get().circles;
          const rawSymposiums =
            !symposiumsRes.error && symposiumsRes.data ? symposiumsRes.data : get().symposiums;

          // Find companion IDs across circles and symposiums to heal stale usernames/names
          const companionIds = new Set<string>();
          for (const c of rawCircles) {
            if (c.requester_id && c.requester_id !== userId) companionIds.add(c.requester_id);
            if (c.recipient_id && c.recipient_id !== userId) companionIds.add(c.recipient_id);
          }
          for (const s of rawSymposiums) {
            if (s.host_id && s.host_id !== userId) companionIds.add(s.host_id);
            if (s.fellow_id && s.fellow_id !== userId) companionIds.add(s.fellow_id);
          }

          let healedCircles = rawCircles;
          let healedSymposiums = rawSymposiums;

          if (companionIds.size > 0) {
            try {
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, username, display_name')
                .in('id', Array.from(companionIds));

              if (Array.isArray(profilesData) && profilesData.length > 0) {
                const profileMap = new Map<
                  string,
                  { username: string | null; display_name: string | null }
                >();
                for (const p of profilesData) {
                  profileMap.set(p.id, { username: p.username, display_name: p.display_name });
                }

                healedCircles = rawCircles.map((c) => {
                  const [reqU, reqD] = healProfileIdentity(
                    profileMap,
                    c.requester_id,
                    c.requester_username,
                    c.requester_display_name
                  );
                  const [recU, recD] = healProfileIdentity(
                    profileMap,
                    c.recipient_id,
                    c.recipient_username,
                    c.recipient_display_name
                  );

                  return {
                    ...c,
                    requester_username: reqU,
                    requester_display_name: reqD,
                    recipient_username: recU,
                    recipient_display_name: recD,
                  };
                });

                healedSymposiums = rawSymposiums.map((s) => {
                  const [hostU, hostD] = healProfileIdentity(
                    profileMap,
                    s.host_id,
                    s.host_username,
                    s.host_display_name
                  );
                  const [fellowU, fellowD] = healProfileIdentity(
                    profileMap,
                    s.fellow_id,
                    s.fellow_username,
                    s.fellow_display_name
                  );

                  return {
                    ...s,
                    host_username: hostU,
                    host_display_name: hostD,
                    fellow_username: fellowU,
                    fellow_display_name: fellowD,
                  };
                });
              }
            } catch {
              // Non-blocking profiles overlay
            }
          }

          set({
            circles: healedCircles,
            symposiums: healedSymposiums,
            isLoading: false,
          });
        } catch (err: unknown) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Unable to synchronize Reader Circle data.',
          });
        }
      },

      inviteFellowByUsername: async (rawUsername) => {
        const cleaned = rawUsername.trim().replace(/^@/, '').toLowerCase();
        if (!cleaned) {
          return { error: new Error('Please enter a valid @username.') };
        }

        const authState = useAuthStore.getState();
        const currentUser = authState.user;
        const currentProfile = authState.profile;
        if (!currentUser) {
          return { error: new Error('Sign in required to invite a Fellow Scholar.') };
        }

        if (currentProfile?.username && currentProfile.username.toLowerCase() === cleaned) {
          return { error: new Error('You cannot invite yourself to your Reader Circle.') };
        }

        const supabase = createClient();
        let targetScholar: { id: string; username: string; displayName: string } | null = null;

        if (supabase) {
          try {
            const { data, error } = await supabase.rpc('lookup_scholar_by_username', {
              target_username: cleaned,
            });
            if (!error && Array.isArray(data) && data.length > 0) {
              targetScholar = {
                id: data[0].id,
                username: data[0].username || cleaned,
                displayName: data[0].display_name || cleaned,
              };
            }
          } catch {
            // Fallback to public profile lookup if RPC is not yet provisioned
          }

          if (!targetScholar) {
            try {
              const { data } = await supabase
                .from('profiles')
                .select('id, username, display_name')
                .ilike('username', cleaned)
                .maybeSingle();

              if (data) {
                targetScholar = {
                  id: data.id,
                  username: data.username || cleaned,
                  displayName: data.display_name || cleaned,
                };
              }
            } catch {
              // Ignore network error
            }
          }
        }

        if (!targetScholar) {
          return {
            error: new Error(`No scholar sanctuary found with handle @${cleaned}.`),
          };
        }

        return get().inviteFellowByProfile(targetScholar);
      },

      inviteFellowByProfile: async (recipient) => {
        const authState = useAuthStore.getState();
        const currentUser = authState.user;
        const currentProfile = authState.profile;
        if (!currentUser) {
          return { error: new Error('Sign in required to invite a Fellow Scholar.') };
        }

        if (recipient.id === currentUser.id) {
          return { error: new Error('You cannot invite yourself to your Reader Circle.') };
        }

        const existing = get().circles.find(
          (c) =>
            (c.requester_id === currentUser.id && c.recipient_id === recipient.id) ||
            (c.requester_id === recipient.id && c.recipient_id === currentUser.id)
        );
        if (existing) {
          return {
            error: new Error(
              existing.status === 'accepted'
                ? `@${recipient.username} is already in your Reader Circle.`
                : `An invitation with @${recipient.username} is already pending.`
            ),
          };
        }

        const supabase = createClient();
        const { myUsername, myDisplayName } = await resolveSelfScholarIdentity(
          currentUser,
          currentProfile,
          supabase
        );

        const now = new Date().toISOString();
        const optimisticCircle: ReaderCircleRow = {
          id: generateId(),
          requester_id: currentUser.id,
          requester_username: myUsername,
          requester_display_name: myDisplayName,
          recipient_id: recipient.id,
          recipient_username: recipient.username,
          recipient_display_name: recipient.displayName,
          status: 'pending',
          created_at: now,
          updated_at: now,
        };

        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('reader_circles')
              .insert({
                requester_id: optimisticCircle.requester_id,
                requester_username: optimisticCircle.requester_username,
                requester_display_name: optimisticCircle.requester_display_name,
                recipient_id: optimisticCircle.recipient_id,
                recipient_username: optimisticCircle.recipient_username,
                recipient_display_name: optimisticCircle.recipient_display_name,
                status: 'pending',
              })
              .select('*')
              .single();

            if (!error && data) {
              set((s) => ({ circles: [data, ...s.circles] }));
              return { error: null, circle: data };
            }
          } catch {
            // Fall through to local optimistic state
          }
        }

        set((s) => ({ circles: [optimisticCircle, ...s.circles] }));
        return { error: null, circle: optimisticCircle };
      },

      respondToCircleInvite: async (circleId, action) => {
        if (action === 'decline') {
          return get().removeFellow(circleId);
        }

        const now = new Date().toISOString();
        set((s) => ({
          circles: s.circles.map((c) =>
            c.id === circleId ? { ...c, status: 'accepted', updated_at: now } : c
          ),
        }));

        const supabase = createClient();
        if (supabase) {
          try {
            await supabase
              .from('reader_circles')
              .update({ status: 'accepted', updated_at: now })
              .eq('id', circleId);
          } catch {
            // Local state preserved
          }
        }
        return { error: null };
      },

      removeFellow: async (circleId) => {
        const target = get().circles.find((c) => c.id === circleId);
        const authUserId = useAuthStore.getState().user?.id;
        const fellowId =
          target && authUserId
            ? target.requester_id === authUserId
              ? target.recipient_id
              : target.requester_id
            : null;

        set((s) => ({
          circles: s.circles.filter((c) => c.id !== circleId),
          symposiums: fellowId
            ? s.symposiums.filter(
                (sym) => sym.host_id !== fellowId && sym.fellow_id !== fellowId
              )
            : s.symposiums,
        }));

        const supabase = createClient();
        if (supabase) {
          try {
            await supabase.from('reader_circles').delete().eq('id', circleId);
          } catch {
            // Local state preserved
          }
        }
        return { error: null };
      },

      createSymposiumInvite: async ({
        bookId,
        bookTitle,
        fellowId,
        fellowUsername,
        fellowDisplayName,
      }) => {
        const authState = useAuthStore.getState();
        const currentUser = authState.user;
        const currentProfile = authState.profile;
        if (!currentUser) {
          return { error: new Error('Sign in required to start a Literary Symposium.') };
        }

        const existing = get().symposiums.find(
          (s) =>
            s.book_id === bookId &&
            ((s.host_id === currentUser.id && s.fellow_id === fellowId) ||
              (s.host_id === fellowId && s.fellow_id === currentUser.id))
        );
        if (existing) {
          return {
            error: new Error(
              `A Literary Symposium for "${bookTitle}" with @${fellowUsername} already exists.`
            ),
          };
        }

        const supabase = createClient();
        const { myUsername, myDisplayName } = await resolveSelfScholarIdentity(
          currentUser,
          currentProfile,
          supabase
        );

        const now = new Date().toISOString();
        const optimisticSession: SymposiumSessionRow = {
          id: generateId(),
          book_id: bookId,
          book_title: bookTitle,
          host_id: currentUser.id,
          host_username: myUsername,
          host_display_name: myDisplayName,
          fellow_id: fellowId,
          fellow_username: fellowUsername,
          fellow_display_name: fellowDisplayName,
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: now,
          updated_at: now,
        };

        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('symposium_sessions')
              .insert({
                book_id: optimisticSession.book_id,
                book_title: optimisticSession.book_title,
                host_id: optimisticSession.host_id,
                host_username: optimisticSession.host_username,
                host_display_name: optimisticSession.host_display_name,
                fellow_id: optimisticSession.fellow_id,
                fellow_username: optimisticSession.fellow_username,
                fellow_display_name: optimisticSession.fellow_display_name,
                status: 'pending',
              })
              .select('*')
              .single();

            if (!error && data) {
              set((s) => ({ symposiums: [data, ...s.symposiums] }));
              return { error: null, session: data };
            }
          } catch {
            // Fall through to local state
          }
        }

        set((s) => ({ symposiums: [optimisticSession, ...s.symposiums] }));
        return { error: null, session: optimisticSession };
      },

      respondToSymposiumInvite: async (sessionId, action) => {
        if (action === 'decline') {
          return get().leaveSymposium(sessionId);
        }

        const now = new Date().toISOString();
        set((s) => ({
          symposiums: s.symposiums.map((sym) =>
            sym.id === sessionId ? { ...sym, status: 'active', updated_at: now } : sym
          ),
        }));

        const supabase = createClient();
        if (supabase) {
          try {
            await supabase
              .from('symposium_sessions')
              .update({ status: 'active', updated_at: now })
              .eq('id', sessionId);
          } catch {
            // Local state preserved
          }
        }
        return { error: null };
      },

      leaveSymposium: async (sessionId) => {
        set((s) => ({
          symposiums: s.symposiums.filter((sym) => sym.id !== sessionId),
        }));

        const supabase = createClient();
        if (supabase) {
          try {
            await supabase.from('symposium_sessions').delete().eq('id', sessionId);
          } catch {
            // Local state preserved
          }
        }
        return { error: null };
      },

      syncSymposiumProgress: async (bookId, chapterIndex, progressPct) => {
        const currentUserId = useAuthStore.getState().user?.id;
        if (!currentUserId) return;

        const clampedProgress = Math.max(0, Math.min(100, Math.round(progressPct)));
        const activeSessions = get().symposiums.filter(
          (s) =>
            s.book_id === bookId &&
            (s.status === 'active' || s.status === 'completed') &&
            (s.host_id === currentUserId || s.fellow_id === currentUserId)
        );
        if (activeSessions.length === 0) return;

        // Prevent redundant store mutations and render cycles if chapter and progress have not changed
        const sessionsNeedingUpdate = activeSessions.filter((sym) => {
          const isHost = sym.host_id === currentUserId;
          const currentProgress = isHost ? sym.host_progress : sym.fellow_progress;
          const currentChapter = isHost ? sym.host_chapter : sym.fellow_chapter;
          return currentProgress !== clampedProgress || currentChapter !== chapterIndex;
        });
        if (sessionsNeedingUpdate.length === 0) return;

        const now = new Date().toISOString();
        set((s) => ({
          symposiums: s.symposiums.map((sym) => {
            if (
              sym.book_id !== bookId ||
              (sym.status !== 'active' && sym.status !== 'completed')
            ) {
              return sym;
            }
            const isHost = sym.host_id === currentUserId;
            const updatedHostProgress = isHost ? clampedProgress : sym.host_progress;
            const updatedFellowProgress = isHost ? sym.fellow_progress : clampedProgress;
            const nextStatus =
              updatedHostProgress >= 100 && updatedFellowProgress >= 100
                ? 'completed'
                : sym.status;

            return {
              ...sym,
              host_chapter: isHost ? chapterIndex : sym.host_chapter,
              host_progress: updatedHostProgress,
              fellow_chapter: isHost ? sym.fellow_chapter : chapterIndex,
              fellow_progress: updatedFellowProgress,
              status: nextStatus,
              updated_at: now,
            };
          }),
        }));

        const supabase = createClient();
        const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;

        for (const sym of sessionsNeedingUpdate) {
          const isHost = sym.host_id === currentUserId;
          const updatedHostProgress = isHost ? clampedProgress : sym.host_progress;
          const updatedFellowProgress = isHost ? sym.fellow_progress : clampedProgress;
          const nextStatus =
            updatedHostProgress >= 100 && updatedFellowProgress >= 100
              ? 'completed'
              : sym.status;

          if (isOfflineNow || !supabase) {
            set((s) => ({
              pendingSymposiumProgress: {
                ...s.pendingSymposiumProgress,
                [sym.id]: {
                  chapterIndex,
                  progressPct: clampedProgress,
                  status: nextStatus,
                  isHost,
                  updatedAt: now,
                },
              },
            }));
            continue;
          }

          try {
            const { error: updateErr } = await supabase
              .from('symposium_sessions')
              .update(
                isHost
                  ? {
                      host_chapter: chapterIndex,
                      host_progress: clampedProgress,
                      status: nextStatus,
                      updated_at: now,
                    }
                  : {
                      fellow_chapter: chapterIndex,
                      fellow_progress: clampedProgress,
                      status: nextStatus,
                      updated_at: now,
                    }
              )
              .eq('id', sym.id);
            if (updateErr) throw updateErr;
            if (get().pendingSymposiumProgress[sym.id]) {
              set((s) => {
                const nextPending = { ...s.pendingSymposiumProgress };
                delete nextPending[sym.id];
                return { pendingSymposiumProgress: nextPending };
              });
            }
          } catch {
            set((s) => ({
              pendingSymposiumProgress: {
                ...s.pendingSymposiumProgress,
                [sym.id]: {
                  chapterIndex,
                  progressPct: clampedProgress,
                  status: nextStatus,
                  isHost,
                  updatedAt: now,
                },
              },
            }));
          }
        }
      },

      getAcceptedFellows: (explicitUserId) => {
        const userId = explicitUserId || useAuthStore.getState().user?.id;
        if (!userId) return [];

        return get()
          .circles.filter((c) => c.status === 'accepted')
          .map((c) => {
            const isRequester = c.requester_id === userId;
            return {
              circleId: c.id,
              fellowId: isRequester ? c.recipient_id : c.requester_id,
              username: isRequester ? c.recipient_username : c.requester_username,
              displayName: isRequester ? c.recipient_display_name : c.requester_display_name,
            };
          });
      },

      getPendingInviteCount: (explicitUserId) => {
        const userId = explicitUserId || useAuthStore.getState().user?.id;
        if (!userId) return 0;

        const incomingCircles = get().circles.filter(
          (c) => c.status === 'pending' && c.recipient_id === userId
        ).length;
        const incomingSymposiums = get().symposiums.filter(
          (s) => s.status === 'pending' && s.fellow_id === userId
        ).length;

        return incomingCircles + incomingSymposiums;
      },

      getActiveSymposiumForBook: (bookId, explicitUserId) => {
        const userId = explicitUserId || useAuthStore.getState().user?.id;
        if (!userId) return undefined;

        return get().symposiums.find(
          (s) =>
            s.book_id === bookId &&
            (s.status === 'active' || s.status === 'completed') &&
            (s.host_id === userId || s.fellow_id === userId)
        );
      },

      clearFellowshipState: () => {
        set({ circles: [], symposiums: [], pendingSymposiumProgress: {}, isLoading: false, error: null });
      },
    }),
    {
      name: 'bookarium-fellowship-storage',
      partialize: (state) => ({
        circles: state.circles,
        symposiums: state.symposiums,
        pendingSymposiumProgress: state.pendingSymposiumProgress,
      }),
    }
  )
);

export function useHydratedFellowship() {
  const store = useFellowshipStore(
    useShallow((s) => ({
      circles: s.circles,
      symposiums: s.symposiums,
      isLoading: s.isLoading,
      error: s.error,
      fetchFellowshipData: s.fetchFellowshipData,
      syncWithCloud: s.syncWithCloud,
      inviteFellowByUsername: s.inviteFellowByUsername,
      inviteFellowByProfile: s.inviteFellowByProfile,
      respondToCircleInvite: s.respondToCircleInvite,
      removeFellow: s.removeFellow,
      createSymposiumInvite: s.createSymposiumInvite,
      respondToSymposiumInvite: s.respondToSymposiumInvite,
      leaveSymposium: s.leaveSymposium,
      syncSymposiumProgress: s.syncSymposiumProgress,
      getAcceptedFellows: s.getAcceptedFellows,
      getPendingInviteCount: s.getPendingInviteCount,
      getActiveSymposiumForBook: s.getActiveSymposiumForBook,
      clearFellowshipState: s.clearFellowshipState,
    }))
  );
  const isHydrated = useHasMounted();
  const hydratedData = isHydrated
    ? { circles: store.circles, symposiums: store.symposiums }
    : { circles: [] as ReaderCircleRow[], symposiums: [] as SymposiumSessionRow[] };

  return {
    ...store,
    ...hydratedData,
    isHydrated,
  };
}


