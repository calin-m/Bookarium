'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { syncAllStoresWithCloud } from '@/lib/sync-utils';
import { AuthModal } from '@/components/auth/AuthModal';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 30 * 60 * 1000, // 30 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => {
      unsubscribe?.();
    };
  }, [initializeAuth]);

  useEffect(() => {
    if (user?.id) {
      syncAllStoresWithCloud(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastSyncTime = Date.now();

    const handleOnline = () => {
      if (user?.id) {
        lastSyncTime = Date.now();
        syncAllStoresWithCloud(user.id);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        const now = Date.now();
        if (now - lastSyncTime >= 15000) {
          lastSyncTime = now;
          syncAllStoresWithCloud(user.id);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceWorkerRegister />
      {children}
      <AuthModal />
    </QueryClientProvider>
  );
}

