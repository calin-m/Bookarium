'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, BookOpen, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/Button';

export interface PrivateProfileNoticeProps {
  username?: string;
}

export const PrivateProfileNotice: React.FC<PrivateProfileNoticeProps> = () => {
  return (
    <div
      role="region"
      aria-label="Scholar Sanctuary Not Found"
      className="max-w-xl mx-auto my-12 px-4 text-center"
    >
      <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 shadow-booksaw space-y-6 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Neutral Literary Medallion */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-muted/60 border border-border text-muted-foreground flex items-center justify-center shadow-inner">
          <Compass className="w-8 h-8 text-primary/80" />
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
            Scholar Sanctuary Not Found
          </h1>
          <p className="text-sm text-muted-foreground font-sans leading-relaxed max-w-md mx-auto">
            This scholar sanctuary does not exist or has not been made public by its owner.
          </p>
        </div>

        {/* Classical Epigraph */}
        <div className="border-t border-b border-border/60 py-3.5 my-2">
          <p className="font-serif italic text-xs text-muted-foreground">
            &ldquo;In a library we are surrounded by many hundreds of dear friends, imprisoned by an enchanter in their paper and leathern boxes.&rdquo;
          </p>
          <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 mt-1">
            — Ralph Waldo Emerson
          </span>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href={ROUTES.HOME} className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              className="w-full font-mono text-xs uppercase flex items-center gap-2"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Explore Public Domain Library</span>
            </Button>
          </Link>
          <Link href={ROUTES.HOME} className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="md"
              className="w-full font-mono text-xs uppercase flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Catalog</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
