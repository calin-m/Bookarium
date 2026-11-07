'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Share2,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  Link2,
  ExternalLink,
  Mail,
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
  buildSocialShareUrls,
  type ReadingCardConfig,
  type SocialPlatformId,
} from '@/lib/reading-card-export';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

const SOCIAL_SVG_PATHS: Record<Exclude<SocialPlatformId, 'email'>, string> = {
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  reddit:
    'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.056 1.597.04.21.06.427.06.646 0 2.833-3.167 5.128-7.074 5.128-3.908 0-7.075-2.295-7.075-5.128 0-.219.021-.436.061-.646A1.756 1.756 0 0 1 3.86 12c0-.968.786-1.754 1.754-1.754.463 0 .883.18 1.196.472 1.186-.846 2.828-1.403 4.633-1.481l.886-4.156a.375.375 0 0 1 .444-.29l2.99.63a1.247 1.247 0 0 1 1.247-.677z',
  whatsapp:
    'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.15c-.24.68-1.4 1.3-1.95 1.38-.5.08-1.14.11-1.84-.11-.42-.14-.97-.32-1.67-.62-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.58.83 2.02.9 2.17.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.12.64-.08.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.08.13.08.73-.16 1.41z',
  telegram:
    'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  bluesky:
    'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z',
  facebook:
    'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
};

const SocialPlatformIcon: React.FC<{ platform: SocialPlatformId; className?: string }> = ({
  platform,
  className = 'w-3.5 h-3.5 shrink-0',
}) => {
  if (platform === 'email') {
    return (
      <Mail
        className={className}
        aria-hidden="true"
        data-testid="share-platform-icon-email"
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      data-testid={`share-platform-icon-${platform}`}
    >
      <path d={SOCIAL_SVG_PATHS[platform]} />
    </svg>
  );
};

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

  const [cardThemeOverride, setCardThemeOverride] = useState<ReaderTheme | null>(null);
  const cardTheme: ReaderTheme = cardThemeOverride ?? theme;
  const [includeProgress, setIncludeProgress] = useState<boolean>(true);
  const { copiedKey, triggerCopied, copyWithFeedback } = useCopyFeedback<'link' | 'image'>(2000);
  const isLinkCopied = copiedKey === 'link';
  const isImageCopied = copiedKey === 'image';
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCloseModal = useCallback(() => {
    setCardThemeOverride(null);
    onClose();
  }, [onClose]);

  const shareUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : SITE_CONFIG.SITE_URL;
    return `${origin}${ROUTES.READ(bookId)}`;
  }, [bookId]);

  const siteHost = useMemo(() => {
    try {
      return new URL(shareUrl).host;
    } catch {
      return 'bookarium.vercel.app';
    }
  }, [shareUrl]);

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

  const shareText = useMemo(() => buildReadingShareText(cardConfig), [cardConfig]);

  const socialTargets = useMemo(
    () =>
      buildSocialShareUrls({
        url: shareUrl,
        title: `${title} — ${author} | Bookarium`,
        text: shareText,
      }),
    [shareUrl, title, author, shareText]
  );

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

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopyLink = () => {
    const copied = copyWithFeedback('link', shareUrl);
    if (copied) {
      setStatusMessage('Share link copied to clipboard');
    } else {
      setStatusMessage('Could not copy link automatically');
    }
  };

  const handleCopyCardImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderReadingCardToCanvas(canvas, cardConfig);

    const blob = await exportReadingCardBlob(canvas);
    if (
      !blob ||
      typeof navigator === 'undefined' ||
      !navigator.clipboard?.write ||
      typeof ClipboardItem === 'undefined'
    ) {
      setStatusMessage('Image copy not supported in this browser — use Download PNG');
      return;
    }

    try {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      triggerCopied('image');
      setStatusMessage('Reading card image copied to clipboard');
    } catch {
      setStatusMessage('Could not copy card image — use Download PNG');
    }
  };

  const handleDownloadCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderReadingCardToCanvas(canvas, cardConfig);

    const blob = await exportReadingCardBlob(canvas);
    if (!blob || typeof URL.createObjectURL !== 'function') {
      setStatusMessage('Could not export reading card image');
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `bookarium-${String(bookId)}-reading-card.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    setStatusMessage('Reading card downloaded as PNG');
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;

    const canvas = canvasRef.current;
    const shareTitle = `${title} — ${author}`;
    try {
      if (canvas && typeof File !== 'undefined') {
        renderReadingCardToCanvas(canvas, cardConfig);
        const blob = await exportReadingCardBlob(canvas);
        if (blob) {
          const pngFile = new File([blob], `bookarium-${String(bookId)}-card.png`, {
            type: 'image/png',
          });
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [pngFile] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              url: shareUrl,
              files: [pngFile],
            });
            setStatusMessage('Shared reading card via device');
            return;
          }
        }
      }

      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      setStatusMessage('Shared link via device');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setStatusMessage('Device share could not be completed');
    }
  };

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
      className="z-[10005] sm:w-[27rem] sm:max-w-lg"
      titleIcon={<Share2 className={`w-3.5 h-3.5 ${activeTheme.iconAccent}`} aria-hidden="true" />}
      title={
        <h3 className={`text-xs font-bold uppercase tracking-wider ${activeTheme.textMuted}`}>
          Share Reading Card
        </h3>
      }
    >
      <div className="flex-1 overflow-y-auto overscroll-contain pr-0.5 space-y-3.5">
        {/* Live HTML5 Canvas Reading Card Preview */}
        <div className="space-y-2">
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

          {/* Card Customization Row: Theme Style + Progress Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div
              className={`inline-flex items-center gap-1 p-0.5 rounded-lg border ${activeTheme.pill}`}
              role="group"
              aria-label="Reading card theme"
            >
              {(
                [
                  { id: 'light', label: 'Light', Icon: Sun },
                  { id: 'sepia', label: 'Sepia', Icon: Coffee },
                  { id: 'dark', label: 'Dark', Icon: Moon },
                ] as const
              ).map(({ id, label, Icon }) => {
                const isSelected = cardTheme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCardThemeOverride(id)}
                    aria-pressed={isSelected}
                    data-testid={`share-card-theme-${id}`}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? `${activeTheme.activePill} shadow-2xs`
                        : `${activeTheme.textMuted} ${activeTheme.drawerHover}`
                    }`}
                  >
                    <Icon className="w-3 h-3" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeProgress}
                onChange={(e) => setIncludeProgress(e.target.checked)}
                data-testid="share-include-progress-toggle"
                className="rounded border-stone-300 text-amber-700 focus:ring-amber-600 cursor-pointer"
              />
              <span>Include Progress ({Math.round(progress)}%)</span>
            </label>
          </div>
        </div>

        {/* Primary Card & Link Actions (PC, Tablet & Mobile) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyCardImage}
            data-testid="share-copy-image-btn"
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              isImageCopied
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : activeTheme.button
            }`}
          >
            {isImageCopied ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Card Copied!</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Copy Card Image</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadCard}
            data-testid="share-download-image-btn"
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${activeTheme.button}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            data-testid="share-copy-link-btn"
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              canNativeShare ? '' : 'col-span-2'
            } ${
              isLinkCopied
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : activeTheme.button
            }`}
          >
            {isLinkCopied ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              data-testid="share-native-os-btn"
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${activeTheme.activePill}`}
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Device Share</span>
            </button>
          )}
        </div>

        {/* Copyable Share Caption Preview */}
        <div
          className={`px-3 py-2 rounded-lg border text-[11px] leading-relaxed ${activeTheme.pill}`}
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`font-semibold uppercase tracking-wider text-[10px] ${activeTheme.textMuted}`}>
              Share Caption
            </span>
            <button
              type="button"
              onClick={async () => {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
                  setStatusMessage('Caption and link copied');
                }
              }}
              data-testid="share-copy-caption-btn"
              className={`inline-flex items-center gap-1 text-[10px] font-semibold hover:underline cursor-pointer ${activeTheme.iconAccent}`}
            >
              <Copy className="w-2.5 h-2.5" aria-hidden="true" />
              <span>Copy Text</span>
            </button>
          </div>
          <p className="line-clamp-2" data-testid="share-caption-preview">
            {shareText}
          </p>
        </div>

        {/* Social Platform Direct Share Intents (Works on PC, Tablet & Mobile) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${activeTheme.textMuted}`}
            >
              Share Directly to Social Media
            </span>
            <span className={`text-[10px] ${activeTheme.textMuted}`}>
              Tip: Copy Card Image to paste into posts
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {socialTargets.map((target) => (
              <a
                key={target.id}
                href={target.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`share-platform-${target.id}`}
                title={target.description}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors ${activeTheme.button}`}
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <SocialPlatformIcon
                    platform={target.id}
                    className={`w-3.5 h-3.5 shrink-0 ${activeTheme.iconAccent}`}
                  />
                  <span className="truncate">{target.label}</span>
                </span>
                <ExternalLink
                  className={`w-3 h-3 shrink-0 opacity-60 ${activeTheme.textMuted}`}
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </div>

        {/* Screen Reader Live Status Region */}
        <div className="sr-only" role="status" aria-live="polite" data-testid="share-modal-status">
          {statusMessage || ''}
        </div>
      </div>
    </ReaderDrawerShell>
  );
};
