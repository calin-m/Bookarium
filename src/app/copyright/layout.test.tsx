import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CopyrightLayout, { metadata } from './layout';
import { SITE_CONFIG } from '@/config/site-config';

describe('CopyrightLayout', () => {
  it('exposes accurate copyright governance metadata and canonical url', () => {
    expect(metadata.title).toBe('Copyright & Public Domain Governance');
    expect(metadata.description).toContain('US 1930');
    expect(metadata.alternates?.canonical).toBe('/copyright');
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: SITE_CONFIG.NAME,
      url: `${SITE_CONFIG.SITE_URL}/copyright`,
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary',
      title: `Copyright & Public Domain Governance | ${SITE_CONFIG.NAME}`,
    });
  });

  it('renders children transparently without altering DOM tree', () => {
    render(
      <CopyrightLayout>
        <div data-testid="copyright-children">Copyright Content</div>
      </CopyrightLayout>
    );

    expect(screen.getByTestId('copyright-children')).toBeInTheDocument();
  });
});
