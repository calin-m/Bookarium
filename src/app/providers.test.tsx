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
    useAuthStore.setState({ user: null });
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
});

