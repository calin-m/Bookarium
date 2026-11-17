'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  Mail,
  Trash2,
} from 'lucide-react';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { SymposiumPactsSubTab } from './symposium/SymposiumPactsSubTab';
import { ReaderCircleSubTab } from './symposium/ReaderCircleSubTab';
import { FellowshipInvitationsSubTab } from './symposium/FellowshipInvitationsSubTab';

const SymposiumInviteModal = dynamic(
  () => import('@/components/symposium/SymposiumInviteModal').then((mod) => mod.SymposiumInviteModal),
  { ssr: false }
);

export interface AccountSymposiumSectionProps {
  userId: string;
}

type PendingFellowshipConfirmAction =
  | {
      type: 'remove-fellow';
      circleId: string;
      fellowLabel: string;
    }
  | {
      type: 'leave-symposium';
      sessionId: string;
      bookTitle: string;
      fellowLabel: string;
    }
  | {
      type: 'decline-circle';
      circleId: string;
      fellowLabel: string;
    }
  | {
      type: 'cancel-circle';
      circleId: string;
      fellowLabel: string;
    }
  | {
      type: 'decline-symposium';
      sessionId: string;
      bookTitle: string;
      fellowLabel: string;
    }
  | {
      type: 'cancel-symposium';
      sessionId: string;
      bookTitle: string;
      fellowLabel: string;
    };

export const AccountSymposiumSection: React.FC<AccountSymposiumSectionProps> = ({ userId }) => {
  const {
    circles,
    symposiums,
    fetchFellowshipData,
    inviteFellowByUsername,
    respondToCircleInvite,
    removeFellow,
    respondToSymposiumInvite,
    leaveSymposium,
    getAcceptedFellows,
    getPendingInviteCount,
  } = useHydratedFellowship();

  const { isOffline } = useNetworkStatus();
  const { isBookOffline } = useOfflineBooks();
  const [inviteHandle, setInviteHandle] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isSymposiumModalOpen, setIsSymposiumModalOpen] = useState(false);
  const [modalPreselectedFellow, setModalPreselectedFellow] = useState<
    { fellowId: string; username: string; displayName: string } | undefined
  >(undefined);
  const [pendingConfirmAction, setPendingConfirmAction] =
    useState<PendingFellowshipConfirmAction | null>(null);

  const confirmModalCopy = React.useMemo(() => {
    if (!pendingConfirmAction) return null;
    switch (pendingConfirmAction.type) {
      case 'remove-fellow':
        return {
          title: 'Remove from Reader Circle',
          heading: `Remove ${pendingConfirmAction.fellowLabel} from your Reader Circle?`,
          description:
            'This will remove this scholar from your Reader Circle and permanently dissolve any shared Literary Symposiums with them. Your personal reading progress, bookshelves, and notes will remain untouched.',
          confirmLabel: 'Remove Fellow',
        };
      case 'leave-symposium':
        return {
          title: 'Leave Literary Symposium',
          heading: `Leave the Symposium on “${pendingConfirmAction.bookTitle}”?`,
          description: `This will permanently dissolve your shared reading pact with ${pendingConfirmAction.fellowLabel} for both scholars. Your personal reading progress, bookmarks, and notes will remain untouched.`,
          confirmLabel: 'Leave Symposium',
        };
      case 'decline-circle':
        return {
          title: 'Decline Circle Request',
          heading: `Decline Reader Circle invitation from ${pendingConfirmAction.fellowLabel}?`,
          description:
            'This will decline their incoming Reader Circle invitation. They can send a new invitation in the future.',
          confirmLabel: 'Decline Request',
        };
      case 'cancel-circle':
        return {
          title: 'Cancel Circle Request',
          heading: `Withdraw Reader Circle invitation to ${pendingConfirmAction.fellowLabel}?`,
          description:
            'This will cancel your pending Reader Circle request to this scholar.',
          confirmLabel: 'Withdraw Request',
        };
      case 'decline-symposium':
        return {
          title: 'Decline Symposium Pact',
          heading: `Decline Symposium pact on “${pendingConfirmAction.bookTitle}”?`,
          description: `This will decline the incoming Literary Symposium invitation from ${pendingConfirmAction.fellowLabel}.`,
          confirmLabel: 'Decline Pact',
        };
      case 'cancel-symposium':
        return {
          title: 'Cancel Symposium Pact',
          heading: `Withdraw Symposium pact on “${pendingConfirmAction.bookTitle}”?`,
          description: `This will cancel your pending Literary Symposium invitation sent to ${pendingConfirmAction.fellowLabel}.`,
          confirmLabel: 'Withdraw Pact',
        };
    }
  }, [pendingConfirmAction]);

  const handleConfirmPendingAction = async () => {
    if (!pendingConfirmAction) return;
    const action = pendingConfirmAction;
    setPendingConfirmAction(null);
    switch (action.type) {
      case 'remove-fellow':
      case 'cancel-circle':
        await removeFellow(action.circleId);
        break;
      case 'leave-symposium':
      case 'cancel-symposium':
        await leaveSymposium(action.sessionId);
        break;
      case 'decline-circle':
        await respondToCircleInvite(action.circleId, 'decline');
        break;
      case 'decline-symposium':
        await respondToSymposiumInvite(action.sessionId, 'decline');
        break;
    }
  };

  useEffect(() => {
    if (userId && !isOffline) {
      fetchFellowshipData(userId, { minSyncIntervalMs: 15_000 });
    }
  }, [userId, isOffline, fetchFellowshipData]);

  const acceptedFellows = getAcceptedFellows(userId);
  const pendingCount = getPendingInviteCount(userId);

  const activeSymposiums = symposiums.filter(
    (s) => s.status === 'active' || s.status === 'completed'
  );
  const pendingCircles = circles.filter((c) => c.status === 'pending');
  const pendingSymposiums = symposiums.filter((s) => s.status === 'pending');

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteHandle.trim()) return;
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    const { error, circle } = await inviteFellowByUsername(inviteHandle);
    setIsInviting(false);
    if (error) {
      setInviteError(error.message);
    } else if (circle) {
      setInviteHandle('');
      setInviteSuccess(`Fellowship invitation sent to @${circle.recipient_username}.`);
    }
  };

  return (
    <div
      id="account-symposium-section"
      className="space-y-6"
      data-testid="account-symposium-section"
    >
      {/* Conditional Pending Invitations Card (Collapsed completely when count === 0) */}
      {pendingCount > 0 && (
        <section
          aria-label="Pending Fellowship Invitations"
          className="bg-card border border-amber-500/40 dark:border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-border text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-foreground">
                  Pending Invitations
                </h3>
                <p className="text-xs text-muted-foreground font-sans">
                  Incoming and sent Reader Circle and Literary Symposium requests.
                </p>
              </div>
            </div>
            <span
              data-testid="symposium-pending-badge"
              className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-border shrink-0"
            >
              {pendingCount}
            </span>
          </div>

          <FellowshipInvitationsSubTab
            userId={userId}
            pendingCircles={pendingCircles}
            pendingSymposiums={pendingSymposiums}
            isOffline={isOffline}
            onAcceptCircleInvite={(circleId) => {
              void respondToCircleInvite(circleId, 'accept');
            }}
            onDeclineCircleInvite={(payload) =>
              setPendingConfirmAction({
                type: 'decline-circle',
                ...payload,
              })
            }
            onCancelCircleInvite={(payload) =>
              setPendingConfirmAction({
                type: 'cancel-circle',
                ...payload,
              })
            }
            onAcceptSymposiumInvite={(sessionId) => {
              void respondToSymposiumInvite(sessionId, 'accept');
            }}
            onDeclineSymposiumInvite={(payload) =>
              setPendingConfirmAction({
                type: 'decline-symposium',
                ...payload,
              })
            }
            onCancelSymposiumInvite={(payload) =>
              setPendingConfirmAction({
                type: 'cancel-symposium',
                ...payload,
              })
            }
          />
        </section>
      )}

      {/* Main Un-Tabbed Symposium & Reader Circle Card */}
      <section
        aria-label="Literary Symposiums and Reader Circle"
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 lg:p-8 shadow-xs space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-border text-primary flex items-center justify-center shadow-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">
                Literary Symposiums & Reader Circle
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              Connect with Fellow Scholars and read public domain volumes together with shared marginalia.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground self-start sm:self-center shrink-0">
            <span className="px-2.5 py-1 rounded-full bg-muted border border-border">
              {activeSymposiums.length} {activeSymposiums.length === 1 ? 'Pact' : 'Pacts'}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-muted border border-border">
              {acceptedFellows.length} {acceptedFellows.length === 1 ? 'Fellow' : 'Fellows'}
            </span>
          </div>
        </div>

        <div className="space-y-8">
          {/* Active & Completed Symposium Pacts */}
          <div>
            <SymposiumPactsSubTab
              userId={userId}
              activeSymposiums={activeSymposiums}
              isOffline={isOffline}
              isBookOffline={isBookOffline}
              onOpenNewSymposiumModal={() => {
                setModalPreselectedFellow(undefined);
                setIsSymposiumModalOpen(true);
              }}
              onRequestLeaveSymposium={(payload) =>
                setPendingConfirmAction({
                  type: 'leave-symposium',
                  ...payload,
                })
              }
            />
          </div>

          {/* Reader Circle Connections & @username Invites */}
          <div className="pt-8 border-t border-border">
            <ReaderCircleSubTab
              acceptedFellows={acceptedFellows}
              inviteHandle={inviteHandle}
              onInviteHandleChange={setInviteHandle}
              onInviteSubmit={handleInviteSubmit}
              isInviting={isInviting}
              isOffline={isOffline}
              inviteError={inviteError}
              inviteSuccess={inviteSuccess}
              onOpenSymposiumWithFellow={(fellow) => {
                setModalPreselectedFellow(fellow);
                setIsSymposiumModalOpen(true);
              }}
              onRequestRemoveFellow={(payload) =>
                setPendingConfirmAction({
                  type: 'remove-fellow',
                  ...payload,
                })
              }
            />
          </div>
        </div>
      </section>

      <SymposiumInviteModal
        isOpen={isSymposiumModalOpen}
        onClose={() => setIsSymposiumModalOpen(false)}
        preselectedFellow={modalPreselectedFellow}
      />

      <ConfirmActionModal
        isOpen={pendingConfirmAction !== null && confirmModalCopy !== null}
        onClose={() => setPendingConfirmAction(null)}
        onConfirm={handleConfirmPendingAction}
        title={confirmModalCopy?.title || 'Confirm Action'}
        heading={confirmModalCopy?.heading || ''}
        description={confirmModalCopy?.description || ''}
        confirmLabel={confirmModalCopy?.confirmLabel || 'Confirm'}
        icon={<Trash2 className="w-5 h-5" />}
        modalTestId="fellowship-confirm-modal"
        dialogTestId="fellowship-confirm-dialog"
        cancelTestId="cancel-fellowship-action-btn"
        confirmTestId="confirm-fellowship-action-btn"
      />
    </div>
  );
};

