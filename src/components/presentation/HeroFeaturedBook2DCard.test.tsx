import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroFeaturedBook2DCard } from './HeroFeaturedBook2DCard';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';

describe('HeroFeaturedBook2DCard', () => {
  it('renders featured book metadata, opening quote, and invokes read and shuffle callbacks', () => {
    const onReadFeaturedBook = vi.fn();
    const onShuffle = vi.fn();
    const sampleHero = FEATURED_HERO_BOOKS[0];

    render(
      <HeroFeaturedBook2DCard
        featuredBook={sampleHero}
        onReadFeaturedBook={onReadFeaturedBook}
        coverQuote={sampleHero.openingLine}
        coverLineClampClass="line-clamp-4"
        quoteRevealClass=""
        isTurningLeaf={false}
        canShuffle={true}
        onShuffle={onShuffle}
      />
    );

    expect(screen.getByTestId('hero-featured-book-2d')).toBeInTheDocument();
    expect(screen.getByText(sampleHero.title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(sampleHero.author))).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hero-book-read-btn'));
    expect(onReadFeaturedBook).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('hero-book-shuffle-btn'));
    expect(onShuffle).toHaveBeenCalledTimes(1);
  });
});
