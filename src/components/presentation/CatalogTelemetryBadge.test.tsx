import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  CatalogTelemetryBadge,
  formatApiLatency,
} from './CatalogTelemetryBadge';

describe('CatalogTelemetryBadge', () => {
  it('formats API latency across millisecond and second thresholds', () => {
    expect(formatApiLatency(undefined)).toBe('...');
    expect(formatApiLatency(42)).toBe('42ms');
    expect(formatApiLatency(1250)).toBe('1.25s');
  });

  it('displays fetching, error, and healthy states and toggles the diagnostic popover', () => {
    const { rerender } = render(
      <CatalogTelemetryBadge
        page={2}
        activeFetching={true}
        latencyMs={42}
        catalogSource="supabase"
        isError={false}
      />
    );

    expect(screen.getByTestId('archive-fetching-badge')).toBeInTheDocument();

    rerender(
      <CatalogTelemetryBadge
        page={2}
        activeFetching={false}
        latencyMs={42}
        catalogSource="supabase"
        isError={false}
      />
    );

    const badge = screen.getByTestId('api-status-badge');
    expect(screen.getByTestId('api-latency-badge')).toHaveTextContent('42ms');
    expect(badge).toHaveAttribute('data-expanded', 'false');

    fireEvent.click(badge);
    expect(badge).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByTestId('catalog-telemetry-popover')).toHaveTextContent(
      'Bookarium DB'
    );

    fireEvent.keyDown(badge, { key: 'Escape' });
    expect(badge).toHaveAttribute('data-expanded', 'false');

    rerender(
      <CatalogTelemetryBadge
        page={1}
        activeFetching={false}
        latencyMs={85}
        catalogSource="cache"
        isError={false}
      />
    );
    expect(screen.getByTestId('catalog-telemetry-popover')).toHaveTextContent('Curated Archive Cache');
    expect(screen.getByTestId('catalog-telemetry-popover')).toHaveTextContent('Active · 85ms');
    expect(screen.getByTestId('catalog-telemetry-popover')).toHaveTextContent('Standby / Unseeded');
  });
});
