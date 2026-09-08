import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PinnedAccoladesShelf, type PinnedBookplateItem } from './PinnedAccoladesShelf';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';

const sampleDefinitions = ACCOLADES_CATALOG.slice(0, 2);

const mockPinnedItems: PinnedBookplateItem[] = [
  {
    definition: sampleDefinitions[0],
    progress: {
      id: sampleDefinitions[0].id,
      isUnlocked: true,
      unlockedAt: '2025-01-01T00:00:00.000Z',
      isPinned: true,
      current: 1,
      target: 1,
      percent: 100,
    },
  },
  {
    definition: sampleDefinitions[1],
    progress: {
      id: sampleDefinitions[1].id,
      isUnlocked: true,
      unlockedAt: '2025-01-02T00:00:00.000Z',
      isPinned: true,
      current: 3,
      target: 3,
      percent: 100,
    },
  },
];

describe('PinnedAccoladesShelf', () => {
  it('renders pinned bookplate items and badge count', () => {
    render(<PinnedAccoladesShelf pinnedItems={mockPinnedItems} />);

    expect(
      screen.getByRole('region', { name: /pinned ex-libris bookplates/i })
    ).toBeInTheDocument();
    expect(screen.getByText('2 Pinned Bookplates')).toBeInTheDocument();
    expect(screen.getByText(sampleDefinitions[0].title)).toBeInTheDocument();
    expect(screen.getByText(sampleDefinitions[1].title)).toBeInTheDocument();
  });

  it('renders empty showcase state when no bookplates are pinned', () => {
    render(<PinnedAccoladesShelf pinnedItems={[]} />);

    expect(screen.getByText('0 Pinned Bookplates')).toBeInTheDocument();
    expect(
      screen.getByText(/this scholar has not pinned any bookplates/i)
    ).toBeInTheDocument();
  });
});
