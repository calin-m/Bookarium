'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Highlighter, Bookmark, Search, Trash2, Edit3, ArrowRight, BookOpen, Check, X, Shield, Unlock, Feather } from 'lucide-react';
import { ReaderDrawerShell } from './ReaderDrawerShell';
import type { Annotation, FellowAnnotation, HighlightColor, MarginaliaSourceFilter } from '@/stores/useAnnotationStore';
import {
  isFellowAnnotation,
  filterAndPairAnnotationsBySource,
  computeSharedQuoteSegments,
  type AnyAnnotation,
} from '@/lib/reader-annotator';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { formatFellowScholarLabel } from '@/stores/useFellowshipStore';
import { getReaderTheme } from '@/config/reader-themes';
import { ANNOTATION_COLOR_CONFIG, ANNOTATION_COLOR_LIST, BOOKMARK_DRAWER_TOKEN } from '@/config/annotation-tokens';
import { attachHorizontalDragAndWheelScroll } from '@/lib/scroll-utils';
import { DeleteAnnotationModal } from './DeleteAnnotationModal';
import { ContentCrossfade } from '@/components/motion/ContentCrossfade';
import { Textarea } from '@/components/ui/Textarea';

export interface DrawerPinnedBookmark {
  chapterIndex: number;
  chapterPage: number;
  bookmarkRow: number;
  bookmarkText?: string;
  chapterTitle?: string;
}

export type DrawerFilterColor = HighlightColor | 'bookmark' | 'all';

export interface ReaderAnnotationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  annotations: Annotation[];
  fellowAnnotations?: FellowAnnotation[];
  pinnedBookmark?: DrawerPinnedBookmark | null;
  isViewingPinnedBookmarkPage?: boolean;
  onJumpToBookmark?: () => void;
  onClearBookmark?: () => void;
  hasActiveSymposium?: boolean;
  symposiumCompanionUsername?: string;
  symposiumCompanionDisplayName?: string;
  activeChapterIndex?: number;
  marginaliaSourceFilter?: MarginaliaSourceFilter;
  onSourceFilterChange?: (filter: MarginaliaSourceFilter) => void;
  spoilerShieldEnabled?: boolean;
  onToggleSpoilerShield?: (enabled: boolean) => void;
  bookTitle?: string;
  theme?: ReaderTheme;
  onJumpToAnnotation: (chapterIndex: number, chapterPage: number, annotationId?: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onSaveFellowAnnotation?: (fellow: FellowAnnotation, note?: string, color?: HighlightColor) => Promise<void> | void;
}

export type DrawerDisplayItem = AnyAnnotation & {
  pairedFellowAnnotation?: FellowAnnotation;
  matchingOwnAnnotation?: Annotation;
};

export const ReaderAnnotationsDrawer: React.FC<ReaderAnnotationsDrawerProps> = ({
  isOpen,
  onClose,
  annotations,
  fellowAnnotations = [],
  pinnedBookmark = null,
  isViewingPinnedBookmarkPage = false,
  onJumpToBookmark,
  onClearBookmark,
  hasActiveSymposium = false,
  symposiumCompanionUsername,
  symposiumCompanionDisplayName,
  activeChapterIndex = 0,
  marginaliaSourceFilter,
  onSourceFilterChange,
  spoilerShieldEnabled,
  onToggleSpoilerShield,
  bookTitle: _bookTitle,
  theme = 'light',
  onJumpToAnnotation,
  onDeleteAnnotation,
  onUpdateNote,
  onSaveFellowAnnotation,
}) => {
  const activeTheme = getReaderTheme(theme);
  const [selectedColorFilter, setSelectedColorFilter] = useState<DrawerFilterColor>('all');
  const [localSourceFilter, setLocalSourceFilter] = useState<MarginaliaSourceFilter>('all');
  const [localSpoilerShield, setLocalSpoilerShield] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingFellowId, setSavingFellowId] = useState<string | null>(null);
  const [savingFellowText, setSavingFellowText] = useState('');
  const [itemToDelete, setItemToDelete] = useState<Annotation | null>(null);
  const [isConfirmingClearBookmark, setIsConfirmingClearBookmark] = useState(false);

  const effectiveSourceFilter = marginaliaSourceFilter ?? localSourceFilter;
  const effectiveSpoilerShield = spoilerShieldEnabled ?? localSpoilerShield;
  const activeColorFilter: DrawerFilterColor =
    selectedColorFilter === 'bookmark' && (!pinnedBookmark || effectiveSourceFilter === 'fellows')
      ? 'all'
      : selectedColorFilter;

  const handleSourceChange = (next: MarginaliaSourceFilter) => {
    setLocalSourceFilter(next);
    onSourceFilterChange?.(next);
  };

  const handleToggleShield = () => {
    const next = !effectiveSpoilerShield;
    setLocalSpoilerShield(next);
    onToggleSpoilerShield?.(next);
  };

  const showSymposiumBar = fellowAnnotations.length > 0 || hasActiveSymposium;
  const primaryFellowUsername =
    fellowAnnotations[0]?.fellowUsername && fellowAnnotations[0].fellowUsername !== 'fellow_scholar'
      ? fellowAnnotations[0].fellowUsername
      : symposiumCompanionUsername || fellowAnnotations[0]?.fellowUsername;
  const primaryFellowDisplayName =
    fellowAnnotations[0]?.fellowDisplayName || symposiumCompanionDisplayName;
  const primaryFellowHandle = primaryFellowDisplayName && primaryFellowDisplayName !== primaryFellowUsername
    ? primaryFellowDisplayName
    : primaryFellowUsername
    ? `@${primaryFellowUsername}`
    : 'Fellows';

  const visibleFellowAnnotations = useMemo(() => {
    if (!effectiveSpoilerShield) return fellowAnnotations;
    return fellowAnnotations.filter((fa) => fa.chapterIndex <= activeChapterIndex);
  }, [fellowAnnotations, effectiveSpoilerShield, activeChapterIndex]);

  const combinedSourceAnnotations: DrawerDisplayItem[] = useMemo(() => {
    return filterAndPairAnnotationsBySource(
      annotations,
      visibleFellowAnnotations,
      effectiveSourceFilter
    );
  }, [annotations, visibleFellowAnnotations, effectiveSourceFilter]);

  const canShowBookmarkBySource = Boolean(pinnedBookmark) && effectiveSourceFilter !== 'fellows';
  const normalizedSearch = searchQuery.toLowerCase().trim();
  const isBookmarkVisible = useMemo(() => {
    if (!pinnedBookmark || !canShowBookmarkBySource) return false;
    if (activeColorFilter !== 'all' && activeColorFilter !== 'bookmark') return false;
    if (!normalizedSearch) return true;
    const coordLabel = `sec ${pinnedBookmark.chapterIndex + 1} · page ${pinnedBookmark.chapterPage} · line ${pinnedBookmark.bookmarkRow + 1}`;
    return (
      'bookmark'.includes(normalizedSearch) ||
      coordLabel.includes(normalizedSearch) ||
      (pinnedBookmark.chapterTitle?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (pinnedBookmark.bookmarkText?.toLowerCase().includes(normalizedSearch) ?? false)
    );
  }, [pinnedBookmark, canShowBookmarkBySource, activeColorFilter, normalizedSearch]);

  const filteredAnnotations = useMemo(() => {
    if (activeColorFilter === 'bookmark') return [];
    return combinedSourceAnnotations.filter((a) => {
      const matchesColor = activeColorFilter === 'all' || a.color === activeColorFilter;
      const matchesSearch =
        !normalizedSearch ||
        a.selectedText.toLowerCase().includes(normalizedSearch) ||
        (a.note && a.note.toLowerCase().includes(normalizedSearch)) ||
        (a.pairedFellowAnnotation?.note && a.pairedFellowAnnotation.note.toLowerCase().includes(normalizedSearch)) ||
        (a.pairedFellowAnnotation?.selectedText && a.pairedFellowAnnotation.selectedText.toLowerCase().includes(normalizedSearch));
      return matchesColor && matchesSearch;
    });
  }, [combinedSourceAnnotations, activeColorFilter, normalizedSearch]);

  const totalAllItemsCount =
    combinedSourceAnnotations.length + (canShowBookmarkBySource ? 1 : 0);

  const handleStartEdit = (a: Annotation) => {
    setEditingNoteId(a.id);
    setEditingNoteText(a.note || '');
  };

  const handleSaveEdit = (id: string) => {
    onUpdateNote(id, editingNoteText);
    setEditingNoteId(null);
  };

  const handleJump = (item: AnyAnnotation) => {
    onJumpToAnnotation(item.chapterIndex, item.chapterPage, item.id);
    onClose();
  };

  const handleJumpBookmark = () => {
    onJumpToBookmark?.();
    onClose();
  };

  const colorTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = colorTabsRef.current;
    if (!el) return;
    return attachHorizontalDragAndWheelScroll(el);
  }, [isOpen]);

  return (
    <>
      <ReaderDrawerShell
        isOpen={isOpen}
        onClose={onClose}
        title={`Notes & Highlights (${combinedSourceAnnotations.length})`}
        titleIcon={<Highlighter className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
        theme={theme}
        ariaLabel="Annotations and highlights drawer"
        panelTestId="annotations-drawer-panel"
      >
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Search Bar (Pinned & Non-Compressible) */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              data-testid="annotations-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotes or notes..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all font-sans"
            />
          </div>

          {/* Progressive Disclosure Single-Row Symposium Source Filter + Spoiler Shield */}
          {showSymposiumBar && (
            <div
              data-testid="drawer-symposium-filter-bar"
              className="flex items-center justify-between gap-2 shrink-0 py-1 px-1.5 rounded-xl bg-stone-100/70 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800"
            >
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  data-testid="drawer-source-all"
                  onClick={() => handleSourceChange('all')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    effectiveSourceFilter === 'all'
                      ? 'bg-primary-600 text-white shadow-2xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  data-testid="drawer-source-mine"
                  onClick={() => handleSourceChange('mine')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    effectiveSourceFilter === 'mine'
                      ? 'bg-primary-600 text-white shadow-2xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800'
                  }`}
                >
                  Mine ({annotations.length})
                </button>
                <button
                  type="button"
                  data-testid="drawer-source-fellows"
                  onClick={() => handleSourceChange('fellows')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer truncate max-w-[120px] ${
                    effectiveSourceFilter === 'fellows'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  {primaryFellowHandle} ({visibleFellowAnnotations.length})
                </button>
              </div>

              <button
                type="button"
                data-testid="drawer-spoiler-shield-btn"
                onClick={handleToggleShield}
                title={
                  effectiveSpoilerShield
                    ? `Spoiler Shield ON: Hiding Fellow notes beyond Section ${activeChapterIndex + 1}`
                    : 'Spoiler Shield OFF: Showing all Fellow notes across the entire volume'
                }
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors shrink-0 cursor-pointer ${
                  effectiveSpoilerShield
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                {effectiveSpoilerShield ? (
                  <>
                    <Shield className="w-3 h-3 shrink-0" />
                    <span>Ch. 1–{activeChapterIndex + 1}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3 shrink-0" />
                    <span>All</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Color Filter Tabs (Pinned & Non-Compressible) */}
          <div
            ref={colorTabsRef}
            data-testid="annotations-color-tabs"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none overscroll-x-contain shrink-0 cursor-grab select-none"
          >
            <button
              type="button"
              data-testid="filter-color-all"
              onClick={() => setSelectedColorFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                activeColorFilter === 'all'
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              All ({totalAllItemsCount})
            </button>
            {canShowBookmarkBySource && (
              <button
                type="button"
                data-testid="filter-color-bookmark"
                onClick={() => setSelectedColorFilter('bookmark')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                  activeColorFilter === 'bookmark'
                    ? BOOKMARK_DRAWER_TOKEN.pillActiveClass
                    : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${BOOKMARK_DRAWER_TOKEN.dotClass}`} />
                <span>{BOOKMARK_DRAWER_TOKEN.label}</span>
                <span className="text-[10px] opacity-70">(1)</span>
              </button>
            )}
            {ANNOTATION_COLOR_LIST.map((c) => {
              const count = combinedSourceAnnotations.filter((a) => a.color === c.id).length;
              const isSelected = activeColorFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`filter-color-${c.id}`}
                  onClick={() => setSelectedColorFilter(c.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                      : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dotClass}`} />
                  <span>{c.label}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Annotations List (Vertically Scrollable within modal boundaries) */}
          <div
            data-testid="annotations-list-container"
            className={`flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 ${activeTheme.scrollbarClass}`}
          >
            <ContentCrossfade
              transitionKey={`annotations-list-${activeColorFilter}-${effectiveSourceFilter}-${normalizedSearch}`}
              className="space-y-3"
            >
              {isBookmarkVisible && pinnedBookmark && (
                <div
                  data-testid="drawer-bookmark-item"
                  className={`rounded-xl border border-stone-200 dark:border-stone-800 border-l-4 p-3.5 flex flex-col gap-2.5 transition-all shadow-xs ${BOOKMARK_DRAWER_TOKEN.drawerCardClass}`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-semibold text-stone-700 dark:text-stone-300">
                        Sec {pinnedBookmark.chapterIndex + 1} · Page {pinnedBookmark.chapterPage} · Line {pinnedBookmark.bookmarkRow + 1}
                      </span>
                      <span
                        data-testid="drawer-bookmark-badge"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${BOOKMARK_DRAWER_TOKEN.badgeClass}`}
                      >
                        <Bookmark className="w-2.5 h-2.5 fill-current" />
                        <span>{BOOKMARK_DRAWER_TOKEN.label}</span>
                      </span>
                      {isViewingPinnedBookmarkPage && (
                        <span
                          data-testid="drawer-bookmark-active-badge"
                          className="px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-800/90 text-stone-700 dark:text-stone-300 font-semibold"
                        >
                          On this page
                        </span>
                      )}
                    </div>
                    {onClearBookmark && (
                      <button
                        type="button"
                        data-testid="drawer-bookmark-clear-btn"
                        aria-label="Clear bookmark"
                        onClick={() => setIsConfirmingClearBookmark(true)}
                        className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {pinnedBookmark.bookmarkText ? (
                    <blockquote
                      data-testid="drawer-bookmark-quote-text"
                      onClick={onJumpToBookmark ? handleJumpBookmark : undefined}
                      className={`font-serif italic text-sm text-foreground/90 leading-relaxed ${
                        onJumpToBookmark
                          ? `cursor-pointer hover:underline ${BOOKMARK_DRAWER_TOKEN.quoteHoverUnderlineClass} underline-offset-2`
                          : ''
                      }`}
                    >
                      &ldquo;{pinnedBookmark.bookmarkText}&rdquo;
                    </blockquote>
                  ) : pinnedBookmark.chapterTitle ? (
                    <p
                      data-testid="drawer-bookmark-chapter-fallback"
                      className="text-xs font-serif text-foreground/80"
                    >
                      Pinned in {pinnedBookmark.chapterTitle}
                    </p>
                  ) : null}

                  {onJumpToBookmark && (
                    <button
                      type="button"
                      data-testid="drawer-bookmark-jump-btn"
                      onClick={handleJumpBookmark}
                      className={`flex items-center gap-1 text-[11px] font-medium ${BOOKMARK_DRAWER_TOKEN.jumpLinkClass} hover:underline pt-0.5 self-start cursor-pointer`}
                    >
                      <span>Jump to bookmark</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {filteredAnnotations.length === 0 && !isBookmarkVisible ? (
                <div
                  data-testid="annotations-empty-state"
                  className={`text-center py-16 px-4 rounded-xl border border-dashed ${activeTheme.border} ${activeTheme.textMuted}`}
                >
                  <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="font-serif text-sm font-semibold text-inherit mb-1">
                    {combinedSourceAnnotations.length === 0 && !canShowBookmarkBySource
                      ? 'No Highlights Yet'
                      : 'No Matching Highlights'}
                  </p>
                  <p className="text-xs max-w-xs mx-auto leading-relaxed">
                    {combinedSourceAnnotations.length === 0 && !canShowBookmarkBySource
                      ? 'Select any passage of text while reading to highlight quotes, choose colors, or attach personal scholarly notes.'
                      : 'Try adjusting your color filter or search query.'}
                  </p>
                </div>
              ) : (
                filteredAnnotations.map((item) => {
                  const isFellow = isFellowAnnotation(item);
                  return (
                    <div
                      key={item.id}
                      data-testid={`annotation-item-${item.id}`}
                      className={`rounded-xl border border-stone-200 dark:border-stone-800 border-l-4 p-3.5 flex flex-col gap-2.5 transition-all shadow-xs ${
                        isFellow
                          ? 'border-l-amber-600 bg-amber-500/5'
                          : (ANNOTATION_COLOR_CONFIG[item.color] || ANNOTATION_COLOR_CONFIG.yellow).drawerCardClass
                      }`}
                    >
                      {/* Header: Section/Page Badge + Actions */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-semibold text-stone-700 dark:text-stone-300">
                            Sec {item.chapterIndex + 1} · Page {item.chapterPage}
                          </span>
                          {item.pairedFellowAnnotation && (
                            <span
                              data-testid={`drawer-fellow-badge-${item.pairedFellowAnnotation.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold"
                            >
                              <Feather className="w-2.5 h-2.5" />
                              <span>
                                {formatFellowScholarLabel(
                                  item.pairedFellowAnnotation.fellowDisplayName,
                                  item.pairedFellowAnnotation.fellowUsername
                                )}
                              </span>
                            </span>
                          )}
                          {isFellow && (
                            <span
                              data-testid={`drawer-fellow-badge-${item.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold"
                            >
                              <Feather className="w-2.5 h-2.5" />
                              <span>
                                {formatFellowScholarLabel(item.fellowDisplayName, item.fellowUsername)}
                              </span>
                            </span>
                          )}
                        </div>
                        {!isFellow && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              data-testid={`annotation-edit-btn-${item.id}`}
                              aria-label="Edit note"
                              onClick={() => handleStartEdit(item as Annotation)}
                              className="p-1 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              data-testid={`annotation-delete-btn-${item.id}`}
                              aria-label="Delete annotation"
                              onClick={() => setItemToDelete(item as Annotation)}
                              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Highlighted Quote Text */}
                      {(() => {
                        const segments = computeSharedQuoteSegments(
                          item.selectedText,
                          item.pairedFellowAnnotation?.selectedText
                        );
                        return (
                          <blockquote
                            data-testid="annotation-quote-text"
                            onClick={() => handleJump(item)}
                            className="font-serif italic text-sm text-foreground/90 leading-relaxed cursor-pointer hover:underline decoration-primary/40 underline-offset-2"
                          >
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

                      {/* Note Section */}
                      {!isFellow && editingNoteId === item.id ? (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <Textarea
                            variant="reader"
                            data-testid="annotation-edit-textarea"
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            placeholder="Enter personal note..."
                            rows={2}
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                            >
                              <X className="w-3.5 h-3.5 inline mr-0.5" /> Cancel
                            </button>
                            <button
                              type="button"
                              data-testid="annotation-save-edit-btn"
                              onClick={() => handleSaveEdit(item.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary-600 text-white hover:bg-primary-700"
                            >
                              <Check className="w-3.5 h-3.5 inline mr-0.5" /> Save
                            </button>
                          </div>
                        </div>
                      ) : item.note ? (
                        <div
                          data-testid="annotation-note-text"
                          className={`text-xs text-stone-700 dark:text-stone-300 bg-black/5 dark:bg-white/5 p-2 rounded-lg font-sans border-l-2 ${
                            isFellow ? 'border-amber-500' : 'border-primary-500'
                          }`}
                        >
                          {item.note}
                        </div>
                      ) : null}

                      {/* Paired Fellow Note Box */}
                      {item.pairedFellowAnnotation && (
                        <div
                          data-testid={`drawer-paired-fellow-note-${item.pairedFellowAnnotation.id}`}
                          className="text-xs text-stone-700 dark:text-stone-300 bg-amber-500/10 dark:bg-amber-950/20 p-2.5 rounded-lg font-sans border-l-2 border-amber-500 space-y-1"
                        >
                          <div className="text-[10px] font-mono text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                            <Feather className="w-2.5 h-2.5" />
                            <span>
                              {item.pairedFellowAnnotation.fellowDisplayName || `@${item.pairedFellowAnnotation.fellowUsername}`}
                            </span>
                          </div>
                          {item.pairedFellowAnnotation.note ? (
                            <p className="leading-relaxed whitespace-pre-wrap">{item.pairedFellowAnnotation.note}</p>
                          ) : (
                            <p className="leading-relaxed italic text-stone-500 dark:text-stone-400 text-[11px]">
                              Also saved and highlighted in this Literary Symposium.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Standalone Fellow Action: Save to My Notes or Reply */}
                      {isFellow && onSaveFellowAnnotation && (
                        savingFellowId === item.id ? (
                          <div className="flex flex-col gap-1.5 pt-1">
                            <Textarea
                              variant="reader"
                              data-testid={`drawer-reply-textarea-${item.id}`}
                              value={savingFellowText}
                              onChange={(e) => setSavingFellowText(e.target.value)}
                              placeholder="Write your personal note to save with this highlight..."
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSavingFellowId(null)}
                                className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                              >
                                <X className="w-3.5 h-3.5 inline mr-0.5" /> Cancel
                              </button>
                              <button
                                type="button"
                                data-testid={`drawer-save-fellow-with-note-btn-${item.id}`}
                                onClick={async () => {
                                  await onSaveFellowAnnotation(
                                    item as FellowAnnotation,
                                    savingFellowText,
                                    item.matchingOwnAnnotation?.color
                                  );
                                  setSavingFellowId(null);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary-600 text-white hover:bg-primary-700"
                              >
                                <Check className="w-3.5 h-3.5 inline mr-0.5" /> Save Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-0.5">
                            {item.matchingOwnAnnotation ? (
                              <span
                                data-testid={`drawer-fellow-saved-badge-${item.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 select-none"
                              >
                                <Check className="w-3 directions-item" />
                                <span>In My Notes</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                data-testid={`drawer-save-fellow-note-btn-${item.id}`}
                                onClick={async () => {
                                  await onSaveFellowAnnotation(item as FellowAnnotation);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save to My Notes</span>
                              </button>
                            )}
                            <span className="text-stone-300 dark:text-stone-700 select-none">•</span>
                            <button
                              type="button"
                              data-testid={`drawer-reply-fellow-note-btn-${item.id}`}
                              onClick={() => {
                                setSavingFellowId(item.id);
                                setSavingFellowText(item.matchingOwnAnnotation?.note || '');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{item.matchingOwnAnnotation?.note ? 'Edit My Note' : '+ Add My Note'}</span>
                            </button>
                          </div>
                        )
                      )}

                      {/* Jump to passage button */}
                      <button
                        type="button"
                        data-testid={`annotation-jump-btn-${item.id}`}
                        onClick={() => handleJump(item)}
                        className="flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline pt-1 self-start cursor-pointer"
                      >
                        <span>Jump to passage</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </ContentCrossfade>
          </div>
        </div>
      </ReaderDrawerShell>

    {/* Delete Single Annotation Confirmation Modal (Rendered outside drawer transform hierarchy) */}
    <DeleteAnnotationModal
      isOpen={itemToDelete !== null}
      onClose={() => setItemToDelete(null)}
      onConfirm={() => {
        if (itemToDelete) {
          onDeleteAnnotation(itemToDelete.id);
          setItemToDelete(null);
        }
      }}
      annotation={itemToDelete}
      title="Delete Saved Highlight & Note?"
      description="This will remove the highlight and any attached personal reflection from your saved notes. This action cannot be undone."
    />

    {/* Clear Silk Bookmark Confirmation Modal (Rendered outside drawer transform hierarchy) */}
    <DeleteAnnotationModal
      isOpen={isConfirmingClearBookmark && pinnedBookmark !== null}
      onClose={() => setIsConfirmingClearBookmark(false)}
      onConfirm={() => {
        setIsConfirmingClearBookmark(false);
        onClearBookmark?.();
      }}
      annotation={
        pinnedBookmark
          ? {
              selectedText:
                pinnedBookmark.bookmarkText ||
                pinnedBookmark.chapterTitle ||
                'Silk Ribbon Bookmark',
              note: `Sec ${pinnedBookmark.chapterIndex + 1} · Page ${pinnedBookmark.chapterPage} · Line ${pinnedBookmark.bookmarkRow + 1}`,
            }
          : null
      }
      title="Remove Silk Bookmark?"
      headline="Are you sure you want to clear your silk bookmark?"
      description="This will reset your saved reading line ribbon back to Line 1 for this volume. Highlights and personal notes will remain untouched."
      confirmLabel="Clear Bookmark"
      confirmTestId="confirm-clear-bookmark-btn"
    />
  </>
);
};

