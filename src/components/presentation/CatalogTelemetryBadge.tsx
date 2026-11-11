'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Formats API latency in milliseconds into a compact human-readable string (`ms` or `s`).
 */
export function formatApiLatency(ms?: number): string {
  if (ms === undefined || isNaN(ms)) return '...';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${parseFloat((ms / 1000).toFixed(3))}s`;
}

export interface CatalogTelemetryBadgeProps {
  page: number;
  activeFetching: boolean;
  latencyMs?: number;
  catalogSource?: 'supabase' | 'upstream' | 'cache';
  isError?: boolean;
}

/**
 * Zero-CLS Unified Catalog API Status, Latency & Dual-Service Diagnostic Radar Pill
 * (`Bookarium DB` + `Gutendex API`) with automatic viewport-collision placement.
 */
export const CatalogTelemetryBadge: React.FC<CatalogTelemetryBadgeProps> = ({
  page,
  activeFetching,
  latencyMs,
  catalogSource,
  isError = false,
}) => {
  const [popoverPlacement, setPopoverPlacement] = useState<'down' | 'up'>(
    'down'
  );
  const [isTappedOpen, setIsTappedOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  const updatePlacement = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const estimatedPopoverHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedPopoverHeight + 12 && spaceAbove > spaceBelow) {
      setPopoverPlacement('up');
    } else {
      setPopoverPlacement('down');
    }
  }, []);

  useEffect(() => {
    updatePlacement();
    const onScrollOrResize = () => {
      updatePlacement();
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [updatePlacement]);

  useEffect(() => {
    if (!isTappedOpen) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setIsTappedOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [isTappedOpen]);

  const isLatencyPending =
    !isError && (latencyMs === undefined || isNaN(latencyMs));
  const displayLatencyText = formatApiLatency(latencyMs);
  const catalogProviderLabel =
    catalogSource === 'supabase'
      ? 'Bookarium Catalog'
      : catalogSource === 'upstream'
      ? 'Project Gutenberg Mirror'
      : 'Bookarium Catalog';

  return (
    <div
      ref={badgeRef}
      className={`group relative hidden sm:inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono tracking-wider transition-all border border-border min-w-[72px] sm:min-w-[78px] text-center select-none cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs ${
        isError
          ? 'bg-destructive/10 text-destructive border-destructive/30'
          : activeFetching
          ? 'bg-primary/10 text-primary border-primary/30'
          : 'bg-success/10 text-success border-success/30'
      }`}
      tabIndex={0}
      role="status"
      data-expanded={isTappedOpen}
      aria-label={
        isError
          ? 'Catalog API status: Offline'
          : activeFetching
          ? `Fetching page ${page} from archive. Hover or click for details.`
          : isLatencyPending
          ? 'Catalog status: Measuring response time'
          : `${catalogProviderLabel} status: Online, response time ${displayLatencyText}`
      }
      data-testid="api-status-badge"
      onClick={() => {
        updatePlacement();
        setIsTappedOpen((prev) => !prev);
      }}
      onPointerEnter={updatePlacement}
      onFocus={updatePlacement}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          updatePlacement();
          setIsTappedOpen((prev) => !prev);
        } else if (e.key === 'Escape') {
          setIsTappedOpen(false);
          badgeRef.current?.blur();
        }
      }}
    >
      {activeFetching ? (
        <span
          className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0"
          data-testid="archive-fetching-badge"
        >
          <span className="absolute inset-0 rounded-full border-[1.5px] border-primary/30 border-t-primary animate-spin" />
          <span className="text-[8px] font-serif font-bold italic text-primary leading-none select-none">
            i
          </span>
        </span>
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
            isError ? 'bg-destructive' : 'bg-success'
          }`}
          data-testid="api-status-dot"
        />
      )}
      <span className="font-bold" data-testid="api-latency-badge">
        {isError ? (
          'Offline'
        ) : activeFetching || isLatencyPending ? (
          <span
            className="inline-flex items-center tracking-widest animate-pulse"
            data-testid="api-latency-loading"
          >
            •••
          </span>
        ) : (
          displayLatencyText
        )}
      </span>

      {/* Rich Animated Dual-Service Diagnostics Popover Card */}
      <div
        className={`transition-all duration-200 ease-out absolute right-0 w-72 sm:w-80 p-3.5 bg-card text-foreground border border-border rounded-xl shadow-booksaw-hover z-50 text-xs space-y-2.5 text-left ${
          isTappedOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto pointer-events-none'
        } ${
          popoverPlacement === 'up'
            ? 'bottom-full mb-2 origin-bottom-right'
            : 'top-full mt-2 origin-top-right'
        }`}
        data-testid="catalog-telemetry-popover"
      >
        <div className="font-serif font-bold text-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            {activeFetching
              ? 'Deep Archive Query'
              : isError
              ? 'Catalog Disconnected'
              : 'Catalog Diagnostics'}
          </span>
          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            {activeFetching
              ? `Page ${page}`
              : isError
              ? 'Offline'
              : displayLatencyText}
          </span>
        </div>

        {/* Dual-Service Diagnostics Checklist */}
        <div className="space-y-1.5 pt-1 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !isError && catalogSource === 'supabase'
                    ? 'bg-success'
                    : 'bg-muted-foreground/40'
                }`}
              />
              Bookarium DB
            </span>
            <span
              className={
                !isError && catalogSource === 'supabase'
                  ? 'text-success font-semibold'
                  : 'text-muted-foreground'
              }
            >
              {isError
                ? 'Offline'
                : catalogSource === 'supabase'
                ? `Online · ${displayLatencyText}`
                : 'Standby / Unseeded'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !isError && catalogSource === 'upstream'
                    ? 'bg-success'
                    : isError
                    ? 'bg-destructive'
                    : 'bg-muted-foreground/40'
                }`}
              />
              Gutendex API
            </span>
            <span
              className={
                !isError && catalogSource === 'upstream'
                  ? 'text-success font-semibold'
                  : 'text-muted-foreground'
              }
            >
              {isError
                ? 'Offline'
                : catalogSource === 'upstream'
                ? `Active · ${displayLatencyText}`
                : 'Standby'}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground font-sans leading-relaxed pt-1 border-t border-border/60">
          {activeFetching ? (
            <>
              Scanning through <strong>70,000+ public domain titles</strong>.
              Large page offsets compute deep relational queries on live
              Gutenberg servers and may take a moment to deliver.
            </>
          ) : isError ? (
            <>
              Network or service unavailable. Your cached bookshelf, saved
              quotes, and downloaded books remain fully accessible offline.
            </>
          ) : catalogSource === 'upstream' ? (
            <>
              Serving public domain volumes via the upstream Gutendex REST
              mirror. Automatic failover active.
            </>
          ) : (
            <>
              Connected to dedicated Supabase PostgreSQL database. Queries are
              accelerated with zero external rate limits.
            </>
          )}
        </p>
      </div>
    </div>
  );
};
