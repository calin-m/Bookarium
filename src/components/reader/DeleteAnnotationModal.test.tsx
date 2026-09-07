import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DeleteAnnotationModal } from './DeleteAnnotationModal';

describe('DeleteAnnotationModal', () => {
  const mockAnnotation = {
    selectedText: 'Life is what happens when you are busy making other plans.',
    note: 'Inspirational quote',
  };

  it('renders correctly when open with quote text and note preview', () => {
    render(
      <DeleteAnnotationModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        annotation={mockAnnotation}
      />
    );

    expect(screen.getByTestId('delete-single-note-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Saved Note & Highlight?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this saved quote\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Life is what happens/i)).toBeInTheDocument();
    expect(screen.getByText('Inspirational quote')).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <DeleteAnnotationModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        annotation={mockAnnotation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Delete Note button is clicked', () => {
    const handleConfirm = vi.fn();
    render(
      <DeleteAnnotationModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        annotation={mockAnnotation}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete Note/i }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('supports custom title and description overrides', () => {
    render(
      <DeleteAnnotationModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        annotation={mockAnnotation}
        title="Custom Delete Title"
        description="Custom description warning message."
      />
    );

    expect(screen.getByText('Custom Delete Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description warning message.')).toBeInTheDocument();
  });
});

