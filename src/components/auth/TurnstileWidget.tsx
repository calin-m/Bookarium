'use client';

import React, { useEffect, useImperativeHandle, useRef } from 'react';
import Script from 'next/script';

export interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  active?: boolean;
  mountKey?: string | number;
  theme?: 'light' | 'dark' | 'auto';
  testId?: string;
  className?: string;
  onTokenChange: (token: string | null) => void;
  onLoadError?: (message: string) => void;
}

export function getTurnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
}

function removeTurnstileInstance(widgetIdRef: React.MutableRefObject<string | null>): void {
  if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
    try {
      window.turnstile.remove(widgetIdRef.current);
    } catch {
      // Ignore cleanup errors on unmounted widgets
    }
    widgetIdRef.current = null;
  }
}

const DEFAULT_TURNSTILE_ERROR =
  'Security verification failed to load or verify. Please retry or allow challenges.cloudflare.com.';

/**
 * Shared Cloudflare Turnstile explicit widget wrapper. Renders nothing when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is blank or `active` is false so zero-config
 * local/offline setups incur zero external scripts or layout overhead.
 */
export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      active = true,
      mountKey,
      theme = 'auto',
      testId = 'turnstile-widget-container',
      className,
      onTokenChange,
      onLoadError,
    },
    ref
  ) {
    const siteKey = getTurnstileSiteKey();
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    const onLoadErrorRef = useRef(onLoadError);

    useEffect(() => {
      onTokenChangeRef.current = onTokenChange;
      onLoadErrorRef.current = onLoadError;
    }, [onTokenChange, onLoadError]);

    const mountWidget = React.useCallback(() => {
      if (
        !active ||
        !siteKey ||
        typeof window === 'undefined' ||
        !window.turnstile ||
        !containerRef.current
      ) {
        return;
      }

      removeTurnstileInstance(widgetIdRef);
      onTokenChangeRef.current(null);
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => {
          onTokenChangeRef.current(token);
        },
        'expired-callback': () => {
          onTokenChangeRef.current(null);
        },
        'error-callback': () => {
          onTokenChangeRef.current(null);
          onLoadErrorRef.current?.(DEFAULT_TURNSTILE_ERROR);
        },
      });
    }, [active, siteKey, theme]);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          onTokenChangeRef.current(null);
          if (typeof window !== 'undefined' && window.turnstile && widgetIdRef.current) {
            try {
              window.turnstile.reset(widgetIdRef.current);
            } catch {
              // Ignore reset errors on unmounted widgets
            }
          }
        },
      }),
      []
    );

    useEffect(() => {
      if (!active || !siteKey) return;
      mountWidget();
      return () => {
        removeTurnstileInstance(widgetIdRef);
      };
    }, [active, siteKey, mountKey, mountWidget]);

    if (!active || !siteKey) {
      return null;
    }

    return (
      <div className={className}>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={mountWidget}
          onError={() => {
            onTokenChangeRef.current(null);
            onLoadErrorRef.current?.(DEFAULT_TURNSTILE_ERROR);
          }}
        />
        <div
          ref={containerRef}
          data-testid={testId}
          className="min-h-[65px] flex items-center justify-center"
        />
      </div>
    );
  }
);
