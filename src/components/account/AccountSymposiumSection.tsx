'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Mail,
  UserPlus,
  Check,
  X,
  ArrowUpRight,
  Sparkles,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useHydratedFellowship, formatFellowScholarLabel } from '@/stores/useFellowshipStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { EditorialUnderlineTabs } from '@/components/ui/EditorialUnderlineTabs';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';

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
              onClick={() => {
                setModalPreselectedFellow(undefined);
                setIsSymposiumModalOpen(true);
              }}
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
                Invite a Fellow Scholar from your Reader Circle to read a volume together and exchange in-book marginalia.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSymposiums.map((session) => {
                const isHost = session.host_id === userId;
                const myProgress = isHost ? session.host_progress : session.fellow_progress;
                const myChapter = isHost ? session.host_chapter : session.fellow_chapter;
                const fellowProgress = isHost ? session.fellow_progress : session.host_progress;
                const fellowChapter = isHost ? session.fellow_chapter : session.host_chapter;
                const fellowHandle = isHost ? session.fellow_username : session.host_username;
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
                            {session.status === 'completed' ? 'Completed Pact' : 'Active Symposium'}
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
                          title={session.book_title || `Volume #${session.book_id}`}
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
                          {fellowName || `@${fellowHandle}`} (Sec. {fellowChapter + 1})
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
                          setPendingConfirmAction({
                            type: 'leave-symposium',
                            sessionId: session.id,
                            bookTitle: session.book_title || `Volume #${session.book_id}`,
                            fellowLabel: formatFellowScholarLabel(fellowName, fellowHandle),
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
      )}

      {/* Sub-Tab 2: Reader Circle (Fellow Scholars & Handle Invite) */}
      {activeSubTab === 'circle' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <form
            onSubmit={handleInviteSubmit}
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
                  onChange={(e) => setInviteHandle(e.target.value)}
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
              Works even if your or your companion&apos;s sanctuary is set to Private Sanctuary.
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
              No connected Fellow Scholars yet. Invite a companion above to form your Reader Circle.
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
                      onClick={() => {
                        setModalPreselectedFellow({
                          fellowId: fellow.fellowId,
                          username: fellow.username,
                          displayName: fellow.displayName,
                        });
                        setIsSymposiumModalOpen(true);
                      }}
                      className="font-mono text-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" />
                      <span>Symposium</span>
                    </Button>
                    <button
                      type="button"
                      disabled={isOffline}
                      onClick={() =>
                        setPendingConfirmAction({
                          type: 'remove-fellow',
                          circleId: fellow.circleId,
                          fellowLabel: formatFellowScholarLabel(fellow.displayName, fellow.username),
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
      )}

      {/* Sub-Tab 3: Pending Invitations (Reader Circle & Symposiums) */}
      {activeSubTab === 'invitations' && (
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
                        {isIncoming ? 'Incoming Circle Request' : 'Sent Circle Request'}
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
                            onClick={() => respondToCircleInvite(circle.id, 'accept')}
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
                              setPendingConfirmAction({
                                type: 'decline-circle',
                                circleId: circle.id,
                                fellowLabel: formatFellowScholarLabel(otherName, otherHandle),
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
                            setPendingConfirmAction({
                              type: 'cancel-circle',
                              circleId: circle.id,
                              fellowLabel: formatFellowScholarLabel(otherName, otherHandle),
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
                const otherName = isIncoming ? sym.host_display_name : sym.fellow_display_name;
                const otherHandle = isIncoming ? sym.host_username : sym.fellow_username;

                return (
                  <div
                    key={sym.id}
                    className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                        {isIncoming ? 'Incoming Symposium Pact' : 'Sent Symposium Pact'}
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
                            onClick={() => respondToSymposiumInvite(sym.id, 'accept')}
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
                              setPendingConfirmAction({
                                type: 'decline-symposium',
                                sessionId: sym.id,
                                bookTitle: sym.book_title || `Volume #${sym.book_id}`,
                                fellowLabel: formatFellowScholarLabel(otherName, otherHandle),
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
                            setPendingConfirmAction({
                              type: 'cancel-symposium',
                              sessionId: sym.id,
                              bookTitle: sym.book_title || `Volume #${sym.book_id}`,
                              fellowLabel: formatFellowScholarLabel(otherName, otherHandle),
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

