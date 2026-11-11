'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowUpRight,
  Sparkles,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { formatFellowScholarLabel } from '@/stores/useFellowshipStore';
import type { SymposiumSessionRow } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export interface SymposiumPactsSubTabProps {
  userId: string;
  activeSymposiums: SymposiumSessionRow[];
  isOffline: boolean;
  isBookOffline: (bookId: number) => boolean;
  onOpenNewSymposiumModal: () => void;
  onRequestLeaveSymposium: (params: {
    sessionId: string;
    bookTitle: string;
    fellowLabel: string;
  }) => void;
}

/**
 * Sub-Tab 1 (`symposiums`) of `AccountSymposiumSection`: renders active and completed
 * shared reading pacts with dual progress bars and offline availability guards.
 */
export const SymposiumPactsSubTab: React.FC<SymposiumPactsSubTabProps> = ({
  userId,
  activeSymposiums,
  isOffline,
  isBookOffline,
  onOpenNewSymposiumModal,
  onRequestLeaveSymposium,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Shared Reading Pacts
        </h3>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isOffline}
          onClick={onOpenNewSymposiumModal}
          className="font-mono text-xs whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 shrink-0" />
          <span>New Symposium Pact</span>
        </Button>
      </div>

      {activeSymposiums.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-border bg-muted/15 text-center space-y-2">
          <BookOpen className="w-6 h-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-serif font-bold text-foreground">
            No Active Literary Symposiums
          </p>
          <p className="text-xs text-muted-foreground font-sans max-w-md mx-auto">
            Invite a Fellow Scholar from your Reader Circle to read a volume
            together and exchange in-book marginalia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSymposiums.map((session) => {
            const isHost = session.host_id === userId;
            const myProgress = isHost
              ? session.host_progress
              : session.fellow_progress;
            const myChapter = isHost
              ? session.host_chapter
              : session.fellow_chapter;
            const fellowProgress = isHost
              ? session.fellow_progress
              : session.host_progress;
            const fellowChapter = isHost
              ? session.fellow_chapter
              : session.host_chapter;
            const fellowHandle = isHost
              ? session.fellow_username
              : session.host_username;
            const fellowName = isHost
              ? session.fellow_display_name
              : session.host_display_name;
            const isBookCached = isBookOffline(session.book_id);
            const isUnavailableOffline = isOffline && !isBookCached;

            return (
              <div
                key={session.id}
                className={`p-4 rounded-xl border border-border bg-muted/20 space-y-3 flex flex-col justify-between ${
                  isUnavailableOffline ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        {session.status === 'completed'
                          ? 'Completed Pact'
                          : 'Active Symposium'}
                      </span>
                      {isUnavailableOffline && (
                        <span
                          data-testid={`symposium-offline-badge-${session.book_id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30"
                        >
                          <WifiOff className="w-2.5 h-2.5" />
                          <span>Not Downloaded</span>
                        </span>
                      )}
                    </div>
                    <h4
                      className="text-base font-serif font-bold text-foreground mt-1 truncate"
                      title={
                        session.book_title || `Volume #${session.book_id}`
                      }
                    >
                      {session.book_title || `Volume #${session.book_id}`}
                    </h4>
                    <p className="text-xs font-mono text-muted-foreground">
                      With {fellowName} (@{fellowHandle})
                    </p>
                  </div>

                  {isUnavailableOffline ? (
                    <button
                      type="button"
                      disabled
                      data-testid={`symposium-read-disabled-${session.book_id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs font-mono font-medium text-muted-foreground opacity-60 cursor-not-allowed shrink-0"
                      title="Book must be downloaded to read offline"
                    >
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Unavailable Offline</span>
                    </button>
                  ) : (
                    <Link
                      href={ROUTES.READ(session.book_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-bold text-primary shrink-0"
                    >
                      <span>Read</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                <div className="space-y-1.5 pt-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-foreground">
                    <span>Your Progress (Sec. {myChapter + 1})</span>
                    <span className="font-bold">{myProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${myProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground pt-1">
                    <span>
                      {fellowName || `@${fellowHandle}`} (Sec.{' '}
                      {fellowChapter + 1})
                    </span>
                    <span className="font-bold">{fellowProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${fellowProgress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-border">
                  <button
                    type="button"
                    disabled={isOffline}
                    onClick={() =>
                      onRequestLeaveSymposium({
                        sessionId: session.id,
                        bookTitle:
                          session.book_title || `Volume #${session.book_id}`,
                        fellowLabel: formatFellowScholarLabel(
                          fellowName,
                          fellowHandle
                        ),
                      })
                    }
                    className={`text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1 ${
                      isOffline
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:text-destructive cursor-pointer'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Leave Symposium</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
