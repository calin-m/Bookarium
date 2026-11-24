'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sun, Coffee, Moon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SocialSharePanel } from '@/components/share/SocialSharePanel';
import { CARD_DIMENSIONS, exportCardBlob } from '@/lib/share-card-primitives';
import {
  renderProfileCardToCanvas,
  buildProfileCardShareUrl,
  buildProfileShareText,
  type ProfileCardConfig,
} from '@/lib/profile-card-export';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { SITE_CONFIG } from '@/config/site-config';
import { resolveCanonicalShareOrigin } from '@/lib/redirect-sanitizer';

export interface ProfileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
  initials: string;
  memberSince: string;
  bio?: string | null;
  bioBookTitle?: string | null;
  bioBookAuthor?: string | null;
  statsPills: string[];
}

export const ProfileShareModal: React.FC<ProfileShareModalProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
  initials,
  memberSince,
  bio = null,
  bioBookTitle = null,
  bioBookAuthor = null,
  statsPills,
}) => {
  const appTheme = useThemeStore((s) => s.theme);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cardThemeOverride, setCardThemeOverride] = useState<{
    baseTheme: AppTheme;
    selectedTheme: AppTheme;
  } | null>(null);
  const cardTheme: AppTheme =
    isOpen && cardThemeOverride && cardThemeOverride.baseTheme === appTheme
      ? cardThemeOverride.selectedTheme
      : appTheme;

  const hasVisibleStats = statsPills.length > 0;
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const effectiveIncludeStats = hasVisibleStats && includeStats;

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

  const cleanHandle = username.trim().toLowerCase();

  const cardConfig: ProfileCardConfig = useMemo(
    () => ({
      username: cleanHandle,
      displayName,
      initials,
      memberSince,
      bio,
      bioBookTitle,
      bioBookAuthor,
      theme: cardTheme,
      includeStats: effectiveIncludeStats,
      statsPills: effectiveIncludeStats ? statsPills : [],
      siteHost,
    }),
    [
      cleanHandle,
      displayName,
      initials,
      memberSince,
      bio,
      bioBookTitle,
      bioBookAuthor,
      cardTheme,
      effectiveIncludeStats,
      statsPills,
      siteHost,
    ]
  );

  const shareUrl = useMemo(
    () => buildProfileCardShareUrl(origin, cardConfig),
    [origin, cardConfig]
  );

  const shareText = useMemo(() => buildProfileShareText(cardConfig), [cardConfig]);

  const redrawCard = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node) return;
      renderProfileCardToCanvas(node, cardConfig);
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
    renderProfileCardToCanvas(canvas, cardConfig);
    return exportCardBlob(canvas);
  }, [cardConfig]);

  const themeClasses = useMemo(
    () => ({
      buttonClass: 'border-border bg-muted/40 hover:bg-muted text-foreground',
      activePillClass: 'border-primary/40 bg-primary/10 hover:bg-primary/15 text-primary',
      pillClass: 'border-border bg-muted/30 text-muted-foreground',
      textMutedClass: 'text-muted-foreground',
      iconAccentClass: 'text-primary',
    }),
    []
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title="Share Scholar Sanctuary"
      maxWidth="xl"
      backdropTestId="profile-share-backdrop"
      testId="profile-share-modal"
    >
      <div className="p-4 sm:p-5 space-y-3">
        {/* Live HTML5 Canvas Profile Card Preview */}
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20 shadow-sm">
            <canvas
              ref={handleCanvasRef}
              width={CARD_DIMENSIONS.width}
              height={CARD_DIMENSIONS.height}
              data-testid="profile-card-canvas"
              aria-label={`Shareable scholar card preview for ${displayName} (@${cleanHandle})`}
              className="w-full h-auto aspect-[1200/630] block"
            />
          </div>

          {/* Card Customization Row: Theme Switcher + Privacy-Aware Stats Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <SegmentedControl<'light' | 'sepia' | 'dark'>
              role="group"
              ariaLabel="Scholar card theme"
              value={cardTheme}
              onChange={(selectedTheme) =>
                setCardThemeOverride({ baseTheme: appTheme, selectedTheme })
              }
              className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-muted/30 shrink-0"
              optionClassName="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
              activeClassName="bg-card text-foreground border border-border shadow-2xs"
              inactiveClassName="text-muted-foreground hover:text-foreground hover:bg-muted/50"
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

            {hasVisibleStats ? (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  data-testid="profile-share-include-stats-toggle"
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span>Include Public Stats</span>
              </label>
            ) : (
              <span
                data-testid="profile-share-stats-hidden-note"
                className="text-[11px] font-mono text-muted-foreground"
              >
                Public stats hidden by privacy settings
              </span>
            )}
          </div>
        </div>

        <SocialSharePanel
          shareUrl={shareUrl}
          shareText={shareText}
          socialTitle={`${displayName} (@${cleanHandle}) | ${SITE_CONFIG.NAME}`}
          nativeShareTitle={`${displayName} (@${cleanHandle})`}
          downloadFilename={`bookarium-${cleanHandle}-scholar-card.png`}
          nativeShareFilename={`bookarium-${cleanHandle}-card.png`}
          exportCardBlob={handleExportCardBlob}
          themeClasses={themeClasses}
          copyLinkLabel="Copy Profile Link"
          cardKindLabel="scholar card"
        />
      </div>
    </Modal>
  );
};
