import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { BookOpen, Bookmark, Compass } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6 text-foreground">
      <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 sm:p-10 text-center space-y-6 shadow-booksaw">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8 animate-pulse" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-primary font-semibold">
            Error 404 &bull; Volume Not Found
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
            Lost in the Stacks
          </h1>
          <blockquote className="italic text-muted-foreground font-serif text-sm sm:text-base border-l-2 border-primary/30 pl-4 py-1 my-4 text-left">
            &ldquo;There are books of which the backs and covers are by far the best parts.&rdquo;
            <span className="block not-italic text-xs font-sans text-muted-foreground/80 mt-1">
              &mdash; Charles Dickens, <em>Oliver Twist</em>
            </span>
          </blockquote>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The volume or manuscript you seek may have been moved, retired, or has not yet entered our public domain sanctuary.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href={ROUTES.CATALOG} className="w-full sm:w-auto">
            <Button variant="primary" className="w-full gap-2">
              <BookOpen className="w-4 h-4" />
              Explore Public Catalog
            </Button>
          </Link>
          <Link href={ROUTES.BOOKSHELF} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full gap-2">
              <Bookmark className="w-4 h-4" />
              My Bookshelf
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

