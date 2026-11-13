'use client';

import React from 'react';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const COLLECTION_EMPTY_ACTION_CLASS =
  'gap-2 font-mono text-xs uppercase tracking-wider font-bold';

export interface CollectionEmptyStateProps {
  /** Leading 32px section icon rendered inside the circular emblem */
  icon: React.ReactNode;
  /** Tailwind tint and background classes for the circular icon container */
  iconContainerClassName?: string;
  /** Card heading text */
  title: string;
  /** Semantic heading level (`h2` for top-level empty views such as Notebook, `h3` elsewhere) */
  headingAs?: 'h2' | 'h3';
  /** Editorial serif body description */
  description: React.ReactNode;
  /** Click handler for the standardized primary "Explore Catalog" button */
  onExploreCatalog?: () => void;
  /** Force rendering the primary "Explore Catalog" button even when `onExploreCatalog` is optional */
  showExploreCatalog?: boolean;
  /** Optional custom or secondary action buttons rendered alongside or instead of Explore Catalog */
  actions?: React.ReactNode;
  /** Optional extra classes appended to the card container */
  className?: string;
}

/**
 * Shared editorial empty-state card used across personal library views
 * (Bookmarks, Notebook, Bookshelf, and Favorites) and search empty states.
 */
export const CollectionEmptyState: React.FC<CollectionEmptyStateProps> = ({
  icon,
  iconContainerClassName = 'bg-primary/10 text-primary',
  title,
  headingAs = 'h3',
  description,
  onExploreCatalog,
  showExploreCatalog = false,
  actions,
  className,
}) => {
  const HeadingTag = headingAs;
  const shouldRenderExploreCatalog = showExploreCatalog || Boolean(onExploreCatalog);
  const hasActions = shouldRenderExploreCatalog || Boolean(actions);

  const cardClassName = [
    'bg-card rounded-2xl border border-border p-12 text-center max-w-lg mx-auto shadow-xs',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconBadgeClassName = [
    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
    iconContainerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClassName}>
      <div className={iconBadgeClassName}>{icon}</div>

      <HeadingTag className="font-serif font-bold text-xl text-foreground mb-2">
        {title}
      </HeadingTag>

      <p className="text-sm text-muted-foreground font-serif leading-relaxed mb-6">
        {description}
      </p>

      {hasActions && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {shouldRenderExploreCatalog && (
            <Button
              variant="primary"
              size="md"
              onClick={onExploreCatalog}
              className={COLLECTION_EMPTY_ACTION_CLASS}
            >
              <Compass className="w-4 h-4" />
              <span>Explore Catalog</span>
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
};
