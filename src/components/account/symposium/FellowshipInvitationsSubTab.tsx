'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { formatFellowScholarLabel } from '@/stores/useFellowshipStore';
import type { ReaderCircleRow, SymposiumSessionRow } from '@/types/database.types';
import { Button } from '@/components/ui/Button';

export interface FellowshipInvitationsSubTabProps {
  userId: string;
  pendingCircles: ReaderCircleRow[];
  pendingSymposiums: SymposiumSessionRow[];
  isOffline: boolean;
  onAcceptCircleInvite: (circleId: string) => Promise<void> | void;
  onDeclineCircleInvite: (params: {
    circleId: string;
    fellowLabel: string;
  }) => void;
  onCancelCircleInvite: (params: {
    circleId: string;
    fellowLabel: string;
  }) => void;
  onAcceptSymposiumInvite: (sessionId: string) => Promise<void> | void;
  onDeclineSymposiumInvite: (params: {
    sessionId: string;
    bookTitle: string;
    fellowLabel: string;
  }) => void;
  onCancelSymposiumInvite: (params: {
    sessionId: string;
    bookTitle: string;
    fellowLabel: string;
  }) => void;
}

/**
 * Sub-Tab 3 (`invitations`) of `AccountSymposiumSection`: renders incoming and sent
 * Reader Circle requests and Literary Symposium pact invitations.
 */
export const FellowshipInvitationsSubTab: React.FC<
  FellowshipInvitationsSubTabProps
> = ({
  userId,
  pendingCircles,
  pendingSymposiums,
  isOffline,
  onAcceptCircleInvite,
  onDeclineCircleInvite,
  onCancelCircleInvite,
  onAcceptSymposiumInvite,
  onDeclineSymposiumInvite,
  onCancelSymposiumInvite,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {pendingCircles.length === 0 && pendingSymposiums.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs font-mono text-muted-foreground">
          No pending Reader Circle or Symposium invitations.
        </div>
      ) : (
        <div className="space-y-3">
          {pendingCircles.map((circle) => {
            const isIncoming = circle.recipient_id === userId;
            const otherName = isIncoming
              ? circle.requester_display_name
              : circle.recipient_display_name;
            const otherHandle = isIncoming
              ? circle.requester_username
              : circle.recipient_username;

            return (
              <div
                key={circle.id}
                className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {isIncoming
                      ? 'Incoming Circle Request'
                      : 'Sent Circle Request'}
                  </span>
                  <p className="text-sm font-serif font-bold text-foreground mt-1">
                    {formatFellowScholarLabel(otherName, otherHandle)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isIncoming ? (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isOffline}
                        onClick={() => onAcceptCircleInvite(circle.id)}
                        className="font-mono text-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        <span>Accept Fellow</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isOffline}
                        onClick={() =>
                          onDeclineCircleInvite({
                            circleId: circle.id,
                            fellowLabel: formatFellowScholarLabel(
                              otherName,
                              otherHandle
                            ),
                          })
                        }
                        className="font-mono text-xs"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        <span>Decline</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isOffline}
                      onClick={() =>
                        onCancelCircleInvite({
                          circleId: circle.id,
                          fellowLabel: formatFellowScholarLabel(
                            otherName,
                            otherHandle
                          ),
                        })
                      }
                      className="font-mono text-xs"
                    >
                      Cancel Request
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {pendingSymposiums.map((sym) => {
            const isIncoming = sym.fellow_id === userId;
            const otherName = isIncoming
              ? sym.host_display_name
              : sym.fellow_display_name;
            const otherHandle = isIncoming
              ? sym.host_username
              : sym.fellow_username;

            return (
              <div
                key={sym.id}
                className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                    {isIncoming
                      ? 'Incoming Symposium Pact'
                      : 'Sent Symposium Pact'}
                  </span>
                  <p className="text-sm font-serif font-bold text-foreground mt-1">
                    {sym.book_title || `Volume #${sym.book_id}`}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    With {formatFellowScholarLabel(otherName, otherHandle)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isIncoming ? (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isOffline}
                        onClick={() => onAcceptSymposiumInvite(sym.id)}
                        className="font-mono text-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        <span>Accept Pact</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isOffline}
                        onClick={() =>
                          onDeclineSymposiumInvite({
                            sessionId: sym.id,
                            bookTitle:
                              sym.book_title || `Volume #${sym.book_id}`,
                            fellowLabel: formatFellowScholarLabel(
                              otherName,
                              otherHandle
                            ),
                          })
                        }
                        className="font-mono text-xs"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        <span>Decline</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isOffline}
                      onClick={() =>
                        onCancelSymposiumInvite({
                          sessionId: sym.id,
                          bookTitle:
                            sym.book_title || `Volume #${sym.book_id}`,
                          fellowLabel: formatFellowScholarLabel(
                            otherName,
                            otherHandle
                          ),
                        })
                      }
                      className="font-mono text-xs"
                    >
                      Cancel Pact
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
