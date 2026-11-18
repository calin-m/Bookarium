'use client';

import React from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Download, FileText, Globe, Smartphone, ShieldCheck, AlertTriangle, HardDriveDownload, CheckCircle2, Loader2, Trash2, WifiOff } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import { formatAuthorNames } from '@/lib/utils';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { getOfflineBook } from '@/lib/offline-storage';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  CopyBookLinkIndicator,
  handleCopyBookLinkClick,
} from '@/components/ui/CursorTooltip';
import { useBookCopyright } from '@/hooks/useBookCopyright';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { CopyrightNoticeBanner } from '@/components/presentation/CopyrightNoticeBanner';
import { ContentAdvisoryBanner } from '@/components/presentation/ContentAdvisoryBanner';
import { evaluateContentAdvisory } from '@/lib/content-advisory';
import { RemoveOfflineBookModal } from '@/components/ui/RemoveOfflineBookModal';

export interface DownloadDrawerProps {
  book: GutendexBook | null;
  isOpen: boolean;
  onClose: () => void;
}

interface DownloadOptionItem {
  format: string;
  description: string;
  icon: React.ReactNode;
  extension: '.epub' | '.mobi' | '.txt' | '.html';
  recommended: boolean;
  isAvailable: boolean;
}

function buildTxtDownloadFilename(bookId: number, title: string): string {
  const safeId = Math.max(1, Math.trunc(bookId));
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 60);
  return slug ? `${slug}-pg${safeId}.txt` : `bookarium-pg${safeId}.txt`;
}

function triggerTextBlobDownload(text: string, filename: string): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(objectUrl);
  }
  return true;
}

export const DownloadDrawer: React.FC<DownloadDrawerProps> = ({ book, isOpen, onClose }) => {
  const queryClient = React.useContext(QueryClientContext);
  const { country, isRestricted, ruleDescription, publicDomainYear } = useBookCopyright(book);
  const { isBookOffline, downloadBook, removeBook, downloadingBookId } = useOfflineBooks();
  const { isOffline: isNetworkOffline } = useNetworkStatus();
  const [isRemoveOfflineModalOpen, setIsRemoveOfflineModalOpen] = React.useState(false);
  const [downloadingTxtBookId, setDownloadingTxtBookId] = React.useState<number | null>(null);
  const [txtFeedback, setTxtFeedback] = React.useState<{
    bookId: number;
    error: string | null;
    success: boolean;
  } | null>(null);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (!book) return null;

  const isOffline = isBookOffline(book.id);
  const isDownloadingThisBook = downloadingBookId === book.id;
  const isDownloadingTxt = downloadingTxtBookId === book.id;
  const txtError = txtFeedback?.bookId === book.id ? txtFeedback.error : null;
  const txtSuccess = txtFeedback?.bookId === book.id ? txtFeedback.success : false;

  const handleCloseDrawer = () => {
    setTxtFeedback(null);
    setDownloadingTxtBookId(null);
    onClose();
  };

  const contentAdvisory = evaluateContentAdvisory(book.subjects, book.bookshelves);

  const handleDownloadTxt = async (): Promise<void> => {
    if (isRestricted || isDownloadingTxt) return;
    if (isNetworkOffline && !isOffline) return;

    const targetBookId = book.id;
    setDownloadingTxtBookId(targetBookId);
    setTxtFeedback(null);

    try {
      let text: string | null = isOffline ? await getOfflineBook(targetBookId) : null;

      if (!text || text.trim().length === 0) {
        const cachedText = queryClient?.getQueryData<string>(['book-content', undefined, targetBookId]);
        if (cachedText && cachedText.trim().length > 0) {
          text = cachedText;
        }
      }

      if (!text || text.trim().length === 0) {
        if (isNetworkOffline) {
          throw new Error('Connect to the internet to download this volume.');
        }
        const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${targetBookId}`);
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          const fallbackMessage =
            res.status === 451
              ? 'This title is restricted in your region under local copyright law.'
              : res.status === 404
                ? 'Plain text for this title is currently unavailable in archive storage.'
                : 'Unable to download plain text right now. Please try again.';
          throw new Error(payload?.error || fallbackMessage);
        }
        const fetchedText = await res.text();
        if (!fetchedText || fetchedText.trim().length === 0) {
          throw new Error('Received empty text from archive storage.');
        }
        text = fetchedText;
        queryClient?.setQueryData(['book-content', undefined, targetBookId], text);
      }

      const triggered = triggerTextBlobDownload(
        text,
        buildTxtDownloadFilename(targetBookId, book.title)
      );
      if (!triggered) {
        throw new Error('File export is not supported in this browser environment.');
      }

      if (isMountedRef.current) {
        setTxtFeedback({ bookId: targetBookId, error: null, success: true });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setTxtFeedback({
          bookId: targetBookId,
          error:
            err instanceof Error
              ? err.message
              : 'Unable to download plain text right now. Please try again.',
          success: false,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setDownloadingTxtBookId((current) => (current === targetBookId ? null : current));
      }
    }
  };

  const downloadOptions: DownloadOptionItem[] = [
    {
      format: 'Clean Plain Text',
      description: 'Unabridged UTF-8 plain text served directly from Bookarium.',
      icon: <FileText className="w-4 h-4 text-emerald-600" />,
      extension: '.txt',
      recommended: true,
      isAvailable: true,
    },
    {
      format: 'EPUB E-Reader',
      description: 'In-house EPUB generator coming soon for Apple Books, Kobo & Calibre.',
      icon: <Smartphone className="w-4 h-4 text-muted-foreground" />,
      extension: '.epub',
      recommended: false,
      isAvailable: false,
    },
    {
      format: 'Kindle Format',
      description: 'In-house Kindle generator coming soon for dedicated e-ink readers.',
      icon: <Smartphone className="w-4 h-4 text-muted-foreground" />,
      extension: '.mobi',
      recommended: false,
      isAvailable: false,
    },
    {
      format: 'Web HTML Archive',
      description: 'In-house standalone HTML edition coming soon for browser reading.',
      icon: <Globe className="w-4 h-4 text-muted-foreground" />,
      extension: '.html',
      recommended: false,
      isAvailable: false,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseDrawer}
      title={isRestricted ? 'Regional Copyright Notice' : 'Download Hub'}
      maxWidth="lg"
    >
      <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 bg-card text-foreground">
        {/* Book Slip Header Summary */}
        <div className="p-3 rounded-xl bg-muted/25 border border-border shadow-xs space-y-1">
          <div className="flex items-center gap-2">
            {isRestricted ? (
              <Badge variant="outline" size="sm" className="gap-1 text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Protected in {country}
              </Badge>
            ) : (
              <Badge variant="primary" size="sm" className="gap-1 text-[10px] font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Public Domain
              </Badge>
            )}
            <span className="font-mono text-[10px] sm:text-[11px] text-muted-foreground">ID #{book.id}</span>
          </div>
          <div
            data-testid={`download-drawer-copy-meta-${book.id}`}
            data-copy-book-id={book.id}
            data-tooltip={`${book.title} — by ${formatAuthorNames(book.authors) || 'Anonymous'}`}
            onClick={(e) => handleCopyBookLinkClick(e, book.id)}
            onKeyDown={(e) => handleCopyBookLinkClick(e, book.id)}
            role="button"
            tabIndex={0}
            aria-label={`Copy link to ${book.title} by ${formatAuthorNames(book.authors) || 'Anonymous'}`}
            className="group/copy cursor-pointer rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/60 transition-colors"
          >
            <h3 className="font-serif font-bold text-sm sm:text-base text-foreground group-hover/copy:text-primary transition-colors line-clamp-2 leading-snug">
              {book.title}
            </h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-serif italic flex items-center min-w-0 mt-0.5">
              <span className="truncate">By {formatAuthorNames(book.authors) || 'Anonymous'}</span>
              <CopyBookLinkIndicator bookId={book.id} />
            </p>
          </div>
        </div>

        {contentAdvisory.isMature && (
          <ContentAdvisoryBanner
            matchedSubject={contentAdvisory.matchedSubject}
            compact={true}
          />
        )}

        {isRestricted ? (
          /* Legal Restriction Banner - Neutralize all download hyperlinks */
          <CopyrightNoticeBanner
            country={country}
            ruleDescription={ruleDescription}
            publicDomainYear={publicDomainYear}
            subtext="In strict accordance with international copyright treaties, direct download files are unavailable in your region."
          />
        ) : (
          /* Formats List */
          <div className="space-y-3 sm:space-y-3.5">
            {isNetworkOffline && (
              <div
                role="status"
                data-testid="download-drawer-offline-mode-banner"
                className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive shadow-xs"
              >
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                <div className="space-y-0.5 text-[11px] sm:text-xs">
                  <p className="font-mono font-bold uppercase tracking-wider">
                    Offline Mode Active
                  </p>
                  <p className="text-foreground/90 font-sans leading-snug">
                    {isOffline
                      ? 'This volume is cached locally: you can export it as plain text (.txt) or remove it from your browser cache while offline.'
                      : 'New plain-text downloads (.txt) and offline saves require an internet connection. You can only remove already-downloaded books from your local cache while offline.'}
                  </p>
                </div>
              </div>
            )}

            {/* In-App Browser Offline Reading Cache */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                In-App Offline Reading
              </h4>
              <div
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all gap-2.5 sm:gap-3 shadow-xs ${
                  isOffline
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : isNetworkOffline
                      ? 'border-border bg-muted/30 opacity-60'
                      : 'border-border hover:border-primary/50 bg-card'
                }`}
                data-testid="download-drawer-offline-card"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${
                      isOffline ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-primary'
                    }`}
                  >
                    {isOffline ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <HardDriveDownload className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-serif font-semibold text-foreground">
                        Browser Offline Cache
                      </span>
                      {isOffline ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                          Downloaded
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-primary/10 text-primary font-bold">
                          Instant Reader
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-sans whitespace-normal line-clamp-2 leading-snug">
                      {isOffline
                        ? 'Cached in browser storage for instant offline reading in Bookarium.'
                        : isNetworkOffline
                           ? 'Connect to the internet to save this volume for offline reading.'
                           : 'Save directly in your browser to read inside Bookarium without internet.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isDownloadingThisBook ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="text-xs font-mono gap-1.5"
                      aria-label={`Downloading ${book.title} for offline reading`}
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Saving...</span>
                    </Button>
                  ) : isOffline ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsRemoveOfflineModalOpen(true)}
                      className="text-xs font-mono gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                      aria-label={`Remove offline copy of ${book.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      <span>Remove</span>
                    </Button>
                  ) : (
                    <Button
                      variant={isNetworkOffline ? 'outline' : 'primary'}
                      size="sm"
                      disabled={isNetworkOffline}
                      onClick={() => downloadBook(book)}
                      className="text-xs font-mono font-bold gap-1.5"
                      aria-label={`Save ${book.title} for offline reading`}
                    >
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      <span>Save Offline</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Available Zero-DRM Formats
              </h4>

              <div
                data-testid="download-formats-grid"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5"
              >
                {downloadOptions.map((option) => {
                  const isRowOfflineLocked = option.isAvailable && isNetworkOffline && !isOffline;
                  const isRowDimmed = !option.isAvailable || isRowOfflineLocked;
                  return (
                    <div
                      key={option.format}
                      data-testid={`download-format-row-${option.extension}`}
                      aria-disabled={!option.isAvailable ? true : undefined}
                      className={`flex items-center justify-between sm:flex-col sm:items-stretch sm:justify-between p-2.5 sm:p-3 rounded-xl border border-border transition-all gap-2.5 shadow-xs ${
                        !option.isAvailable
                          ? 'bg-muted/30 opacity-60 select-none'
                          : isRowOfflineLocked
                            ? 'bg-card opacity-50 pointer-events-none select-none'
                            : 'bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center sm:items-start gap-2.5 min-w-0">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-muted shrink-0">
                          {option.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs font-serif font-semibold ${
                                isRowDimmed ? 'text-muted-foreground' : 'text-foreground'
                              }`}
                            >
                              {option.format}
                            </span>
                            <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-muted text-muted-foreground">
                              {option.extension}
                            </span>
                            {option.recommended && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-primary/10 text-primary font-bold">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground font-sans whitespace-normal line-clamp-2 mt-0.5 leading-snug">
                            {option.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 sm:pt-1 sm:flex sm:justify-end">
                        {!option.isAvailable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs font-mono opacity-75 cursor-not-allowed sm:w-full"
                            aria-label={`${option.format} (${option.extension}) coming soon`}
                          >
                            Coming Soon
                          </Button>
                        ) : isRowOfflineLocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="text-xs font-mono opacity-60 sm:w-full"
                          >
                            Offline
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isDownloadingTxt}
                            onClick={() => {
                              void handleDownloadTxt();
                            }}
                            className="text-xs font-mono font-bold gap-1.5 sm:w-full"
                            aria-label={`Download ${book.title} as plain text (.txt)`}
                          >
                            {isDownloadingTxt ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {txtError && (
                <div
                  role="alert"
                  data-testid="download-txt-error"
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-[11px] font-sans"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{txtError}</span>
                </div>
              )}

              {txtSuccess && !txtError && (
                <div
                  role="status"
                  data-testid="download-txt-success"
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Plain text (.txt) download started.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-[10px] font-mono text-muted-foreground leading-relaxed">
          <p>
            ℹ️ Bookarium strictly complies with international copyright laws. All plain-text downloads and offline volumes are served directly from Bookarium&apos;s archive. Zero keys or logins required.
          </p>
        </div>
      </div>

      <RemoveOfflineBookModal
        isOpen={isRemoveOfflineModalOpen}
        bookTitle={book.title}
        onClose={() => setIsRemoveOfflineModalOpen(false)}
        onConfirm={async () => {
          await removeBook(book.id);
          setIsRemoveOfflineModalOpen(false);
        }}
      />
    </Modal>
  );
};
