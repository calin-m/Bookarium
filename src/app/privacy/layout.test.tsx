import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PrivacyLayout, { metadata } from './layout';

describe('PrivacyLayout', () => {
  it('exposes accurate privacy metadata and canonical url', () => {
    expect(metadata.title).toBe('Privacy & Data Architecture');
    expect(metadata.description).toBeDefined();
    expect(metadata.alternates?.canonical).toBe('/privacy');
  });

  it('renders children transparently without modifying DOM tree', () => {
    render(
      <PrivacyLayout>
        <div data-testid="privacy-children">Privacy Content</div>
      </PrivacyLayout>
    );

    expect(screen.getByTestId('privacy-children')).toBeInTheDocument();
  });
});

