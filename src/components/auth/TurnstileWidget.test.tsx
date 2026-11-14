import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
  type TurnstileRenderOptions,
} from './TurnstileWidget';

vi.mock('next/script', () => ({
  default: ({
    onReady,
    onError,
  }: {
    onReady?: () => void;
    onError?: () => void;
  }) => (
    <div data-testid="turnstile-script-stub">
      <button type="button" data-testid="trigger-script-ready" onClick={() => onReady?.()}>
        ready
      </button>
      <button type="button" data-testid="trigger-script-error" onClick={() => onError?.()}>
        error
      </button>
    </div>
  ),
}));

describe('TurnstileWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.turnstile;
  });

  it('renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is empty or active is false', () => {
    const prevKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    try {
      const { container, rerender } = render(<TurnstileWidget onTokenChange={vi.fn()} />);
      expect(container.firstChild).toBeNull();

      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAATestKey';
      rerender(<TurnstileWidget active={false} onTokenChange={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    } finally {
      if (prevKey === undefined) {
        delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      } else {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevKey;
      }
    }
  });

  it('mounts Turnstile, forwards verification/error callbacks, resets via imperative handle, and cleans up on unmount', async () => {
    const prevKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAATestKey';

    let capturedOptions: TurnstileRenderOptions = { sitekey: '' };
    const renderMock = vi.fn((_el: HTMLElement, opts: TurnstileRenderOptions) => {
      capturedOptions = opts;
      return 'widget-id-1';
    });
    const resetMock = vi.fn();
    const removeMock = vi.fn();

    window.turnstile = {
      render: renderMock,
      reset: resetMock,
      remove: removeMock,
    };

    const onTokenChange = vi.fn();
    const onLoadError = vi.fn();
    const widgetRef = React.createRef<TurnstileWidgetHandle>();

    try {
      const { unmount, rerender } = render(
        <TurnstileWidget
          ref={widgetRef}
          mountKey="view-a"
          onTokenChange={onTokenChange}
          onLoadError={onLoadError}
        />
      );

      expect(screen.getByTestId('turnstile-widget-container')).toBeInTheDocument();
      expect(renderMock).toHaveBeenCalledTimes(1);
      expect(onTokenChange).toHaveBeenCalledWith(null);

      await waitFor(() => {
        capturedOptions.callback?.('token-abc');
      });
      expect(onTokenChange).toHaveBeenLastCalledWith('token-abc');

      act(() => {
        capturedOptions['expired-callback']?.();
      });
      expect(onTokenChange).toHaveBeenLastCalledWith(null);

      act(() => {
        capturedOptions['error-callback']?.();
      });
      expect(onLoadError).toHaveBeenCalledWith(
        'Security verification failed to load or verify. Please retry or allow challenges.cloudflare.com.'
      );

      act(() => {
        widgetRef.current?.reset();
      });
      expect(resetMock).toHaveBeenCalledWith('widget-id-1');
      expect(onTokenChange).toHaveBeenLastCalledWith(null);

      // Re-mounting via mountKey cleans up old widget and renders again
      rerender(
        <TurnstileWidget
          ref={widgetRef}
          mountKey="view-b"
          onTokenChange={onTokenChange}
          onLoadError={onLoadError}
        />
      );
      expect(removeMock).toHaveBeenCalledWith('widget-id-1');
      expect(renderMock).toHaveBeenCalledTimes(2);

      // Script onReady and onError hooks
      fireEvent.click(screen.getByTestId('trigger-script-ready'));
      expect(renderMock).toHaveBeenCalledTimes(3);

      fireEvent.click(screen.getByTestId('trigger-script-error'));
      expect(onLoadError).toHaveBeenCalledTimes(2);

      unmount();
      expect(removeMock).toHaveBeenCalled();
    } finally {
      if (prevKey === undefined) {
        delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      } else {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevKey;
      }
      delete window.turnstile;
    }
  });
});
