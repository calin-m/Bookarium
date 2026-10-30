'use client';

import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Users, BookOpen, Check, Sparkles, UserPlus, ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  useFellowshipStore,
  formatFellowScholarLabel,
  type AcceptedFellowSummary,
} from '@/stores/useFellowshipStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

export interface SymposiumInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: number;
  bookTitle?: string;
  preselectedFellow?: {
    fellowId: string;
    username: string;
    displayName: string;
  };
}

export const SymposiumInviteModal: React.FC<SymposiumInviteModalProps> = ({
  isOpen,
  onClose,
  bookId: initialBookId,
  bookTitle: initialBookTitle,
  preselectedFellow,
}) => {
  const { getAcceptedFellows, createSymposiumInvite, inviteFellowByUsername } =
    useFellowshipStore(
      useShallow((s) => ({
        circles: s.circles,
        getAcceptedFellows: s.getAcceptedFellows,
        createSymposiumInvite: s.createSymposiumInvite,
        inviteFellowByUsername: s.inviteFellowByUsername,
      }))
    );
  const savedBooks = useBookshelfStore((s) => s.savedBooks);

  const acceptedFellows: AcceptedFellowSummary[] = getAcceptedFellows();
  const [selectedFellowId, setSelectedFellowId] = useState<string>(
    preselectedFellow?.fellowId || acceptedFellows[0]?.fellowId || ''
  );
  const [selectedBookId, setSelectedBookId] = useState<number>(
    initialBookId || savedBooks[0]?.id || 1342
  );
  const [newFellowHandle, setNewFellowHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const effectiveFellow =
    preselectedFellow ||
    acceptedFellows.find((f) => f.fellowId === selectedFellowId) ||
    acceptedFellows[0];

  const selectedBookObj = savedBooks.find((b) => b.id === (initialBookId ?? selectedBookId));
  const effectiveBookId = initialBookId ?? selectedBookObj?.id ?? selectedBookId;
  const effectiveBookTitle =
    initialBookTitle || selectedBookObj?.title || `Volume #${effectiveBookId}`;

  const handleQuickCircleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFellowHandle.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const { error, circle } = await inviteFellowByUsername(newFellowHandle);
    setIsSubmitting(false);
    if (error) {
      setErrorMsg(error.message);
    } else if (circle) {
      setNewFellowHandle('');
      setSuccessMsg(
        `Reader Circle invitation dispatched to @${circle.recipient_username}. Once accepted, you can start a Symposium together.`
      );
    }
  };

  const handleStartSymposium = async () => {
    if (!effectiveFellow) {
      setErrorMsg('Please select or invite a Fellow Scholar first.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { error } = await createSymposiumInvite({
      bookId: effectiveBookId,
      bookTitle: effectiveBookTitle,
      fellowId: effectiveFellow.fellowId,
      fellowUsername: effectiveFellow.username,
      fellowDisplayName: effectiveFellow.displayName,
    });

    setIsSubmitting(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg(
        `Literary Symposium invitation sent to @${effectiveFellow.username} for "${effectiveBookTitle}".`
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Fellow to Literary Symposium"
      maxWidth="lg"
    >
      <div className="p-5 sm:p-6 space-y-4 sm:space-y-5" data-testid="symposium-invite-modal">
        {/* Symposium Volume Card */}
        <div className="p-4 rounded-2xl bg-primary/5 border border-border flex items-start gap-3.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-border text-primary flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Symposium Volume
            </p>
            {initialBookTitle ? (
              <p
                className="text-sm font-serif font-bold text-foreground truncate"
                title={initialBookTitle}
              >
                {initialBookTitle}
              </p>
            ) : savedBooks.length > 0 ? (
              <div className="relative mt-1">
                <select
                  aria-label="Select volume for Symposium"
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(Number(e.target.value))}
                  className="w-full appearance-none py-2 pl-3 pr-8 text-xs font-mono rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary/40 transition-colors cursor-pointer"
                >
                  {savedBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            ) : (
              <p className="text-sm font-serif font-bold text-foreground">
                Pride and Prejudice (#1342)
              </p>
            )}
          </div>
        </div>

        {/* Select Fellow Scholar */}
        {preselectedFellow ? (
          <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-primary/15 to-muted/40 border border-border text-primary flex items-center justify-center font-serif font-bold text-sm shrink-0 select-none">
                {preselectedFellow.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p
                  className="text-xs font-serif font-bold text-foreground truncate"
                  title={preselectedFellow.displayName}
                >
                  {preselectedFellow.displayName}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  @{preselectedFellow.username}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-border font-bold shrink-0">
              Fellow Scholar
            </span>
          </div>
        ) : acceptedFellows.length > 0 ? (
          <div className="space-y-1.5">
            <label
              htmlFor="symposium-fellow-select"
              className="block text-xs font-mono font-bold text-foreground uppercase tracking-wider"
            >
              Choose Fellow Scholar from Reader Circle
            </label>
            <div className="relative">
              <select
                id="symposium-fellow-select"
                value={effectiveFellow?.fellowId || ''}
                onChange={(e) => setSelectedFellowId(e.target.value)}
                className="w-full appearance-none py-2 pl-3 pr-8 text-xs font-mono rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary/40 transition-colors cursor-pointer"
              >
                {acceptedFellows.map((f) => (
                  <option key={f.fellowId} value={f.fellowId}>
                    {formatFellowScholarLabel(f.displayName, f.username)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleQuickCircleInvite} className="space-y-2.5 p-4 rounded-2xl border border-border bg-muted/20">
            <p className="text-xs font-sans text-muted-foreground leading-relaxed">
              Your Reader Circle is currently empty. Invite a companion by their <code className="font-mono text-primary font-bold">@username</code> handle:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFellowHandle}
                onChange={(e) => setNewFellowHandle(e.target.value)}
                placeholder="@scholar_handle"
                aria-label="Scholar handle to invite"
                className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary/40"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSubmitting || !newFellowHandle.trim()}
                className="font-mono text-xs uppercase shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                <span>Invite</span>
              </Button>
            </div>
          </form>
        )}

        <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-start gap-2.5 text-[11px] text-muted-foreground leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            Once accepted, both scholars can view and filter shared marginalia in this volume while keeping all other books private.
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-border text-xs font-mono text-destructive flex items-start gap-2" role="alert">
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-success/10 border border-border text-xs font-mono text-success flex items-start gap-2" role="status">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} className="font-mono text-xs uppercase">
            Close
          </Button>
          {(preselectedFellow || acceptedFellows.length > 0) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartSymposium}
              disabled={isSubmitting}
              className="font-mono text-xs uppercase"
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              <span>Send Symposium Pact</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

