import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EditorialArticles, ARTICLES } from './EditorialArticles';

describe('EditorialArticles component', () => {
  it('should render section heading and all 3 article cards', () => {
    render(<EditorialArticles />);

    expect(screen.getByText(/Latest Literary Articles/i)).toBeInTheDocument();
    expect(screen.getByText(/READ OUR ESSAYS & ARCHIVES/i)).toBeInTheDocument();

    ARTICLES.forEach((article) => {
      expect(screen.getByText(article.title)).toBeInTheDocument();
      expect(screen.getByTestId(`article-card-${article.id}`)).toBeInTheDocument();
    });
  });
});

