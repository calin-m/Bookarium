'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Share2,
  Sun,
  Coffee,
  Moon,
} from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { ReaderDrawerShell } from './ReaderDrawerShell';
import {
  CARD_DIMENSIONS,
  renderReadingCardToCanvas,
  exportReadingCardBlob,
  buildReadingShareText,
  buildReadingCardShareUrl,
  type ReadingCardConfig,
} from '@/lib/reading-card-export';
import { SITE_CONFIG } from '@/config/site-config';
import { resolveCanonicalShareOrigin } from '@/lib/redirect-sanitizer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SocialSharePanel } from '@/components/share/SocialSharePanel';

export interface ReaderShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string | number;
  title: string;
  author: string;
  theme: ReaderTheme;
  progress?: number;
  currentChapterIndex?: number;
  totalChapters?: number;
}

export const ReaderShareModal: React.FC<ReaderShareModalProps> = ({
  isOpen,
  onClose,
  bookId,
  title,
  author,
  theme,
  progress = 0,
  currentChapterIndex = 0,
  totalChapters = 1,
}) => {
  const activeTheme = getReaderTheme(theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cardThemeOverride, setCardThemeOverride] = useState<{
    baseTheme: ReaderTheme;
    selectedTheme: ReaderTheme;
  } | null>(null);
  const cardTheme: ReaderTheme =
    isOpen && cardThemeOverride && cardThemeOverride.baseTheme === theme
      ? cardThemeOverride.selectedTheme
      : theme;
  const [includeProgress, setIncludeProgress] = useState<boolean>(true);

  const handleCloseModal = useCallback(() => {
    setCardThemeOverride(null);
    onClose();
  }, [onClose]);

  const origin = useMemo(() => {
    const rawOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : SITE_CONFIG.SITE_URL;
    return resolveCanonicalShareOrigin(rawOrigin, SITE_CONFIG.SITE_URL);
  }, []);

  const siteHost = useMemo(() => {
    try {
      return new URL(origin).host;
    } catch {
      return SITE_CONFIG.SITE_HOST;
    }
  }, [origin]);

  const cardConfig: ReadingCardConfig = useMemo(
    () => ({
      bookId,
      title,
      author,
      theme: cardTheme,
      progress: Math.round(progress),
      currentSection: currentChapterIndex + 1,
      totalSections: Math.max(1, totalChapters),
      includeProgress,
      siteHost,
    }),
    [bookId, title, author, cardTheme, progress, currentChapterIndex, totalChapters, includeProgress, siteHost]
  );

  const shareUrl = useMemo(
    () => buildReadingCardShareUrl(origin, cardConfig),
    [origin, cardConfig]
  );

  const shareText = useMemo(() => buildReadingShareText(cardConfig), [cardConfig]);

  const redrawCard = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node) return;
      renderReadingCardToCanvas(node, cardConfig);
    },
    [cardConfig]
  );

  const handleCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      if (node) {
        redrawCard(node);
      }
    },
    [redrawCard]
  );

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      redrawCard(canvasRef.current);
    }
  }, [isOpen, redrawCard]);

  const handleExportCardBlob = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    renderReadingCardToCanvas(canvas, cardConfig);
    return exportReadingCardBlob(canvas);
  }, [cardConfig]);

  const themeClasses = useMemo(
    () => ({
      buttonClass: activeTheme.button,
      activePillClass: activeTheme.activePill,
      pillClass: activeTheme.pill,
      textMutedClass: activeTheme.textMuted,
      iconAccentClass: activeTheme.iconAccent,
    }),
    [activeTheme]
  );

  return (
    <ReaderDrawerShell
      isOpen={isOpen}
      onClose={handleCloseModal}
      theme={theme}
      role="dialog"
      ariaLabel="Share Book & Reading Card"
      closeAriaLabel="Close Share Dialog"
      backdropTestId="reader-share-backdrop"
      panelTestId="reader-share-modal"
      className="z-[10005] max-h-[92dvh] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:p-4 sm:top-[calc(4.25rem+env(safe-area-inset-top,0px))] sm:max-h-[calc(100dvh-5.25rem)] sm:w-[27rem] sm:max-w-lg"
      titleIcon={<Share2 className={`w-3.5 h-3.5 ${activeTheme.iconAccent}`} aria-hidden="true" />}
      title={
        <h3 className={`text-xs font-bold uppercase tracking-wider ${activeTheme.textMuted}`}>
          Share Reading Card
        </h3>
      }
    >
      <div className="flex-1 overflow-y-auto overscroll-contain pr-0.5 space-y-2 sm:space-y-2.5">
        {/* Live HTML5 Canvas Reading Card Preview */}
        <div className="space-y-1.5">
          <div
            className={`relative rounded-xl overflow-hidden border shadow-sm ${activeTheme.border} ${activeTheme.pill}`}
          >
            <canvas
              ref={handleCanvasRef}
              width={CARD_DIMENSIONS.width}
              height={CARD_DIMENSIONS.height}
              data-testid="reading-card-canvas"
              aria-label={`Shareable reading card preview for ${title} by ${author}`}
              className="w-full h-auto aspect-[1200/630] block"
            />
          </div>

          {/* Card Customization Row: Guaranteed Single-Line Theme Style + Progress Toggle */}
          <div className="flex items-center justify-between gap-1.5 whitespace-nowrap pt-0.5">
            <SegmentedControl<'light' | 'sepia' | 'dark'>
              role="group"
              ariaLabel="Reading card theme"
              value={cardTheme}
              onChange={(selectedTheme) => setCardThemeOverride({ baseTheme: theme, selectedTheme })}
              className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border shrink-0 ${activeTheme.pill}`}
              optionClassName="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
              activeClassName={`${activeTheme.activePill} shadow-2xs`}
              inactiveClassName={`${activeTheme.textMuted} ${activeTheme.drawerHover}`}
              options={[
                {
                  value: 'light',
                  icon: <Sun className="w-3 h-3 shrink-0" aria-hidden="true" />,
                  label: <span>Light</span>,
                  testId: 'share-card-theme-light',
                },
                {
                  value: 'sepia',
                  icon: <Coffee className="w-3 h-3 shrink-0" aria-hidden="true" />,
                  label: <span>Sepia</span>,
                  testId: 'share-card-theme-sepia',
                },
                {
                  value: 'dark',
                  icon: <Moon className="w-3 h-3 shrink-0" aria-hidden="true" />,
                  label: <span>Dark</span>,
                  testId: 'share-card-theme-dark',
                },
              ]}
            />

            <label className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={includeProgress}
                onChange={(e) => setIncludeProgress(e.target.checked)}
                data-testid="share-include-progress-toggle"
                className="rounded border-stone-300 text-amber-700 focus:ring-amber-600 cursor-pointer"
              />
              <span>Progress ({Math.round(progress)}%)</span>
            </label>
          </div>
        </div>

        <SocialSharePanel
          shareUrl={shareUrl}
          shareText={shareText}
          socialTitle={`${title} — ${author} | Bookarium`}
          nativeShareTitle={`${title} — ${author}`}
          downloadFilename={`bookarium-${String(bookId)}-reading-card.png`}
          nativeShareFilename={`bookarium-${String(bookId)}-card.png`}
          exportCardBlob={handleExportCardBlob}
          themeClasses={themeClasses}
          copyLinkLabel="Copy Share Link"
          cardKindLabel="reading card"
        />
      </div>
    </ReaderDrawerShell>
  );
};
