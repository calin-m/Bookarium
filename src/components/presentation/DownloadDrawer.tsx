'use client';

import React from 'react';
import { Download, FileText, Globe, Smartphone, ShieldCheck, AlertTriangle, HardDriveDownload, CheckCircle2, Loader2, Trash2, WifiOff } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import { extractBookFormats, formatAuthorNames } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

export const DownloadDrawer: React.FC<DownloadDrawerProps> = ({ book, isOpen, onClose }) => {
  const { country, isRestricted, ruleDescription, publicDomainYear } = useBookCopyright(book);
  const { isBookOffline, downloadBook, removeBook, downloadingBookId } = useOfflineBooks();
  const { isOffline: isNetworkOffline } = useNetworkStatus();
  const [isRemoveOfflineModalOpen, setIsRemoveOfflineModalOpen] = React.useState(false);

  if (!book) return null;

  const isOffline = isBookOffline(book.id);
  const isDownloadingThisBook = downloadingBookId === book.id;

  const contentAdvisory = evaluateContentAdvisory(book.subjects, book.bookshelves);
  const formats = extractBookFormats(book.formats, book.id);

  const downloadOptions = [
    {
      format: 'EPUB E-Reader',
      description: 'Standard format for Apple Books, Kobo, Android & Calibre.',
      icon: <Smartphone className="w-4 h-4 text-primary" />,
      url: formats.epub,
      extension: '.epub',
      recommended: true,
    },
    {
      format: 'Kindle Format',
      description: 'Direct MOBI package compatible with Kindle e-ink readers.',
      icon: <Smartphone className="w-4 h-4 text-amber-600" />,
      url: formats.mobi,
      extension: '.mobi',
      recommended: false,
    },
    {
      format: 'Clean Plain Text',
      description: 'Zero formatting, raw UTF-8 text for plain text reading and TTS.',
      icon: <FileText className="w-4 h-4 text-emerald-600" />,
      url: formats.txt,
      extension: '.txt',
      recommended: false,
    },
    {
      format: 'Web HTML Archive',
      description: 'Standalone HTML edition with chapter navigation.',
      icon: <Globe className="w-4 h-4 text-sky-600" />,
      url: formats.html,
      extension: '.html',
      recommended: false,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
          <h3 className="font-serif font-bold text-sm sm:text-base text-foreground line-clamp-1">
            {book.title}
          </h3>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-serif italic line-clamp-1">
            By {formatAuthorNames(book.authors) || 'Anonymous'}
          </p>
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
                    External format downloads (.epub, .mobi, .txt, .html) and new offline saves require an internet connection. You can only remove already-downloaded books from your local cache while offline.
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
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-sans truncate">
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
                {downloadOptions.map((option) => (
                  <div
                    key={option.format}
                    data-testid={`download-format-row-${option.extension}`}
                    className={`flex items-center justify-between sm:flex-col sm:items-stretch sm:justify-between p-2.5 sm:p-3 rounded-xl border border-border bg-card transition-all gap-2.5 shadow-xs ${
                      isNetworkOffline
                        ? 'opacity-50 pointer-events-none select-none'
                        : 'hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center sm:items-start gap-2.5 min-w-0">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-muted shrink-0">
                        {option.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-serif font-semibold text-foreground">
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
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground font-sans truncate sm:whitespace-normal sm:line-clamp-2 sm:mt-0.5 leading-snug">
                          {option.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 sm:pt-1 sm:flex sm:justify-end">
                      {isNetworkOffline ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="text-xs font-mono opacity-60 sm:w-full"
                        >
                          Offline
                        </Button>
                      ) : option.url ? (
                        <a
                          href={option.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-mono font-bold transition-opacity shadow-xs sm:w-full"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="text-xs opacity-50 sm:w-full">
                          Unavailable
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-[10px] font-mono text-muted-foreground leading-relaxed">
          <p>
            ℹ️ Bookarium strictly complies with international copyright laws. All public domain volumes are streamed from verified archival mirrors. Zero keys or logins required.
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
