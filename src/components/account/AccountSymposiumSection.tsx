'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  BookOpen,
  Mail,
  Trash2,
} from 'lucide-react';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { EditorialUnderlineTabs } from '@/components/ui/EditorialUnderlineTabs';
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

type SymposiumSubTabId = 'symposiums' | 'circle' | 'invitations';

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

  const [activeSubTab, setActiveSubTab] = useState<SymposiumSubTabId>('symposiums');
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
      fetchFellowshipData(userId);
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
      className="space-y-4"
      data-testid="account-symposium-section"
    >
      {/* Centered Editorial Underline Sub-Tab Bar (Outside & Above Card) */}
      <EditorialUnderlineTabs<SymposiumSubTabId>
        tabs={[
          {
            id: 'symposiums',
            label: 'Active Symposiums',
            ariaLabel: `Active Symposiums (${activeSymposiums.length})`,
            title: `Active Symposiums (${activeSymposiums.length})`,
            icon: <BookOpen className="w-3.5 h-3.5 shrink-0" />,
            count: activeSymposiums.length,
          },
          {
            id: 'circle',
            label: 'Reader Circle',
            ariaLabel: `Reader Circle (${acceptedFellows.length})`,
            title: `Reader Circle (${acceptedFellows.length})`,
            icon: <Users className="w-3.5 h-3.5 shrink-0" />,
            count: acceptedFellows.length,
          },
          {
            id: 'invitations',
            label: 'Invitations',
            icon: <Mail className="w-3.5 h-3.5 shrink-0" />,
            count: pendingCount,
            countVariant: 'amber',
            countTestId: 'symposium-pending-badge',
            hideZeroCount: true,
          },
        ]}
        activeTab={activeSubTab}
        onSelectTab={setActiveSubTab}
        ariaLabel="Symposium and Reader Circle sections"
      />

      {/* Main Symposium Card */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 lg:p-7 shadow-booksaw space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-border text-primary flex items-center justify-center shadow-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-serif font-bold text-foreground">
                Literary Symposiums & Reader Circle
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              Connect with Fellow Scholars and read public domain volumes together with shared marginalia.
            </p>
          </div>
        </div>

        {/* Sub-Tab 1: Active & Completed Symposiums */}
        {activeSubTab === 'symposiums' && (
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
        )}

        {/* Sub-Tab 2: Reader Circle (Fellow Scholars & Handle Invite) */}
        {activeSubTab === 'circle' && (
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
        )}

        {/* Sub-Tab 3: Pending Invitations (Reader Circle & Symposiums) */}
        {activeSubTab === 'invitations' && (
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
        )}
      </div>

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

