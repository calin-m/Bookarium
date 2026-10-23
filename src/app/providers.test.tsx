import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { Providers } from './providers';
import { syncAllStoresWithCloud } from '@/lib/sync-utils';
import { useAuthStore } from '@/stores/useAuthStore';

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

  it('should call syncAllStoresWithCloud when user is logged in', () => {
    useAuthStore.setState({
      user: { id: 'user-123', email: 'test@example.com' } as any,
    });

    render(
      <Providers>
        <div>Child Content</div>
      </Providers>
    );

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
});

