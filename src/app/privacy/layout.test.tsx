import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PrivacyLayout, { metadata } from './layout';
import { SITE_CONFIG } from '@/config/site-config';

describe('PrivacyLayout', () => {
  it('exposes accurate privacy metadata, canonical url, and Twitter summary card', () => {
    expect(metadata.title).toBe('Privacy & Data Architecture');
    expect(metadata.description).toBeDefined();
    expect(metadata.alternates?.canonical).toBe('/privacy');
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: SITE_CONFIG.NAME,
      url: `${SITE_CONFIG.SITE_URL}/privacy`,
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary',
      title: `Privacy & Data Architecture | ${SITE_CONFIG.NAME}`,
    });
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

