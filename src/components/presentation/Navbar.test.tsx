import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Navbar } from './Navbar';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { mockBooks } from '@/mocks/handlers';

describe('Navbar component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
  });

  it('should render brand and navigation items', () => {
    render(<Navbar activeView="catalog" />);
    expect(screen.getByText(/Bookarium/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bookshelf')).toBeInTheDocument();
    expect(screen.getByLabelText('Liked Books')).toBeInTheDocument();
  });

  it('should display saved books count badge when items are saved', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    render(<Navbar activeView="catalog" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should trigger onViewChange callback when clicking tabs', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);
    expect(handleViewChange).toHaveBeenCalledWith('bookshelf');

    const brand = screen.getByText(/Bookarium/i);
    fireEvent.click(brand);
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
  });

  it('should toggle theme when clicking theme button', () => {
    render(<Navbar activeView="catalog" />);
    const themeBtn = screen.getByLabelText('Toggle dark mode');
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
