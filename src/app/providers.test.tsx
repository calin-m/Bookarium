import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { Providers, useAuthHint } from './providers';
import { syncAllStoresWithCloud } from '@/lib/sync-utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';

vi.mock('@/lib/sync-utils', () => ({
  syncAllStoresWithCloud: vi.fn(),
}));

describe('Providers component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.search = '';
    useAuthStore.setState({
      user: null,
      isAuthModalOpen: false,
      error: null,
      statusMessage: null,
      initializeAuth: vi.fn(() => () => {}),
    });
  });

  it('should render children within QueryClientProvider', () => {
    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('should call syncAllStoresWithCloud only after auth initialization finishes (!isLoading)', () => {
    useAuthStore.setState({
      user: { id: 'user-123', email: 'test@example.com' } as any,
      isLoading: true,
    });

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    expect(syncAllStoresWithCloud).not.toHaveBeenCalled();

    act(() => {
      useAuthStore.setState({ isLoading: false });
    });

    expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-123');
  });

  it('should trigger syncAllStoresWithCloud on window online event when user is logged in', () => {
    useAuthStore.setState({
      user: { id: 'user-online-1', email: 'online@example.com' } as any,
    });

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-online-1');
    vi.mocked(syncAllStoresWithCloud).mockClear();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-online-1');
  });

  it('should trigger syncAllStoresWithCloud on document visibilitychange when user is logged in and cooldown passed', () => {
    vi.useFakeTimers();
    useAuthStore.setState({
      user: { id: 'user-vis-1', email: 'vis@example.com' } as any,
    });

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-vis-1');
    vi.mocked(syncAllStoresWithCloud).mockClear();

    // Advance time beyond cooldown (15s)
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    // Mock document.visibilityState to 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-vis-1');
    vi.useRealTimers();
  });

  it('opens AuthModal with confirmation statusMessage when ?auth_notice=email_verified is present on mount', () => {
    window.location.search = '?auth_notice=email_verified';
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    const authState = useAuthStore.getState();
    expect(authState.isAuthModalOpen).toBe(true);
    expect(authState.authModalView).toBe('sign_in');
    expect(authState.statusMessage).toContain('Email verified!');
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/');
  });

  it('opens AuthModal in forgot_password view when ?auth_notice=recovery_cross_device is present on mount', () => {
    window.location.search = '?auth_notice=recovery_cross_device';
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    const authState = useAuthStore.getState();
    expect(authState.isAuthModalOpen).toBe(true);
    expect(authState.authModalView).toBe('forgot_password');
    expect(authState.error).toContain('same browser where you requested it');
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/');
  });

  it('opens AuthModal with expired link error when ?auth_error=verification_failed is present on mount', () => {
    window.location.search = '?auth_error=verification_failed';
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    const authState = useAuthStore.getState();
    expect(authState.isAuthModalOpen).toBe(true);
    expect(authState.authModalView).toBe('sign_in');
    expect(authState.error).toContain('expired or was already used');
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/');
  });

  it('opens AuthModal with OAuth failure notice when ?auth_error=oauth_failed is present on mount', () => {
    window.location.search = '?auth_error=oauth_failed';
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

    const authState = useAuthStore.getState();
    expect(authState.isAuthModalOpen).toBe(true);
    expect(authState.authModalView).toBe('sign_in');
    expect(authState.error).toContain('Google sign-in was cancelled or could not be completed');
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/');
  });

  it('provides initialIsAuthenticated through useAuthHint context', () => {
    function TestConsumer() {
      const isAuthHint = useAuthHint();
      return <div data-testid="auth-hint">{isAuthHint ? 'authenticated' : 'guest'}</div>;
    }

    const { rerender } = render(
      <Providers initialIsAuthenticated={true}>
        <TestConsumer />
      </Providers>
    );

    expect(screen.getByTestId('auth-hint')).toHaveTextContent('authenticated');

    rerender(
      <Providers initialIsAuthenticated={false}>
        <TestConsumer />
      </Providers>
    );

    expect(screen.getByTestId('auth-hint')).toHaveTextContent('guest');
  });

  it('initializes theme in store when initialTheme is provided and never reverts client theme changes on rerender', () => {
    const { rerender } = render(
      <Providers initialTheme="dark">
        <div>Content</div>
      </Providers>
    );

    expect(useThemeStore.getState().theme).toBe('dark');

    // User switches to sepia on the client, then Providers re-renders with a stale initialTheme="light" prop
    act(() => {
      useThemeStore.getState().setTheme('sepia');
    });
    expect(useThemeStore.getState().theme).toBe('sepia');

    rerender(
      <Providers initialTheme="light">
        <div>Content Updated</div>
      </Providers>
    );

    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);
  });

  it('suppresses duplicate visibilitychange sync within 15s cooldown but keeps auth-token-refreshed unthrottled', () => {
    vi.useFakeTimers();
    try {
      useAuthStore.setState({
        user: { id: 'user-sleep-1', email: 'sleep@example.com' } as unknown as ReturnType<
          typeof useAuthStore.getState
        >['user'],
        isLoading: false,
      });

      render(
        <Providers>
          <div>Child Content</div>
        </Providers>
      );

      expect(syncAllStoresWithCloud).toHaveBeenCalledTimes(1);
      expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-sleep-1');
      vi.mocked(syncAllStoresWithCloud).mockClear();

      // Advance only 5s (< 15s cooldown): visibilitychange should stay suppressed
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(syncAllStoresWithCloud).not.toHaveBeenCalled();

      // Wake-up TOKEN_REFRESHED immediately after visibilitychange must still bypass visibility cooldown
      act(() => {
        window.dispatchEvent(
          new CustomEvent('bookarium:auth-token-refreshed', { detail: { userId: 'user-sleep-1' } })
        );
      });
      expect(syncAllStoresWithCloud).toHaveBeenCalledTimes(1);
      expect(syncAllStoresWithCloud).toHaveBeenCalledWith('user-sleep-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconciles server-side session origin on mount and validates active session on online, visibilitychange, and visible 60s polling', () => {
    vi.useFakeTimers();
    const origVerify = useAuthStore.getState().verifyActiveSessionValidity;
    const origReconcile = useAuthStore.getState().reconcileClientSessionOrigin;
    const verifySpy = vi.fn().mockResolvedValue(true);
    const reconcileSpy = vi.fn().mockResolvedValue(undefined);
    const origVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    try {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      useAuthStore.setState({
        user: { id: 'user-session-guard-1' } as never,
        isLoading: false,
        verifyActiveSessionValidity: verifySpy,
        reconcileClientSessionOrigin: reconcileSpy,
      });

      const { unmount } = render(
        <Providers>
          <div>Child Content</div>
        </Providers>
      );

      expect(reconcileSpy).toHaveBeenCalledTimes(1);

      // Reconnecting triggers forced verification
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(verifySpy).toHaveBeenCalledWith({ force: true });

      // Returning to a visible tab triggers coalesced verification
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(verifySpy).toHaveBeenCalledTimes(2);

      // Visible 60s interval polls periodically while tab remains visible
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(verifySpy).toHaveBeenCalledTimes(3);

      // Hidden tab skips 60s interval verification
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(verifySpy).toHaveBeenCalledTimes(3);

      // Unmount cleans up interval and listeners
      unmount();
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(verifySpy).toHaveBeenCalledTimes(3);
    } finally {
      if (origVisibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', origVisibilityDescriptor);
      }
      useAuthStore.setState({
        user: null,
        verifyActiveSessionValidity: origVerify,
        reconcileClientSessionOrigin: origReconcile,
      });
      vi.useRealTimers();
    }
  });
});

