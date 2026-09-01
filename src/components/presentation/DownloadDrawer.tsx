'use client';

import React from 'react';
import { Download, FileText, Globe, Smartphone, ShieldCheck } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { extractBookFormats, formatAuthorNames } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface DownloadDrawerProps {
  book: GutendexBook | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadDrawer: React.FC<DownloadDrawerProps> = ({ book, isOpen, onClose }) => {
  if (!book) return null;

  const formats = extractBookFormats(book.formats);

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
    <Modal isOpen={isOpen} onClose={onClose} title="Zero-Copyright Download Hub" maxWidth="lg">
      <div className="p-6 space-y-6 bg-card text-foreground">
        {/* Book Slip Header Summary */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" className="gap-1 text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Public Domain
            </Badge>
            <span className="font-mono text-[11px] text-muted-foreground">ID #{book.id}</span>
          </div>
          <h3 className="font-serif font-bold text-base text-foreground">
            {book.title}
          </h3>
          <p className="text-xs text-muted-foreground font-serif italic">
            By {formatAuthorNames(book.authors) || 'Anonymous'}
          </p>
        </div>

        {/* Formats List */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Available Zero-DRM Formats
          </h4>

          {downloadOptions.map((option) => (
            <div
              key={option.format}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border hover:border-primary/50 bg-card transition-all gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-muted shrink-0">
                  {option.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-serif font-semibold text-foreground">
                      {option.format}
                    </span>
                    {option.recommended && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-primary/10 text-primary font-bold">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-sans truncate">
                    {option.description}
                  </p>
                </div>
              </div>

              <div>
                {option.url ? (
                  <a
                    href={option.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-mono font-bold transition-opacity shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                ) : (
                  <Button variant="outline" size="sm" disabled className="text-xs opacity-50">
                    Unavailable
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground">
          <p>
            ℹ️ All public domain files streamed directly from Project Gutenberg mirrors. Zero keys or logins required.
          </p>
        </div>
      </div>
    </Modal>
  );
};
