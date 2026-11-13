import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Bookmark, Highlighter } from 'lucide-react';
import { CollectionEmptyState } from './CollectionEmptyState';
import { Button } from '@/components/ui/Button';

describe('CollectionEmptyState', () => {
  it('renders unified card geometry, icon emblem, and editorial typography', () => {
    const { container } = render(
      <CollectionEmptyState
        icon={<Bookmark className="w-8 h-8" data-testid="empty-icon" />}
        iconContainerClassName="bg-primary/10 text-primary"
        title="No active reading volumes yet"
        description="Volumes you begin reading will appear here."
      />
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass(
      'bg-card',
      'rounded-2xl',
      'border',
      'border-border',
      'p-12',
      'text-center',
      'max-w-lg',
      'mx-auto',
      'shadow-xs'
    );

    const icon = screen.getByTestId('empty-icon');
    expect(icon.parentElement).toHaveClass(
      'w-16',
      'h-16',
      'rounded-full',
      'bg-primary/10',
      'text-primary',
      'mx-auto',
      'mb-4'
    );

    const heading = screen.getByRole('heading', { level: 3, name: 'No active reading volumes yet' });
    expect(heading).toHaveClass('font-serif', 'font-bold', 'text-xl', 'text-foreground', 'mb-2');

    const desc = screen.getByText('Volumes you begin reading will appear here.');
    expect(desc).toHaveClass('text-sm', 'text-muted-foreground', 'font-serif', 'leading-relaxed', 'mb-6');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('supports semantic h2 heading level and triggers primary Explore Catalog CTA', () => {
    const handleExplore = vi.fn();

    render(
      <CollectionEmptyState
        icon={<Highlighter className="w-8 h-8" />}
        iconContainerClassName="bg-amber-500/10 text-amber-500"
        headingAs="h2"
        title="Your Notebook is Empty"
        description="Highlight passages while reading."
        onExploreCatalog={handleExplore}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Your Notebook is Empty' })).toBeInTheDocument();

    const exploreButton = screen.getByRole('button', { name: /Explore Catalog/i });
    expect(exploreButton.querySelector('svg')).not.toBeNull();

    fireEvent.click(exploreButton);
    expect(handleExplore).toHaveBeenCalledTimes(1);
  });

  it('renders secondary and custom actions alongside Explore Catalog', () => {
    const handleExplore = vi.fn();
    const handleSync = vi.fn();

    render(
      <CollectionEmptyState
        icon={<Bookmark className="w-8 h-8" />}
        title="No books found"
        description="Save classic books from the catalog."
        onExploreCatalog={handleExplore}
        actions={
          <Button variant="outline" size="md" onClick={handleSync}>
            <span>Sign In</span>
          </Button>
        }
      />
    );

    const exploreButton = screen.getByRole('button', { name: /Explore Catalog/i });
    const syncButton = screen.getByRole('button', { name: /^Sign In$/i });

    expect(syncButton.querySelector('svg')).toBeNull();

    fireEvent.click(exploreButton);
    fireEvent.click(syncButton);
    expect(handleExplore).toHaveBeenCalledTimes(1);
    expect(handleSync).toHaveBeenCalledTimes(1);
  });
});
