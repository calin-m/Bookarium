import React from 'react';
import { BookOpen } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site-config';

/**
 * Universal App Shell Pre-Hydration & Streaming Splash Screen.
 * Provides an accessible, beautifully branded loading state while
 * Next.js App Router hydrates the initial page and catalog dataset.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading Bookarium library"
      className="min-h-dvh w-full flex flex-col items-center justify-center bg-background text-foreground px-4 select-none"
    >
      <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-booksaw animate-pulse motion-reduce:animate-none">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md -z-10 animate-pulse motion-reduce:animate-none" />
        </div>

        {/* Wordmark & Status */}
        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-bold tracking-tight text-foreground">
            {SITE_CONFIG.NAME}
          </h1>
          <p className="text-xs font-mono text-muted-foreground">
            Opening universal public domain library...
          </p>
        </div>

        {/* Ambient Loading Indicator */}
        <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
          <div className="w-full h-full bg-primary rounded-full animate-pulse-subtle motion-reduce:animate-none" />
        </div>

        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
