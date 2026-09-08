'use client';

import React from 'react';
import { Award, Sparkles } from 'lucide-react';
import type { AccoladeDefinition, AccoladeProgress } from '@/types/accolades.types';
import { ExLibrisBookplate } from '@/components/accolades/ExLibrisBookplate';

export interface PinnedBookplateItem {
  definition: AccoladeDefinition;
  progress: AccoladeProgress;
}

export interface PinnedAccoladesShelfProps {
  pinnedItems: PinnedBookplateItem[];
}

export const PinnedAccoladesShelf: React.FC<PinnedAccoladesShelfProps> = ({ pinnedItems }) => {
  return (
    <section
      aria-label="Pinned Ex-Libris Bookplates"
      className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Award className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              Ex-Libris Bookplate Showcase
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Illuminated bookplates awarded for literary exploration, consistency, and scholarly achievements.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{pinnedItems.length} Pinned {pinnedItems.length === 1 ? 'Bookplate' : 'Bookplates'}</span>
        </div>
      </div>

      {/* Classical Shelf Display */}
      {pinnedItems.length > 0 ? (
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
            {pinnedItems.map(({ definition, progress }) => (
              <ExLibrisBookplate
                key={`pinned-${definition.id}`}
                definition={definition}
                progress={progress}
              />
            ))}
          </div>
          {/* Classical wooden shelf plank border */}
          <div className="w-full h-3 bg-gradient-to-r from-amber-950/20 via-amber-900/30 to-amber-950/20 dark:from-amber-900/40 dark:via-amber-800/50 dark:to-amber-900/40 border-t border-b border-amber-900/30 rounded-xs shadow-inner" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/10 space-y-2">
          <p className="text-sm text-muted-foreground font-serif italic">
            This scholar has not pinned any bookplates to their public showcase yet.
          </p>
          <p className="text-xs text-muted-foreground font-sans">
            As milestones are achieved, bookplates can be pinned from the reader account.
          </p>
        </div>
      )}
    </section>
  );
};

