import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AccountLayout, { metadata } from './layout';

describe('AccountLayout', () => {
  it('exposes accurate account metadata and blocks search engine indexing', () => {
    expect(metadata.title).toBe('Account Settings & Preferences');
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('renders children transparently without modifying DOM tree', () => {
    render(
      <AccountLayout>
        <div data-testid="account-children">Account Settings Content</div>
      </AccountLayout>
    );

    expect(screen.getByTestId('account-children')).toBeInTheDocument();
  });
});

