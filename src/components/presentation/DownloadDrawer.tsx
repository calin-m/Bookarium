'use client';

import React from 'react';
import { Download, FileText, Globe, Smartphone, ShieldCheck } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { extractBookFormats } from '@/lib/utils';
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
      icon: <Smartphone className="w-4 h-4 text-primary-600" />,
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
      <div className="p-6 space-y-6 bg-paper-50 dark:bg-stone-900">
        {/* Book Slip Header Summary */}
        <div className="p-4 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" className="gap-1 text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Public Domain
            </Badge>
            <span className="font-mono text-[11px] text-stone-400">ID #{book.id}</span>
          </div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
            {book.title}
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-serif italic">
            By {book.authors.map((a) => a.name.split(',').reverse().join(' ').trim()).join(', ') || 'Anonymous'}
          </p>
        </div>

        {/* Formats List */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-500">
            Available Zero-DRM Formats
          </h4>

          {downloadOptions.map((option) => (
            <div
              key={option.format}
              className="flex items-center justify-between p-3.5 rounded-xl border border-stone-200/90 dark:border-stone-800 hover:border-primary-500/50 bg-white dark:bg-stone-900/90 transition-all gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-paper-100 dark:bg-stone-800 shrink-0">
                  {option.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-serif font-semibold text-stone-900 dark:text-stone-100">
                      {option.format}
                    </span>
                    {option.recommended && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300 font-bold">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 truncate">{option.description}</p>
                </div>
              </div>

              {option.url ? (
                <a
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="shrink-0"
                >
                  <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </Button>
                </a>
              ) : (
                <span className="text-xs text-stone-400 italic font-serif">Not available</span>
              )}
            </div>
          ))}
        </div>

        {/* Legal Manifesto */}
        <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 leading-normal flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            This work is unconditionally free of copyright restrictions (CC0 / Public Domain). You are free to read, distribute, print, or adapt this text anywhere in the world.
          </span>
        </div>
      </div>
    </Modal>
  );
};
