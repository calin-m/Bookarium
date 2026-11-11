'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, UserPlus, Trash2 } from 'lucide-react';
import { formatFellowScholarLabel } from '@/stores/useFellowshipStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';

export interface AcceptedFellowItem {
  circleId: string;
  fellowId: string;
  username: string;
  displayName: string;
}

export interface ReaderCircleSubTabProps {
  acceptedFellows: AcceptedFellowItem[];
  isOffline: boolean;
  inviteHandle: string;
  onInviteHandleChange: (val: string) => void;
  isInviting: boolean;
  inviteError: string | null;
  inviteSuccess: string | null;
  onInviteSubmit: (e: React.FormEvent) => Promise<void> | void;
  onOpenSymposiumWithFellow: (fellow: {
    fellowId: string;
    username: string;
    displayName: string;
  }) => void;
  onRequestRemoveFellow: (params: {
    circleId: string;
    fellowLabel: string;
  }) => void;
}

/**
 * Sub-Tab 2 (`circle`) of `AccountSymposiumSection`: renders the `@username`
 * Fellow Scholar invitation form and connected Reader Circle companions grid.
 */
export const ReaderCircleSubTab: React.FC<ReaderCircleSubTabProps> = ({
  acceptedFellows,
  isOffline,
  inviteHandle,
  onInviteHandleChange,
  isInviting,
  inviteError,
  inviteSuccess,
  onInviteSubmit,
  onOpenSymposiumWithFellow,
  onRequestRemoveFellow,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <form
        onSubmit={onInviteSubmit}
        className="p-4 rounded-xl border border-border bg-muted/20 space-y-3"
      >
        <label
          htmlFor="circle-handle-invite-input"
          className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground"
        >
          Invite Fellow Scholar by @username Handle
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              id="circle-handle-invite-input"
              type="text"
              value={inviteHandle}
              onChange={(e) => onInviteHandleChange(e.target.value)}
              disabled={isOffline}
              placeholder="e.g. @charlotte_bronte"
              className="text-xs font-mono"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isOffline || isInviting || !inviteHandle.trim()}
            className="font-mono text-xs shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            <span>Send Circle Invitation</span>
          </Button>
        </div>
        {isOffline && (
          <p
            data-testid="circle-invite-offline-hint"
            className="text-xs font-mono text-muted-foreground"
          >
            Inviting Fellow Scholars requires an internet connection.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground font-sans">
          Works even if your or your companion&apos;s sanctuary is set to
          Private Sanctuary.
        </p>
        {inviteError && (
          <p className="text-xs font-mono text-destructive" role="alert">
            {inviteError}
          </p>
        )}
        {inviteSuccess && (
          <p className="text-xs font-mono text-success" role="status">
            {inviteSuccess}
          </p>
        )}
      </form>

      {acceptedFellows.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs font-mono text-muted-foreground">
          No connected Fellow Scholars yet. Invite a companion above to form
          your Reader Circle.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {acceptedFellows.map((fellow) => (
            <div
              key={fellow.circleId}
              className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <Link
                  href={ROUTES.PUBLIC_PROFILE(fellow.username)}
                  className="text-sm font-serif font-bold text-foreground hover:text-primary truncate block"
                  title={fellow.displayName}
                >
                  {fellow.displayName}
                </Link>
                <p
                  className="text-xs font-mono text-muted-foreground truncate"
                  title={`@${fellow.username}`}
                >
                  @{fellow.username}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isOffline}
                  onClick={() =>
                    onOpenSymposiumWithFellow({
                      fellowId: fellow.fellowId,
                      username: fellow.username,
                      displayName: fellow.displayName,
                    })
                  }
                  className="font-mono text-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  <span>Symposium</span>
                </Button>
                <button
                  type="button"
                  disabled={isOffline}
                  onClick={() =>
                    onRequestRemoveFellow({
                      circleId: fellow.circleId,
                      fellowLabel: formatFellowScholarLabel(
                        fellow.displayName,
                        fellow.username
                      ),
                    })
                  }
                  aria-label={`Remove @${fellow.username} from Reader Circle`}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
