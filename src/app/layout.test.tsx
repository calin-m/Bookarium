import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RootLayout, { metadata } from './layout';

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <div data-testid="vercel-speed-insights" />,
}));

describe('RootLayout', () => {
  it('should expose valid metadata with OpenGraph, Twitter, and canonical alternates', () => {
    const titleObj = metadata.title as { default: string; template: string };
    expect(titleObj.default).toContain('Bookarium');
    expect(metadata.description).toBeDefined();
    expect(metadata.metadataBase).toBeDefined();
    expect(metadata.alternates?.canonical).toBe('/');
    const og = metadata.openGraph as Record<string, unknown> | undefined;
    const tw = metadata.twitter as Record<string, unknown> | undefined;
    expect(og?.type).toBe('website');
    expect(og?.images).toBeDefined();
    expect(tw?.card).toBe('summary');
  });

  it('should render children within html structure alongside analytics and performance telemetry', () => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('cannot be a child of <div>')) {
        return;
      }
      originalError(...args);
    };

    try {
      render(
        <RootLayout>
          <div data-testid="layout-children">Layout App</div>
        </RootLayout>
      );
      expect(screen.getByTestId('layout-children')).toBeInTheDocument();
      expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
      expect(screen.getByTestId('vercel-speed-insights')).toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });
});

