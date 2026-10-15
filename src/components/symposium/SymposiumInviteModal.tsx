'use client';

import React, { useState } from 'react';
import { Users, BookOpen, Check, Sparkles, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useFellowshipStore, type AcceptedFellowSummary } from '@/stores/useFellowshipStore';
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
    useFellowshipStore();
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
      maxWidth="md"
      backdropClassName="bg-transparent backdrop-blur-none"
    >
      <div className="space-y-4" data-testid="symposium-invite-modal">
        <div className="p-3.5 rounded-xl bg-primary/5 border border-border flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Symposium Volume
            </p>
            {initialBookTitle ? (
              <p className="text-sm font-serif font-bold text-foreground truncate">
                {initialBookTitle}
              </p>
            ) : savedBooks.length > 0 ? (
              <select
                aria-label="Select volume for Symposium"
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(Number(e.target.value))}
                className="mt-1 w-full py-1.5 px-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground"
              >
                {savedBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-serif font-bold text-foreground">
                Pride and Prejudice (#1342)
              </p>
            )}
          </div>
        </div>

        {/* Select Fellow Scholar */}
        {preselectedFellow ? (
          <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-serif font-bold text-foreground truncate">
                  {preselectedFellow.displayName}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  @{preselectedFellow.username}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              Fellow Scholar
            </span>
          </div>
        ) : acceptedFellows.length > 0 ? (
          <div className="space-y-1.5">
            <label
              htmlFor="symposium-fellow-select"
              className="block text-xs font-mono font-bold text-foreground"
            >
              Choose Fellow Scholar from Reader Circle
            </label>
            <select
              id="symposium-fellow-select"
              value={effectiveFellow?.fellowId || ''}
              onChange={(e) => setSelectedFellowId(e.target.value)}
              className="w-full py-2 px-3 text-xs font-mono rounded-xl border border-border bg-card text-foreground"
            >
              {acceptedFellows.map((f) => (
                <option key={f.fellowId} value={f.fellowId}>
                  {f.displayName} (@{f.username})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <form onSubmit={handleQuickCircleInvite} className="space-y-2 p-3.5 rounded-xl border border-border bg-muted/20">
            <p className="text-xs font-sans text-muted-foreground">
              Your Reader Circle is currently empty. Invite a companion by their <code className="font-mono text-primary">@username</code> handle:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFellowHandle}
                onChange={(e) => setNewFellowHandle(e.target.value)}
                placeholder="@scholar_handle"
                aria-label="Scholar handle to invite"
                className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSubmitting || !newFellowHandle.trim()}
                className="font-mono text-xs shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                <span>Invite</span>
              </Button>
            </div>
          </form>
        )}

        <p className="text-[11px] text-muted-foreground font-sans flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>
            Once accepted, both scholars can view and filter shared marginalia in this volume while keeping all other books private.
          </span>
        </p>

        {errorMsg && (
          <p className="text-xs font-mono text-destructive" role="alert">
            {errorMsg}
          </p>
        )}

        {successMsg && (
          <p className="text-xs font-mono text-success flex items-center gap-1.5" role="status">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{successMsg}</span>
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} className="font-mono text-xs">
            Close
          </Button>
          {(preselectedFellow || acceptedFellows.length > 0) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartSymposium}
              disabled={isSubmitting}
              className="font-mono text-xs"
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

