'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { initializeJurisdiction } from '@/stores/useJurisdictionStore';
import { initializeTheme, type AppTheme } from '@/stores/useThemeStore';
import { syncAllStoresWithCloud } from '@/lib/sync-utils';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { GlobalTitleTooltip } from '@/components/ui/CursorTooltip';

const AuthModal = dynamic(
  () => import('@/components/auth/AuthModal').then((mod) => mod.AuthModal),
  { ssr: false }
);

export const AuthHintContext = React.createContext<boolean>(false);

export function useAuthHint(): boolean {
  return React.useContext(AuthHintContext);
}

export interface ProvidersProps {
  children: React.ReactNode;
  initialCountry?: string;
  initialTheme?: AppTheme;
  initialIsAuthenticated?: boolean;
}

export function Providers({
  children,
  initialCountry,
  initialTheme,
  initialIsAuthenticated = false,
}: ProvidersProps) {
  if (initialCountry) {
    initializeJurisdiction(initialCountry);
  }
  useState(() => {
    if (initialTheme) {
      initializeTheme(initialTheme);
    }
    return true;
  });
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
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const setError = useAuthStore((s) => s.setError);
  const setStatusMessage = useAuthStore((s) => s.setStatusMessage);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen);
  const lastSyncTimeRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => {
      unsubscribe?.();
    };
  }, [initializeAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const authNotice = params.get('auth_notice');
    const authError = params.get('auth_error');

    if (!authNotice && !authError) return;

    if (authNotice === 'email_verified') {
      openAuthModal('sign_in');
      setStatusMessage(
        'Email verified! Please sign in to access your bookshelf on this device.'
      );
      params.delete('auth_notice');
    } else if (authError === 'verification_failed') {
      openAuthModal('sign_in');
      setError(
        'This verification link has expired or was already used. Please sign in or request a new link.'
      );
      params.delete('auth_error');
    } else if (authError === 'oauth_failed') {
      openAuthModal('sign_in');
      setError(
        'Google sign-in was cancelled or could not be completed. Please try again or sign in with email.'
      );
      params.delete('auth_error');
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname || '/'}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [openAuthModal, setError, setStatusMessage]);

  useEffect(() => {
    if (!isLoading && user?.id) {
      lastSyncTimeRef.current = Date.now();
      syncAllStoresWithCloud(user.id);
    }
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (lastSyncTimeRef.current === 0) {
      lastSyncTimeRef.current = Date.now();
    }

    const handleOnline = () => {
      if (!isLoading && user?.id) {
        lastSyncTimeRef.current = Date.now();
        syncAllStoresWithCloud(user.id);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoading && user?.id) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current >= 15000) {
          lastSyncTimeRef.current = now;
          syncAllStoresWithCloud(user.id);
        }
      }
    };

    const handleTokenRefreshed = () => {
      if (!isLoading && user?.id) {
        lastSyncTimeRef.current = Date.now();
        syncAllStoresWithCloud(user.id);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('bookarium:auth-token-refreshed', handleTokenRefreshed);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('bookarium:auth-token-refreshed', handleTokenRefreshed);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading, user?.id]);

  return (
    <AuthHintContext.Provider value={initialIsAuthenticated}>
      <QueryClientProvider client={queryClient}>
        <ServiceWorkerRegister />
        <GlobalTitleTooltip />
        {children}
        {isAuthModalOpen && <AuthModal />}
      </QueryClientProvider>
    </AuthHintContext.Provider>
  );
}

