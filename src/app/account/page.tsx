'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User as UserIcon,
  Trophy,
  Sliders,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useHydratedHabits } from '@/stores/useHabitsStore';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { EditorialUnderlineTabs } from '@/components/ui/EditorialUnderlineTabs';
import { AccountIdentityCard } from '@/components/account/AccountIdentityCard';
import { AccountHabitsCard } from '@/components/account/AccountHabitsCard';
import { AccountAccoladesCard } from '@/components/account/AccountAccoladesCard';
import { AccountPublicProfileSection } from '@/components/account/AccountPublicProfileSection';
import { AccountSymposiumSection } from '@/components/account/AccountSymposiumSection';
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection';
import { AccountPreferencesSection } from '@/components/account/AccountPreferencesSection';
import { AccountBottomDock } from '@/components/account/AccountBottomDock';
import { smartScrollToContent } from '@/lib/scroll-utils';
import { AccountDeleteModal } from '@/components/account/AccountDeleteModal';
import { calculateCompletedBooksCount } from '@/lib/reading-analytics';
import {
  getFactoryPreferences,
  arePreferencesEqual,
  saveCurrentAsCustomDefaults,
  revertToCustomDefaults,
  resetAllPreferencesToFactoryDefaults,
  schedulePreferencesCloudSync,
} from '@/lib/preferences-sync';
import { useAccountSecurityActions } from '@/hooks/useAccountSecurityActions';
import { useMobileViewSwipe } from '@/hooks/useMobileViewSwipe';
import type { NavViewId } from '@/config/views.config';
import type { AccoladeCategory } from '@/types/accolades.types';
import { ROUTES } from '@/config/routes';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

type AccountTabId = 'profile' | 'habits' | 'preferences' | 'security';

interface AccountTabConfig {
  id: AccountTabId;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const ACCOUNT_TABS: readonly AccountTabConfig[] = [
  {
    id: 'profile',
    label: 'Scholar Profile',
    mobileLabel: 'Profile',
    icon: UserIcon,
    description: 'Scholar identity, public sanctuary privacy, Reader Circle & Symposium pacts',
  },
  {
    id: 'habits',
    label: 'Habits & Accolades',
    mobileLabel: 'Habits',
    icon: Trophy,
    description: 'Reading streaks, immersion metrics & Ex-Libris bookplates',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    mobileLabel: 'Prefs',
    icon: Sliders,
    description: 'Atmosphere themes, typography, sticky scroll & Read-Aloud Studio',
  },
  {
    id: 'security',
    label: 'Security',
    mobileLabel: 'Security',
    icon: ShieldCheck,
    description: 'Password, active sessions, OAuth & account deletion',
  },
] as const;

function AccountDashboardContent() {
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const {
    user: authUser,
    profile: authProfile,
    isLoading,
    isPasswordRecovery,
    updateProfile,
    updatePassword,
    resetPasswordForEmail,
    clearPasswordRecovery,
    verifyPasswordRecoverySession,
    requestAccountDeletion,
    signOut,
    signOutOtherDevices,
    listActiveSessions,
    revokeSession,
    openAuthModal,
    resendVerificationEmail,
    linkOAuthIdentity,
    unlinkOAuthIdentity,
  } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      isLoading: s.isLoading,
      isPasswordRecovery: s.isPasswordRecovery,
      updateProfile: s.updateProfile,
      updatePassword: s.updatePassword,
      resetPasswordForEmail: s.resetPasswordForEmail,
      clearPasswordRecovery: s.clearPasswordRecovery,
      verifyPasswordRecoverySession: s.verifyPasswordRecoverySession,
      requestAccountDeletion: s.requestAccountDeletion,
      signOut: s.signOut,
      signOutOtherDevices: s.signOutOtherDevices,
      listActiveSessions: s.listActiveSessions,
      revokeSession: s.revokeSession,
      openAuthModal: s.openAuthModal,
      resendVerificationEmail: s.resendVerificationEmail,
      linkOAuthIdentity: s.linkOAuthIdentity,
      unlinkOAuthIdentity: s.unlinkOAuthIdentity,
    }))
  );

  const searchParams = useSearchParams();
  const dirParam = searchParams.get('dir');
  const initialSwipeDir =
    dirParam === 'forward' || dirParam === 'backward' ? dirParam : null;
  const [swipeDirection, setSwipeDirection] = useState<'forward' | 'backward' | null>(
    initialSwipeDir
  );
  const [isTransitioning, setIsTransitioning] = useState<boolean>(
    Boolean(initialSwipeDir)
  );
  const [prevDirParam, setPrevDirParam] = useState<string | null>(dirParam);

  if (dirParam !== prevDirParam) {
    setPrevDirParam(dirParam);
    if (dirParam === 'forward' || dirParam === 'backward') {
      setSwipeDirection(dirParam);
      setIsTransitioning(true);
    }
  }

  const isPreviewMode = searchParams.get('preview') === 'true';

  const user = useMemo(
    () =>
      authUser ||
      (isPreviewMode
        ? ({
            id: 'preview-scholar',
            email: 'scholar@bookarium.test',
            user_metadata: { display_name: 'Scholar Reader' },
            created_at: '2024-01-01T00:00:00Z',
          } as unknown as User)
        : null),
    [authUser, isPreviewMode]
  );

  const profile =
    authProfile ||
    (isPreviewMode
      ? ({
          id: 'preview-scholar',
          display_name: 'Scholar Reader',
          created_at: '2024-01-01T00:00:00Z',
        } as unknown as Profile)
      : null);
  const { bookStatuses } = useHydratedBookshelf();
  const { spoilerShieldEnabled, setSpoilerShieldEnabled } = useHydratedAnnotations();
  const { getStreakStats } = useHydratedHabits();
  const { getPendingInviteCount } = useHydratedFellowship();
  const {
    readingProgress,
    fontFamily,
    setFontFamily,
    rawFontSize,
    isFontSizeCustomized,
    setFontSize,
    lineHeight,
    setLineHeight,
    brightness,
    setBrightness,
    readingMode,
    setReadingMode,
    columnWidth,
    setColumnWidth,
    setReaderTheme,
  } = useReaderStore(
    useShallow((s) => ({
      readingProgress: s.readingProgress,
      fontFamily: s.fontFamily,
      setFontFamily: s.setFontFamily,
      rawFontSize: s.fontSize,
      isFontSizeCustomized: s.isFontSizeCustomized,
      setFontSize: s.setFontSize,
      lineHeight: s.lineHeight,
      setLineHeight: s.setLineHeight,
      brightness: s.brightness,
      setBrightness: s.setBrightness,
      readingMode: s.readingMode,
      setReadingMode: s.setReadingMode,
      columnWidth: s.columnWidth,
      setColumnWidth: s.setColumnWidth,
      setReaderTheme: s.setTheme,
    }))
  );
  const fontSize = !isFontSizeCustomized ? getFactoryPreferences().fontSize : rawFontSize;
  const readingStreak = getStreakStats().currentStreak;
  const pendingInvitesCount = getPendingInviteCount(user?.id);

  const completedBooksCount = useMemo(
    () => calculateCompletedBooksCount(bookStatuses, readingProgress),
    [bookStatuses, readingProgress]
  );

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const {
    stickyScrollEnabled,
    setStickyScrollEnabled,
    speechRate,
    setSpeechRate,
    speechVoiceURI,
    setSpeechVoiceURI,
    speechAutoPageAdvance,
    setSpeechAutoPageAdvance,
    speechHighlightEnabled,
    setSpeechHighlightEnabled,
    exitBookmarkReminderEnabled,
    setExitBookmarkReminderEnabled,
    resetSpeechPreferences,
    customDefaults,
  } = usePreferencesStore(
    useShallow((s) => ({
      stickyScrollEnabled: s.stickyScrollEnabled,
      setStickyScrollEnabled: s.setStickyScrollEnabled,
      speechRate: s.speechRate,
      setSpeechRate: s.setSpeechRate,
      speechVoiceURI: s.speechVoiceURI,
      setSpeechVoiceURI: s.setSpeechVoiceURI,
      speechAutoPageAdvance: s.speechAutoPageAdvance,
      setSpeechAutoPageAdvance: s.setSpeechAutoPageAdvance,
      speechHighlightEnabled: s.speechHighlightEnabled,
      setSpeechHighlightEnabled: s.setSpeechHighlightEnabled,
      exitBookmarkReminderEnabled: s.exitBookmarkReminderEnabled,
      setExitBookmarkReminderEnabled: s.setExitBookmarkReminderEnabled,
      resetSpeechPreferences: s.resetSpeechPreferences,
      customDefaults: s.customDefaults,
    }))
  );
  const { isHeaderVisible } = useScrollDirection({ enabled: stickyScrollEnabled });

  const activePreferencesSnapshot = useMemo(
    () => ({
      theme,
      stickyScrollEnabled,
      fontFamily,
      fontSize,
      lineHeight,
      brightness,
      readingMode,
      columnWidth,
      spoilerShieldEnabled,
      speechRate,
      speechVoiceURI,
      speechAutoPageAdvance,
      speechHighlightEnabled,
      exitBookmarkReminderEnabled,
    }),
    [
      theme,
      stickyScrollEnabled,
      fontFamily,
      fontSize,
      lineHeight,
      brightness,
      readingMode,
      columnWidth,
      spoilerShieldEnabled,
      speechRate,
      speechVoiceURI,
      speechAutoPageAdvance,
      speechHighlightEnabled,
      exitBookmarkReminderEnabled,
    ]
  );

  const isAtFactoryDefaults = useMemo(
    () => arePreferencesEqual(activePreferencesSnapshot, getFactoryPreferences()),
    [activePreferencesSnapshot]
  );

  const isAtCustomDefaults = useMemo(
    () =>
      Boolean(customDefaults) &&
      arePreferencesEqual(activePreferencesSnapshot, customDefaults),
    [activePreferencesSnapshot, customDefaults]
  );

  // Segmented Sub-Tabs Navigation State
  const tabParam = searchParams.get('tab');
  const recoveryParam = searchParams.get('recovery') === 'true';
  const [hasClearedRecoveryParam, setHasClearedRecoveryParam] = useState(false);
  const [prevRecoveryParam, setPrevRecoveryParam] = useState(recoveryParam);
  if (recoveryParam !== prevRecoveryParam) {
    setPrevRecoveryParam(recoveryParam);
    setHasClearedRecoveryParam(false);
  }
  const isRecoveryMode = Boolean(isPasswordRecovery);
  const clearRecoveryParamInUrl = useCallback(() => {
    setHasClearedRecoveryParam(true);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('recovery')) {
        url.searchParams.delete('recovery');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, []);

  useEffect(() => {
    if (
      isLoading ||
      !authUser ||
      !recoveryParam ||
      hasClearedRecoveryParam ||
      isPasswordRecovery ||
      typeof verifyPasswordRecoverySession !== 'function'
    ) {
      return;
    }
    let cancelled = false;
    void verifyPasswordRecoverySession().then((verified) => {
      if (!cancelled && !verified) {
        clearRecoveryParamInUrl();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    isLoading,
    authUser,
    recoveryParam,
    hasClearedRecoveryParam,
    isPasswordRecovery,
    verifyPasswordRecoverySession,
    clearRecoveryParamInUrl,
  ]);
  const defaultTab: AccountTabId = isOffline
    ? 'preferences'
    : isRecoveryMode
      ? 'security'
      : 'profile';
  const validTab: AccountTabId =
    tabParam === 'profile' || tabParam === 'symposiums'
      ? 'profile'
      : tabParam === 'habits' || tabParam === 'preferences' || tabParam === 'security'
        ? tabParam
        : defaultTab;

  const [activeTab, setActiveTab] = useState<AccountTabId>(validTab);
  const [guestOfflineTab, setGuestOfflineTab] = useState<'preferences' | 'habits'>('preferences');
  const [accoladeCategory, setAccoladeCategory] = useState<AccoladeCategory>('all');
  const [isAccoladeFilterOpen, setIsAccoladeFilterOpen] = useState(false);
  const [prevTabParam, setPrevTabParam] = useState<string | null>(tabParam);
  const [prevIsOffline, setPrevIsOffline] = useState<boolean>(isOffline);
  const [prevIsRecoveryMode, setPrevIsRecoveryMode] = useState<boolean>(isRecoveryMode);

  if (
    tabParam !== prevTabParam ||
    isOffline !== prevIsOffline ||
    isRecoveryMode !== prevIsRecoveryMode
  ) {
    setPrevTabParam(tabParam);
    setPrevIsOffline(isOffline);
    setPrevIsRecoveryMode(isRecoveryMode);
    if (tabParam !== prevTabParam || !tabParam || isRecoveryMode) {
      setActiveTab(validTab);
    }
  }

  // Honor legacy ?tab=symposiums deep links by smoothly scrolling to Fellowships on profile tab
  useEffect(() => {
    if (tabParam !== 'symposiums' || !user) return;
    const raf = requestAnimationFrame(() => {
      smartScrollToContent('account-symposium-section', { offsetTop: 88, thresholdRatio: 0.25 });
    });
    return () => cancelAnimationFrame(raf);
  }, [tabParam, user]);

  const handleTabChange = (tabId: AccountTabId) => {
    setActiveTab(tabId);
    setIsAccoladeFilterOpen(false);
    if (typeof window !== 'undefined' && !document.querySelector('[data-scrubbing="true"]')) {
      const url = new URL(window.location.href);
      if (tabId === 'profile') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tabId);
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  const {
    isResendingVerification,
    resendSuccess,
    resendError,
    resendCooldown,
    handleResendVerification,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    copiedPassword,
    isUpdatingPassword,
    passwordSuccess,
    passwordError,
    strength,
    generateStrongPassword,
    handleUpdatePassword,
    isSendingResetEmail,
    resetEmailSent,
    resetEmailError,
    resetCooldown,
    handleRequestPasswordReset,
    hasGoogleIdentity,
    hasPasswordIdentity,
    canUnlinkGoogle,
    googleIdentityEmail,
    isLinkingGoogle,
    isUnlinkingGoogle,
    identitySuccess,
    identityError,
    handleLinkGoogle,
    handleUnlinkGoogle,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    closeDeleteModal,
    isSendingDeletionEmail,
    deletionEmailSent,
    deleteError,
    handleRequestDeletion,
    sessions,
    isLoadingSessions,
    hasLoadedSessions,
    isSessionsRpcUnavailable,
    sessionsError,
    sessionsSuccess,
    revokingSessionId,
    isSigningOutScope,
    isSignOutAllModalOpen,
    setIsSignOutAllModalOpen,
    refreshActiveSessions,
    handleRevokeSession,
    handleSignOutThisBrowser,
    handleSignOutOtherDevices,
    handleSignOutAllDevices,
  } = useAccountSecurityActions({
    user,
    isRecoveryMode,
    onClearRecoveryParam: clearRecoveryParamInUrl,
    clearPasswordRecovery,
    updatePassword,
    resetPasswordForEmail,
    requestAccountDeletion,
    resendVerificationEmail,
    linkOAuthIdentity,
    unlinkOAuthIdentity,
    activeTab,
    isOffline,
    isPreviewMode,
    signOut,
    signOutOtherDevices,
    listActiveSessions,
    revokeSession,
    onAfterSignOut: () => router.push(ROUTES.HOME),
  });

  const handleThemeChange = (newTheme: AppTheme) => {
    setTheme(newTheme);
    setReaderTheme(newTheme);
    schedulePreferencesCloudSync(0);
  };

  const preferencesSectionProps = {
    theme,
    onThemeChange: handleThemeChange,
    stickyScrollEnabled,
    onStickyScrollChange: (enabled: boolean) => {
      setStickyScrollEnabled(enabled);
      schedulePreferencesCloudSync();
    },
    fontFamily,
    onFontFamilyChange: (family: typeof fontFamily) => {
      setFontFamily(family);
      schedulePreferencesCloudSync();
    },
    fontSize,
    onFontSizeChange: (size: number) => {
      setFontSize(size);
      schedulePreferencesCloudSync();
    },
    lineHeight,
    onLineHeightChange: (height: number) => {
      setLineHeight(height);
      schedulePreferencesCloudSync();
    },
    brightness,
    onBrightnessChange: (val: number) => {
      setBrightness(val);
      schedulePreferencesCloudSync();
    },
    readingMode,
    onReadingModeChange: (mode: typeof readingMode) => {
      setReadingMode(mode);
      schedulePreferencesCloudSync();
    },
    columnWidth,
    onColumnWidthChange: (width: typeof columnWidth) => {
      setColumnWidth(width);
      schedulePreferencesCloudSync();
    },
    spoilerShieldEnabled,
    onSpoilerShieldChange: (enabled: boolean) => {
      setSpoilerShieldEnabled(enabled);
      schedulePreferencesCloudSync();
    },
    exitBookmarkReminderEnabled,
    onExitBookmarkReminderChange: (enabled: boolean) => {
      setExitBookmarkReminderEnabled(enabled);
      schedulePreferencesCloudSync();
    },
    speechRate,
    onSpeechRateChange: (rate: number) => {
      setSpeechRate(rate);
      schedulePreferencesCloudSync();
    },
    speechVoiceURI,
    onSpeechVoiceChange: (voice: string | null) => {
      setSpeechVoiceURI(voice);
      schedulePreferencesCloudSync();
    },
    speechAutoPageAdvance,
    onSpeechAutoPageAdvanceChange: (enabled: boolean) => {
      setSpeechAutoPageAdvance(enabled);
      schedulePreferencesCloudSync();
    },
    speechHighlightEnabled,
    onSpeechHighlightEnabledChange: (enabled: boolean) => {
      setSpeechHighlightEnabled(enabled);
      schedulePreferencesCloudSync();
    },
    onResetSpeechPreferences: () => {
      resetSpeechPreferences();
      schedulePreferencesCloudSync();
    },
    hasCustomDefaults: Boolean(customDefaults),
    isAtCustomDefaults,
    isAtFactoryDefaults,
    onSaveCustomDefaults: () => {
      saveCurrentAsCustomDefaults();
    },
    onRevertToCustomDefaults: () => {
      revertToCustomDefaults();
    },
    onResetToFactoryDefaults: () => {
      resetAllPreferencesToFactoryDefaults();
    },
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Member';

  const { handleTouchStart, handleTouchEnd, handleTouchCancel } = useMobileViewSwipe({
    activeView: 'account',
    onViewChange: (view) => {
      if (view === 'catalog') {
        router.push(`${ROUTES.HOME}?dir=forward`);
      } else if (view === 'bookmarks') {
        router.push(`${ROUTES.VIEW('bookmarks')}?dir=backward`);
      } else if (view !== 'account') {
        router.push(ROUTES.VIEW(view as NavViewId));
      }
    },
    onSwipeDirection: setSwipeDirection,
    enabled: !isDeleteModalOpen,
  });

  return (
    <div
      className="min-h-dvh flex flex-col justify-between bg-background text-foreground transition-colors duration-theme touch-pan-y overflow-x-clip"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <Navbar
        activeView="account"
        isVisible={isHeaderVisible}
        onViewChange={(view) => {
          router.push(ROUTES.VIEW(view));
        }}
      />

      <main
        className={`flex-1 w-full max-w-7xl mx-auto pt-8 pb-24 sm:pb-28 px-4 sm:px-6 lg:px-8 space-y-6 touch-pan-y overflow-x-clip ${
          isTransitioning
            ? swipeDirection === 'forward'
              ? 'animate-view-slide-left'
              : swipeDirection === 'backward'
                ? 'animate-view-slide-right'
                : ''
            : ''
        }`}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          setIsTransitioning(false);
          setSwipeDirection(null);
          if (typeof window !== 'undefined' && searchParams.has('dir')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('dir');
            window.history.replaceState(null, '', url.toString());
          }
        }}
      >
        {/* Offline Mode Banner */}
        {isOffline && (
          <div
            data-testid="account-offline-banner"
            role="status"
            className="flex items-start sm:items-center gap-3 px-4 py-3 rounded-xl border border-destructive/40 bg-destructive/10 text-xs font-mono text-foreground"
          >
            <WifiOff className="w-4 h-4 text-destructive shrink-0 mt-0.5 sm:mt-0" />
            <span>
              {user
                ? 'Offline Mode — Changes to your preferences, habits, and profile are saved locally and will sync automatically when you reconnect.'
                : 'Offline Mode — Manage your local reading preferences, streaks, and accolades offline. Sign in will be available once your connection is restored.'}
            </span>
          </div>
        )}

        {/* Guest View Prompt */}
        {!isLoading && !user && (
          <div className="space-y-6">
            {isOffline && (
              <div data-testid="guest-offline-workspace" className="space-y-5">
                <EditorialUnderlineTabs<'preferences' | 'habits'>
                  variant="recessed-capsule"
                  compactLayout="inline"
                  ariaLabel="Offline guest workspace sections"
                  trackClassName="max-w-md mx-auto"
                  capsuleTestId="guest-offline-tab-active-capsule"
                  activeTab={guestOfflineTab}
                  onSelectTab={setGuestOfflineTab}
                  tabs={[
                    {
                      id: 'preferences',
                      label: 'Preferences',
                      icon: (
                        <Sliders
                          className={`w-3.5 h-3.5 shrink-0 ${
                            guestOfflineTab === 'preferences'
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ),
                    },
                    {
                      id: 'habits',
                      label: 'Local Habits & Accolades',
                      mobileLabel: 'Local Habits',
                      icon: (
                        <Trophy
                          className={`w-3.5 h-3.5 shrink-0 ${
                            guestOfflineTab === 'habits'
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ),
                    },
                  ]}
                />

                {guestOfflineTab === 'preferences' ? (
                  <AccountPreferencesSection {...preferencesSectionProps} />
                ) : (
                  <div className="space-y-6">
                    <AccountHabitsCard completedBooksCount={completedBooksCount} />
                    <AccountAccoladesCard
                      activeCategory={accoladeCategory}
                      onCategoryChange={setAccoladeCategory}
                    />
                  </div>
                )}
              </div>
            )}

            <div
              data-testid="guest-signin-card"
              className="max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xs"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-border text-primary flex items-center justify-center mx-auto shadow-inner">
                <UserIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-serif font-bold">Guest Reader</h2>
                <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">
                  Sign in or create an account to customize your profile, sync bookshelves to the cloud, and save your reading preferences across devices.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  disabled={isOffline}
                  onClick={() => openAuthModal('sign_in')}
                  className="font-mono text-xs uppercase"
                >
                  Sign In / Sign Up
                </Button>
                <Link href={ROUTES.HOME}>
                  <Button variant="outline" size="md" className="font-mono text-xs uppercase">
                    Browse Catalog
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Authenticated View: Slim Scholar Identity Ribbon + 4-Tab Un-Nested Workspace */}
        {user && (
          <div className="space-y-5 sm:space-y-6">
            {/* Serene Read-Only Top Scholar Identity Card */}
            <AccountIdentityCard
              user={user}
              profile={profile}
              formattedDate={formattedDate}
              onResendVerification={handleResendVerification}
              isResendingVerification={isResendingVerification}
              resendSuccess={resendSuccess}
              resendError={resendError}
              resendCooldown={resendCooldown}
              readingStreak={readingStreak}
              onOpenLibraryBreakdown={() => {
                handleTabChange('habits');
              }}
              onSignOut={async () => {
                await signOut();
                router.push(ROUTES.HOME);
              }}
            />

            {/* Primary Zero-Shift Recessed Navigation Bar (4 Tabs with GPU Sliding Capsule) */}
            <div>
              <EditorialUnderlineTabs<AccountTabId>
                variant="recessed-capsule"
                ariaLabel="Account sections"
                useKeyboardNavigation
                capsuleTestId="account-tab-active-capsule"
                activeTab={activeTab}
                onSelectTab={handleTabChange}
                tabs={ACCOUNT_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return {
                    id: tab.id,
                    label: tab.label,
                    mobileLabel: tab.mobileLabel,
                    buttonId: `account-tab-${tab.id}`,
                    ariaControls: `account-tabpanel-${tab.id}`,
                    icon: (
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                    ),
                    ...(tab.id === 'profile'
                      ? {
                          count: pendingInvitesCount,
                          hideZeroCount: true,
                          countVariant: 'amber' as const,
                        }
                      : {}),
                  };
                })}
              />
            </div>

            {/* Tab Panel 1 (Default): Scholar Profile & Literary Fellowships */}
            <section
              id="account-tabpanel-profile"
              role="tabpanel"
              aria-labelledby="account-tab-profile"
              tabIndex={0}
              hidden={activeTab !== 'profile'}
              className={
                activeTab === 'profile'
                  ? 'space-y-6 animate-in fade-in duration-150'
                  : 'hidden'
              }
            >
              <AccountPublicProfileSection
                user={user}
                profile={profile}
                onUpdateProfile={updateProfile}
              />
              <AccountSymposiumSection userId={user.id} />
            </section>

            {/* Tab Panel 2: Habits & Accolades (Stacked Un-Tabbed Flow) */}
            <section
              id="account-tabpanel-habits"
              role="tabpanel"
              aria-labelledby="account-tab-habits"
              tabIndex={0}
              hidden={activeTab !== 'habits'}
              className={
                activeTab === 'habits'
                  ? 'space-y-6 animate-in fade-in duration-150'
                  : 'hidden'
              }
            >
              <AccountHabitsCard
                userId={user.id}
                completedBooksCount={completedBooksCount}
              />
              <AccountAccoladesCard
                userId={user.id}
                activeCategory={accoladeCategory}
                onCategoryChange={setAccoladeCategory}
                onOpenFilter={() => setIsAccoladeFilterOpen(true)}
              />
            </section>

            {/* Tab Panel 3: Reading & Read-Aloud Preferences */}
            <section
              id="account-tabpanel-preferences"
              role="tabpanel"
              aria-labelledby="account-tab-preferences"
              tabIndex={0}
              hidden={activeTab !== 'preferences'}
              className={
                activeTab === 'preferences'
                  ? 'space-y-6 animate-in fade-in duration-150'
                  : 'hidden'
              }
            >
              <AccountPreferencesSection {...preferencesSectionProps} />
            </section>

            {/* Tab Panel 4: Account & Security */}
            <section
              id="account-tabpanel-security"
              role="tabpanel"
              aria-labelledby="account-tab-security"
              tabIndex={0}
              hidden={activeTab !== 'security'}
              className={
                activeTab === 'security'
                  ? 'space-y-6 animate-in fade-in duration-150'
                  : 'hidden'
              }
            >
              <AccountSecuritySection
                currentPassword={currentPassword}
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                showPassword={showPassword}
                copiedPassword={copiedPassword}
                isUpdatingPassword={isUpdatingPassword}
                passwordSuccess={passwordSuccess}
                passwordError={passwordError}
                strength={strength}
                isRecoveryMode={isRecoveryMode}
                isSendingResetEmail={isSendingResetEmail}
                resetEmailSent={resetEmailSent}
                resetEmailError={resetEmailError}
                resetCooldown={resetCooldown}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onToggleShowPassword={() => setShowPassword(!showPassword)}
                onGeneratePassword={generateStrongPassword}
                onUpdatePassword={handleUpdatePassword}
                onRequestPasswordReset={handleRequestPasswordReset}
                onSignOut={handleSignOutThisBrowser}
                onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
                userEmail={user.email ?? ''}
                hasGoogleIdentity={hasGoogleIdentity}
                hasPasswordIdentity={hasPasswordIdentity}
                canUnlinkGoogle={canUnlinkGoogle}
                googleIdentityEmail={googleIdentityEmail}
                isLinkingGoogle={isLinkingGoogle}
                isUnlinkingGoogle={isUnlinkingGoogle}
                identitySuccess={identitySuccess}
                identityError={identityError}
                onLinkGoogle={handleLinkGoogle}
                onUnlinkGoogle={handleUnlinkGoogle}
                sessions={sessions}
                isLoadingSessions={isLoadingSessions}
                hasLoadedSessions={hasLoadedSessions}
                isSessionsRpcUnavailable={isSessionsRpcUnavailable}
                sessionsError={sessionsError}
                sessionsSuccess={sessionsSuccess}
                revokingSessionId={revokingSessionId}
                isSigningOutScope={isSigningOutScope}
                isSignOutAllModalOpen={isSignOutAllModalOpen}
                onOpenSignOutAllModal={() => setIsSignOutAllModalOpen(true)}
                onCloseSignOutAllModal={() => setIsSignOutAllModalOpen(false)}
                onRefreshSessions={refreshActiveSessions}
                onRevokeSession={handleRevokeSession}
                onSignOutOtherDevices={handleSignOutOtherDevices}
                onSignOutAllDevices={handleSignOutAllDevices}
              />
            </section>

            {/* Delete Account Confirmation Modal */}
            <AccountDeleteModal
              isOpen={isDeleteModalOpen}
              onClose={closeDeleteModal}
              userEmail={user.email ?? ''}
              isSendingDeletionEmail={isSendingDeletionEmail}
              deletionEmailSent={deletionEmailSent}
              deleteError={deleteError}
              onRequestDeletion={handleRequestDeletion}
            />
          </div>
        )}
      </main>

      <Footer />
      <AccountBottomDock
        mode={
          user
            ? activeTab
            : isOffline
              ? guestOfflineTab === 'preferences'
                ? 'guest-preferences'
                : 'guest-habits'
              : 'guest'
        }
        pendingInvitesCount={pendingInvitesCount}
        accoladeCategory={accoladeCategory}
        onAccoladeCategoryChange={setAccoladeCategory}
        isFilterOpen={isAccoladeFilterOpen}
        onFilterOpenChange={setIsAccoladeFilterOpen}
        theme={theme}
        onCycleTheme={() => {
          const nextTheme: AppTheme =
            theme === 'light' ? 'sepia' : theme === 'sepia' ? 'dark' : 'light';
          handleThemeChange(nextTheme);
        }}
        onSwitchGuestMode={setGuestOfflineTab}
        onRefreshSessions={() => {
          void refreshActiveSessions();
        }}
        isRefreshingSessions={isLoadingSessions}
        isOffline={isOffline}
      />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <AccountDashboardContent />
    </Suspense>
  );
}
