import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ConfirmDeletionLayout, { metadata } from './layout';

describe('ConfirmDeletionLayout', () => {
  it('exposes account deletion title and blocks search engine indexing', () => {
    expect(metadata.title).toBe('Confirm Account Deletion');
    expect(metadata.description).toBeDefined();
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('renders children transparently without altering DOM tree', () => {
    render(
      <ConfirmDeletionLayout>
        <div data-testid="confirm-deletion-child">Confirm Deletion Content</div>
      </ConfirmDeletionLayout>
    );

    expect(screen.getByTestId('confirm-deletion-child')).toBeInTheDocument();
  });
});
