'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  MessageSquare,
  Lock,
  Feather,
} from 'lucide-react';
import type { Annotation, FellowAnnotation, HighlightColor } from '@/stores/useAnnotationStore';
import { formatFellowScholarLabel } from '@/stores/useFellowshipStore';
import {
  isFellowAnnotation,
  computeSharedQuoteSegments,
} from '@/lib/reader-annotator';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  CopyBookLinkIndicator,
  handleCopyBookLinkClick,
} from '@/components/ui/CursorTooltip';
import {
  QuickColorSwatchPopover,
  HIGHLIGHT_COLOR_SWATCHES,
  HIGHLIGHT_CARD_COLORS,
} from './notebook/QuickColorSwatchPopover';

export { HIGHLIGHT_COLOR_SWATCHES, HIGHLIGHT_CARD_COLORS, QuickColorSwatchPopover };

export interface NotebookQuoteCardProps {
  annotation: Annotation | FellowAnnotation;
  pairedFellowAnnotation?: FellowAnnotation;
  matchingOwnAnnotation?: Annotation;
  bookTitle: string;
  bookAuthor: string;
  isRestricted?: boolean;
  isUnavailableOffline?: boolean;
  jurisdictionCountry?: string;
  isActive?: boolean;
  onActivate?: (id: string) => void;
  isEditing?: boolean;
  onStartEdit?: (ann: Annotation) => void;
  onCancelEdit?: () => void;
  onSaveNote: (
    id: string,
    noteText: string,
    color: HighlightColor,
    originalColor: HighlightColor
  ) => Promise<void> | void;
  onUpdateColor: (id: string, color: HighlightColor) => Promise<void> | void;
  onRequestDeleteReflection: (ann: Annotation) => void;
  onRequestDeleteAnnotation: (ann: Annotation) => void;
  onJumpToReader: (ann: Annotation | FellowAnnotation) => void;
  onSaveFellowAsOwn?: (
    fellow: FellowAnnotation,
    noteText?: string,
    color?: HighlightColor
  ) => Promise<void> | void;
}

/**
 * Self-contained literary notebook card rendering a highlighted passage,
 * quick color swatch popover, citation copy feedback, and inline reflection editing.
 */
export const NotebookQuoteCard: React.FC<NotebookQuoteCardProps> = ({
  annotation: ann,
  pairedFellowAnnotation,
  matchingOwnAnnotation,
  bookTitle,
  bookAuthor,
  isRestricted = false,
  isUnavailableOffline = false,
  jurisdictionCountry,
  isActive = false,
  onActivate,
  isEditing = false,
  onStartEdit,
  onCancelEdit,
  onSaveNote,
  onUpdateColor,
  onRequestDeleteReflection,
  onRequestDeleteAnnotation,
  onJumpToReader,
  onSaveFellowAsOwn,
}) => {
  const [editNoteText, setEditNoteText] = useState(ann.note || '');
  const [editColor, setEditColor] = useState<HighlightColor>(ann.color);
  const [isCopied, setIsCopied] = useState(false);
  const [isAddingOwnNote, setIsAddingOwnNote] = useState(false);
  const [ownNoteDraft, setOwnNoteDraft] = useState('');

  const [prevIsEditing, setPrevIsEditing] = useState(isEditing);
  if (isEditing !== prevIsEditing) {
    setPrevIsEditing(isEditing);
    if (isEditing) {
      setEditNoteText(ann.note || '');
      setEditColor(ann.color);
    }
  }

  const activeColor = isEditing ? editColor : ann.color;
  const colorStyle = HIGHLIGHT_CARD_COLORS[activeColor] || HIGHLIGHT_CARD_COLORS.yellow;

  const handleCopyCitation = () => {
    const citation = `"${ann.selectedText}"\n— ${bookAuthor}, ${bookTitle} (Section ${ann.chapterIndex + 1}, Page ${ann.chapterPage})`;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(citation).catch(() => {});
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStartEditInternal = () => {
    setEditNoteText(ann.note || '');
    setEditColor(ann.color);
    onStartEdit?.(ann);
  };

  const handleCancelInternal = () => {
    setEditColor(ann.color);
    setEditNoteText(ann.note || '');
    onCancelEdit?.();
  };

  const handleSaveInternal = async () => {
    await onSaveNote(ann.id, editNoteText, editColor, ann.color);
  };

  const isFellow = isFellowAnnotation(ann);

  return (
    <article
      data-testid={`notebook-quote-card-${ann.id}`}
      data-notebook-quote-id={ann.id}
      data-active={isActive ? 'true' : 'false'}
      onClick={() => onActivate?.(ann.id)}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all duration-300 border-l-4 ${
        isActive
          ? 'border-primary/40 shadow-booksaw-hover bg-card'
          : `${isFellow ? 'border-l-amber-600' : colorStyle.border} border-border bg-card shadow-booksaw hover:shadow-booksaw-hover hover:border-primary/40`
      }`}
    >
      <div className="space-y-3">
        {/* Metadata Topline */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span
              data-testid={`notebook-card-copy-meta-${ann.id}`}
              data-copy-book-id={ann.bookId}
              data-tooltip={`${bookTitle} — by ${bookAuthor}`}
              onClick={(e) => handleCopyBookLinkClick(e, ann.bookId)}
              onKeyDown={(e) => handleCopyBookLinkClick(e, ann.bookId)}
              role="button"
              tabIndex={0}
              aria-label={`Copy link to ${bookTitle} by ${bookAuthor}`}
              className="group/copy inline-flex items-center gap-1.5 min-w-0 truncate cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-muted/60 transition-colors"
            >
              <span className="font-semibold text-foreground group-hover/copy:text-primary transition-colors truncate">
                {bookTitle}
              </span>
              <span className="text-muted-foreground inline truncate">
                by {bookAuthor}
              </span>
              <CopyBookLinkIndicator bookId={ann.bookId} />
            </span>
            {isRestricted && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0"
                title={`Protected by copyright in ${jurisdictionCountry || 'your jurisdiction'}`}
              >
                <Lock className="w-2 h-2" />
                Protected
              </span>
            )}
            <span>•</span>
            <span className="truncate">
              Section {ann.chapterIndex + 1}, p. {ann.chapterPage}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pairedFellowAnnotation && (
              <span
                data-testid={`notebook-fellow-badge-${pairedFellowAnnotation.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0"
              >
                <Feather className="w-2.5 h-2.5" />
                <span>
                  {formatFellowScholarLabel(
                    pairedFellowAnnotation.fellowDisplayName,
                    pairedFellowAnnotation.fellowUsername
                  )}
                </span>
              </span>
            )}

            {isFellow ? (
              <span
                data-testid={`notebook-fellow-badge-${ann.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0"
              >
                <Feather className="w-2.5 h-2.5" />
                <span>
                  {formatFellowScholarLabel(ann.fellowDisplayName, ann.fellowUsername)}
                </span>
              </span>
            ) : (
              /* Quick Color Swatch Badge & Popover */
              <QuickColorSwatchPopover
                annotationId={ann.id}
                activeColor={activeColor}
                savedColor={ann.color}
                isEditing={isEditing}
                onSelectColor={onUpdateColor}
              />
            )}
          </div>
        </div>

        {/* Highlight Quote */}
        {(() => {
          const segments = computeSharedQuoteSegments(
            ann.selectedText,
            pairedFellowAnnotation?.selectedText
          );
          return (
            <blockquote className="font-serif italic text-sm sm:text-base text-foreground leading-relaxed">
              &ldquo;
              {segments.isExact ? (
                segments.fullQuote
              ) : (
                <>
                  {segments.beforeText}
                  <mark
                    data-testid="shared-quote-overlap-span"
                    className="bg-amber-500/25 border-b-2 border-dashed border-amber-600/75 dark:border-amber-400/75 rounded-xs px-0.5 not-italic"
                  >
                    {segments.overlapText}
                  </mark>
                  {segments.afterText}
                </>
              )}
              &rdquo;
            </blockquote>
          );
        })()}

        {/* Personal Note Box */}
        {isFellow ? (
          <>
            {ann.note ? (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-sans text-foreground/90 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-amber-800 dark:text-amber-300">
                  <span className="flex items-center gap-1 font-bold">
                    <Feather className="w-3 h-3" />
                    Fellow Reflection ({formatFellowScholarLabel(ann.fellowDisplayName, ann.fellowUsername)})
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{ann.note}</p>
              </div>
            ) : null}

            {/* Paired or Matching Personal Reflection Box */}
            {matchingOwnAnnotation?.note && !isAddingOwnNote && (
              <div
                data-testid={`notebook-matching-own-note-${ann.id}`}
                className="p-2.5 rounded-lg bg-muted/60 border border-border text-xs font-sans text-foreground/90 space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-primary" />
                    Personal Reflection
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnNoteDraft(matchingOwnAnnotation.note || '');
                      setIsAddingOwnNote(true);
                    }}
                    className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{matchingOwnAnnotation.note}</p>
              </div>
            )}

            {/* Inline Personal Reflection Editor for Fellow Cards */}
            {isAddingOwnNote && (
              <div className="space-y-2.5 pt-1">
                <Textarea
                  variant="subtle"
                  data-testid={`notebook-fellow-note-textarea-${ann.id}`}
                  value={ownNoteDraft}
                  onChange={(e) => setOwnNoteDraft(e.target.value)}
                  placeholder="Write your reflection or personal note..."
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingOwnNote(false);
                      setOwnNoteDraft('');
                    }}
                    className="px-2.5 py-1 text-xs font-mono rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    data-testid={`notebook-save-fellow-with-note-btn-${ann.id}`}
                    onClick={async () => {
                      if (onSaveFellowAsOwn) {
                        await onSaveFellowAsOwn(
                          ann as FellowAnnotation,
                          ownNoteDraft,
                          matchingOwnAnnotation?.color
                        );
                      }
                      setIsAddingOwnNote(false);
                    }}
                    className="text-xs font-mono uppercase h-7 px-3"
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : isEditing ? (
          <div className="space-y-2.5 pt-1">
            {/* Highlight Shade Picker in Edit Mode */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border">
              <span className="text-[11px] font-mono text-muted-foreground">Highlight Shade:</span>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Highlight color">
                {HIGHLIGHT_COLOR_SWATCHES.map((c) => {
                  const isSelected = editColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={c.label}
                      title={c.label}
                      onClick={() => setEditColor(c.id)}
                      data-testid={`edit-color-btn-${ann.id}-${c.id}`}
                      className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none ${c.pillClass} ${
                        isSelected ? c.activeRing : ''
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <Textarea
              variant="subtle"
              data-testid={`edit-note-textarea-${ann.id}`}
              value={editNoteText}
              onChange={(e) => setEditNoteText(e.target.value)}
              placeholder="Write your reflection or personal note..."
              rows={3}
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              {ann.note ? (
                <button
                  type="button"
                  onClick={() => onRequestDeleteReflection(ann)}
                  aria-label="Delete note"
                  data-testid={`delete-reflection-editor-btn-${ann.id}`}
                  className="text-[11px] font-mono text-destructive/80 hover:text-destructive hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Note</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelInternal}
                  className="px-2.5 py-1 text-xs font-mono rounded text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  onClick={handleSaveInternal}
                  className="text-xs font-mono uppercase h-7 px-3"
                >
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        ) : ann.note ? (
          <div className="p-2.5 rounded-lg bg-muted/60 border border-border text-xs font-sans text-foreground/90 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-primary" />
                Personal Reflection
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartEditInternal}
                  aria-label="Edit personal reflection"
                  className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  Edit
                </button>
                <span className="text-border select-none" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onRequestDeleteReflection(ann)}
                  aria-label="Delete personal reflection"
                  data-testid={`delete-reflection-btn-${ann.id}`}
                  className="text-muted-foreground hover:text-destructive hover:underline cursor-pointer transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap">{ann.note}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEditInternal}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors pt-1 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" />
            <span>Add a personal note...</span>
          </button>
        )}

        {/* Paired Fellow Reflection Box */}
        {pairedFellowAnnotation && (
          <div
            data-testid={`notebook-paired-fellow-note-${pairedFellowAnnotation.id}`}
            className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-sans text-foreground/90 space-y-1"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1 font-bold">
                <Feather className="w-3 h-3" />
                Fellow Reflection ({formatFellowScholarLabel(pairedFellowAnnotation.fellowDisplayName, pairedFellowAnnotation.fellowUsername)})
              </span>
            </div>
            {pairedFellowAnnotation.note ? (
              <p className="leading-relaxed whitespace-pre-wrap">{pairedFellowAnnotation.note}</p>
            ) : (
              <p className="leading-relaxed italic text-muted-foreground text-[11px]">
                Also saved and highlighted in this Literary Symposium.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-border text-xs font-mono">
        <div className="flex items-center gap-1 text-muted-foreground">
          {/* Copy Citation */}
          <button
            type="button"
            onClick={handleCopyCitation}
            data-testid={`copy-citation-btn-${ann.id}`}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] cursor-pointer"
            title="Copy quote with full academic citation"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {isFellow && onSaveFellowAsOwn && (
            matchingOwnAnnotation ? (
              <div className="flex items-center gap-1">
                <span
                  data-testid={`notebook-fellow-saved-badge-${ann.id}`}
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-medium select-none"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>In My Notes</span>
                </span>
                <span className="text-border select-none" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOwnNoteDraft(matchingOwnAnnotation.note || '');
                    setIsAddingOwnNote(true);
                  }}
                  data-testid={`notebook-add-fellow-note-btn-${ann.id}`}
                  className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] cursor-pointer"
                  title={matchingOwnAnnotation.note ? 'Edit your personal note' : 'Add your personal note'}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{matchingOwnAnnotation.note ? 'Edit My Note' : '+ Add My Note'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSaveFellowAsOwn(ann as FellowAnnotation)}
                  data-testid={`notebook-save-fellow-btn-${ann.id}`}
                  className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  title="Save passage to your own notes"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save to My Notes</span>
                </button>
                <span className="text-border select-none" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOwnNoteDraft('');
                    setIsAddingOwnNote(true);
                  }}
                  data-testid={`notebook-add-fellow-note-btn-${ann.id}`}
                  className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] cursor-pointer"
                  title="Add personal note to this passage"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>+ Add My Note</span>
                </button>
              </div>
            )
          )}

          {!isFellow && (
            <>
              {/* Edit Note & Color */}
              <button
                type="button"
                onClick={handleStartEditInternal}
                data-testid={`edit-quote-btn-${ann.id}`}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] cursor-pointer"
                title="Edit personal reflection and color"
                aria-label="Edit personal reflection and color"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              {/* Delete Annotation */}
              <button
                type="button"
                onClick={() => onRequestDeleteAnnotation(ann)}
                data-testid={`delete-quote-btn-${ann.id}`}
                className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                title="Delete passage"
                aria-label="Delete passage"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Jump to Reader */}
        <button
          type="button"
          disabled={isUnavailableOffline}
          onClick={() => {
            if (isUnavailableOffline) return;
            onJumpToReader(ann);
          }}
          data-testid={`jump-reader-btn-${ann.id}`}
          title={
            isUnavailableOffline
              ? 'Not downloaded for offline reading'
              : 'Jump to passage in Focus Reader'
          }
          className={`inline-flex items-center gap-1 font-medium text-[11px] ${
            isUnavailableOffline
              ? 'text-muted-foreground opacity-60 cursor-not-allowed'
              : 'text-primary hover:underline cursor-pointer'
          }`}
        >
          <span>{isUnavailableOffline ? 'Unavailable Offline' : 'Read Passage'}</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </article>
  );
};

