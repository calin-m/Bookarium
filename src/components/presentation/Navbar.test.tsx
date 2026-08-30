import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Navbar } from './Navbar';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { mockBooks } from '@/mocks/handlers';

describe('Navbar component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.className = '';
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

  it('should cycle through themes when clicking theme button', () => {
    render(<Navbar activeView="catalog" />);
    const themeBtn = screen.getByRole('button', { name: /Current theme:/i });

    // Light -> Sepia
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);

    // Sepia -> Dark
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Dark -> Light
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
