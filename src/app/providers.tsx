'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { AuthModal } from '@/components/auth/AuthModal';

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
  const syncWithCloud = useBookshelfStore((s) => s.syncWithCloud);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => {
      unsubscribe?.();
    };
  }, [initializeAuth]);

  useEffect(() => {
    if (user?.id) {
      syncWithCloud(user.id);
    }
  }, [user?.id, syncWithCloud]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (user?.id) {
        syncWithCloud(user.id);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.id, syncWithCloud]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AuthModal />
    </QueryClientProvider>
  );
}

