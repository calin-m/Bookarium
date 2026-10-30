'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User as UserIcon,
  Sparkles,
  ArrowLeft,
  Trophy,
  Globe,
  Users,
  Sliders,
  ShieldCheck,
  Flame,
  Award,
  WifiOff,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useReaderStore, getActiveReadingCount } from '@/stores/useReaderStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useHydratedHabits } from '@/stores/useHabitsStore';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { BackToTop } from '@/components/ui/BackToTop';
import { AccountIdentityCard } from '@/components/account/AccountIdentityCard';
import { AccountHabitsCard } from '@/components/account/AccountHabitsCard';
import { AccountAccoladesCard } from '@/components/account/AccountAccoladesCard';
import { AccountPublicProfileSection } from '@/components/account/AccountPublicProfileSection';
import { AccountSymposiumSection } from '@/components/account/AccountSymposiumSection';
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection';
import { AccountPreferencesSection } from '@/components/account/AccountPreferencesSection';
import { AccountDeleteModal } from '@/components/account/AccountDeleteModal';
import {
  generateStrongPassword as generatePasswordUtil,
  evaluatePasswordStrength,
} from '@/lib/password';
import { calculateCompletedBooksCount } from '@/lib/reading-analytics';
import { useMobileViewSwipe } from '@/hooks/useMobileViewSwipe';
import type { NavViewId } from '@/config/views.config';
import { ROUTES } from '@/config/routes';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

type AccountTabId = 'habits' | 'profile' | 'symposiums' | 'preferences' | 'security';
type HabitsSubTabId = 'streaks' | 'accolades';

interface AccountTabConfig {
  id: AccountTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const ACCOUNT_TABS: readonly AccountTabConfig[] = [
  {
    id: 'habits',
    label: 'Habits & Accolades',
    icon: Trophy,
    description: 'Reading streaks, immersion metrics & bookplates',
  },
  {
    id: 'profile',
    label: 'Public Scholar',
    icon: Globe,
    description: 'Public bio, sanctuary showcase & privacy',
  },
  {
    id: 'symposiums',
    label: 'Symposiums & Circle',
    icon: Users,
    description: 'Fellow Scholars, Reader Circle & shared volume pacts',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Sliders,
    description: 'Atmosphere themes, sticky scroll & speech narration',
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheck,
    description: 'Password, session & danger zone',
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
    requestAccountDeletion,
    signOut,
    openAuthModal,
    resendVerificationEmail,
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
      requestAccountDeletion: s.requestAccountDeletion,
      signOut: s.signOut,
      openAuthModal: s.openAuthModal,
      resendVerificationEmail: s.resendVerificationEmail,
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

  const user =
    authUser ||
    (isPreviewMode
      ? ({
          id: 'preview-scholar',
          email: 'scholar@bookarium.test',
          user_metadata: { display_name: 'Scholar Reader' },
          created_at: '2024-01-01T00:00:00Z',
        } as unknown as User)
      : null);

  const profile =
    authProfile ||
    (isPreviewMode
      ? ({
          id: 'preview-scholar',
          display_name: 'Scholar Reader',
          created_at: '2024-01-01T00:00:00Z',
        } as unknown as Profile)
      : null);
  const { savedCount, favoriteCount, cloudBookshelves, bookStatuses } =
    useHydratedBookshelf();
  const { annotations } = useHydratedAnnotations();
  const { getStreakStats } = useHydratedHabits();
  const { getPendingInviteCount } = useHydratedFellowship();
  const annotationCount = annotations.length;
  const bookmarksCount = useReaderStore(getActiveReadingCount);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const readingStreak = getStreakStats().currentStreak;
  const pendingInvitesCount = getPendingInviteCount(user?.id);

  const completedBooksCount = useMemo(
    () => calculateCompletedBooksCount(bookStatuses, readingProgress),
    [bookStatuses, readingProgress]
  );

  const customShelvesCount = useMemo(
    () => cloudBookshelves.filter((s) => !s.is_default).length,
    [cloudBookshelves]
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
    resetSpeechPreferences,
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
      resetSpeechPreferences: s.resetSpeechPreferences,
    }))
  );
  const { isHeaderVisible } = useScrollDirection({ enabled: stickyScrollEnabled });

  // Segmented Sub-Tabs Navigation State
  const tabParam = searchParams.get('tab');
  const recoveryParam = searchParams.get('recovery') === 'true';
  const [hasClearedRecoveryParam, setHasClearedRecoveryParam] = useState(false);
  const [prevRecoveryParam, setPrevRecoveryParam] = useState(recoveryParam);
  if (recoveryParam !== prevRecoveryParam) {
    setPrevRecoveryParam(recoveryParam);
    setHasClearedRecoveryParam(false);
  }
  const isRecoveryMode =
    (recoveryParam && !hasClearedRecoveryParam) || Boolean(isPasswordRecovery);
  const defaultTab: AccountTabId = isOffline
    ? 'preferences'
    : isRecoveryMode
      ? 'security'
      : 'habits';
  const validTab: AccountTabId =
    tabParam === 'habits' ||
    tabParam === 'profile' ||
    tabParam === 'symposiums' ||
    tabParam === 'preferences' ||
    tabParam === 'security'
      ? tabParam
      : defaultTab;

  const [activeTab, setActiveTab] = useState<AccountTabId>(validTab);
  const [habitsSubTab, setHabitsSubTab] = useState<HabitsSubTabId>('streaks');
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

  const handleTabChange = (tabId: AccountTabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tabId === 'habits') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tabId);
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentIndex = ACCOUNT_TABS.findIndex((t) => t.id === activeTab);
      const nextIndex =
        e.key === 'ArrowRight'
          ? (currentIndex + 1) % ACCOUNT_TABS.length
          : (currentIndex - 1 + ACCOUNT_TABS.length) % ACCOUNT_TABS.length;
      const nextTab = ACCOUNT_TABS[nextIndex];
      handleTabChange(nextTab.id);
      const nextBtn = document.getElementById(`account-tab-${nextTab.id}`);
      nextBtn?.focus();
    }
  };

  const defaultName =
    profile?.display_name || user?.user_metadata?.display_name || '';
  const [customName, setCustomName] = useState<string | null>(null);
  const displayName = customName !== null ? customName : defaultName;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Email verification state
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Verification cooldown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!user?.email || isResendingVerification || resendCooldown > 0) return;
    setIsResendingVerification(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const { error } = await resendVerificationEmail(user.email);
      if (error) {
        setResendError(error.message);
      } else {
        setResendSuccess(true);
        setResendCooldown(60);
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch {
      setResendError('Failed to resend verification email. Please try again later.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  // Security & Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [resetCooldown, setResetCooldown] = useState(0);

  // Password reset cooldown effect
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setInterval(() => {
      setResetCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetCooldown]);

  const handleRequestPasswordReset = async () => {
    if (!user?.email || isSendingResetEmail || resetCooldown > 0) return;
    setIsSendingResetEmail(true);
    setResetEmailError(null);
    setResetEmailSent(false);

    try {
      const { error } = await resetPasswordForEmail(user.email);
      if (error) {
        setResetEmailError(error.message);
      } else {
        setResetEmailSent(true);
        setResetCooldown(60);
      }
    } catch {
      setResetEmailError('Failed to send password reset link. Please try again later.');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // Danger Zone / Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSendingDeletionEmail, setIsSendingDeletionEmail] = useState(false);
  const [deletionEmailSent, setDeletionEmailSent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { error } = await updateProfile({
        display_name: displayName.trim(),
      });

      if (error) {
        setSaveError(error.message);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError('An unexpected error occurred while saving your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateStrongPassword = () => {
    const generated = generatePasswordUtil();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setPasswordError(null);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generated);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    }
  };

  const strength = evaluatePasswordStrength(newPassword);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (!isRecoveryMode && !currentPassword) {
      setPasswordError(
        'Please enter your current password, or send a reset link to your email.'
      );
      return;
    }

    if (!isRecoveryMode && newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const { error } = isRecoveryMode
        ? await updatePassword(newPassword)
        : await updatePassword(newPassword, currentPassword);

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setHasClearedRecoveryParam(true);
        clearPasswordRecovery?.();
        if (typeof window !== 'undefined' && searchParams.has('recovery')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('recovery');
          window.history.replaceState(null, '', url.toString());
        }
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch {
      setPasswordError('An unexpected error occurred while updating your password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) return;

    setIsSendingDeletionEmail(true);
    setDeleteError(null);

    try {
      const { error } = await requestAccountDeletion();

      if (error) {
        setDeleteError(error.message);
      } else {
        setDeletionEmailSent(true);
      }
    } catch {
      setDeleteError('An unexpected error occurred while requesting account deletion.');
    } finally {
      setIsSendingDeletionEmail(false);
    }
  };

  const handleThemeChange = (newTheme: AppTheme) => {
    setTheme(newTheme);
    if (user) {
      updateProfile({ preferred_theme: newTheme }).catch(() => {});
    }
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
        className={`flex-1 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 touch-pan-y overflow-x-clip ${
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
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={ROUTES.HOME}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Library</span>
          </Link>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-border">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bookarium Account</span>
          </div>
        </div>

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
              <div data-testid="guest-offline-workspace" className="space-y-6">
                <AccountPreferencesSection
                  theme={theme}
                  onThemeChange={handleThemeChange}
                  stickyScrollEnabled={stickyScrollEnabled}
                  onStickyScrollChange={setStickyScrollEnabled}
                  speechRate={speechRate}
                  onSpeechRateChange={setSpeechRate}
                  speechVoiceURI={speechVoiceURI}
                  onSpeechVoiceChange={setSpeechVoiceURI}
                  speechAutoPageAdvance={speechAutoPageAdvance}
                  onSpeechAutoPageAdvanceChange={setSpeechAutoPageAdvance}
                  speechHighlightEnabled={speechHighlightEnabled}
                  onSpeechHighlightEnabledChange={setSpeechHighlightEnabled}
                  onResetSpeechPreferences={resetSpeechPreferences}
                />
                <AccountHabitsCard completedBooksCount={completedBooksCount} />
                <AccountAccoladesCard />
              </div>
            )}

            <div
              data-testid="guest-signin-card"
              className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-booksaw"
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

        {/* Authenticated View: Slim Scholar Identity Ribbon + Two-Tier Sub-Tab Workspace */}
        {user && (
          <div className="space-y-6">
            {/* Slim Scholar Identity Ribbon (Compact Top Fold) */}
            <AccountIdentityCard
              user={user}
              profile={profile}
              formattedDate={formattedDate}
              displayName={displayName}
              onDisplayNameChange={setCustomName}
              onSaveProfile={handleSaveProfile}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              saveError={saveError}
              onResendVerification={handleResendVerification}
              isResendingVerification={isResendingVerification}
              resendSuccess={resendSuccess}
              resendError={resendError}
              resendCooldown={resendCooldown}
              stats={{
                savedCount,
                favoriteCount,
                annotationCount,
                customShelvesCount,
                bookmarksCount,
                readingStreak,
              }}
              onOpenLibraryBreakdown={() => {
                handleTabChange('habits');
                setHabitsSubTab('streaks');
              }}
            />

            {/* Tier 1: Primary Segmented Navigation Bar (5 Tabs) */}
            <div>
              <div
                role="tablist"
                aria-label="Account sections"
                onKeyDown={handleTabKeyDown}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 p-1.5 bg-card border border-border rounded-2xl shadow-booksaw w-full"
              >
                {ACCOUNT_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  const showBadge = tab.id === 'symposiums' && pendingInvitesCount > 0;
                  return (
                    <button
                      key={tab.id}
                      id={`account-tab-${tab.id}`}
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      aria-controls={`account-tabpanel-${tab.id}`}
                      aria-label={tab.label}
                      title={tab.label}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative flex items-center justify-center gap-1.5 lg:gap-2 py-2.5 rounded-xl text-xs sm:text-xs lg:text-sm font-semibold whitespace-nowrap border transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'flex-1 min-w-0 px-3 sm:px-3 lg:px-4 bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'shrink-0 px-2.5 sm:flex-1 sm:min-w-0 sm:px-2.5 lg:px-4 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                        }`}
                      />
                      <span
                        className={`truncate min-w-0 ${
                          isActive ? 'inline' : 'hidden sm:inline'
                        }`}
                      >
                        {tab.label}
                      </span>
                      {showBadge && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                            isActive
                              ? 'bg-primary-foreground text-primary'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {pendingInvitesCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Panel 1: Habits & Accolades (With Unified 2-Pill Sub-Tabs) */}
            <section
              id="account-tabpanel-habits"
              role="tabpanel"
              aria-labelledby="account-tab-habits"
              tabIndex={0}
              hidden={activeTab !== 'habits'}
              className={
                activeTab === 'habits'
                  ? 'space-y-4 animate-in fade-in duration-150'
                  : 'hidden'
              }
            >
              {/* Tier 2 Sub-Tab Bar for Streaks & Accolades */}
              <div className="flex items-center justify-center border-b border-border">
                <nav
                  role="tablist"
                  data-no-swipe
                  aria-label="Habits and library sub-sections"
                  className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px [scrollbar-width:none]"
                >
                  {(
                    [
                      { id: 'streaks', label: 'Streaks & Challenge', Icon: Flame, iconClass: 'text-amber-500' },
                      { id: 'accolades', label: 'Accolades Compendium', Icon: Award, iconClass: 'text-primary' },
                    ] as const
                  ).map((sub) => {
                    const isSubActive = habitsSubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        role="tab"
                        aria-selected={isSubActive}
                        aria-label={sub.label}
                        title={sub.label}
                        onClick={() => setHabitsSubTab(sub.id)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-mono uppercase tracking-wider font-bold border-b-2 transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                          isSubActive
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                        }`}
                      >
                        <sub.Icon className={`w-3.5 h-3.5 ${sub.iconClass} shrink-0`} />
                        <span className={isSubActive ? 'inline' : 'hidden md:inline'}>{sub.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div
                id="habits-subpanel-streaks"
                hidden={habitsSubTab !== 'streaks'}
                className={habitsSubTab === 'streaks' ? 'block' : 'hidden'}
              >
                <AccountHabitsCard
                  userId={user.id}
                  completedBooksCount={completedBooksCount}
                />
              </div>

              <div
                id="habits-subpanel-accolades"
                hidden={habitsSubTab !== 'accolades'}
                className={habitsSubTab === 'accolades' ? 'block' : 'hidden'}
              >
                <AccountAccoladesCard userId={user.id} />
              </div>
            </section>

            {/* Tab Panel 2: Public Scholar Profile */}
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
            </section>

            {/* Tab Panel 3: Literary Symposiums & Reader Circle */}
            <section
              id="account-tabpanel-symposiums"
              role="tabpanel"
              aria-labelledby="account-tab-symposiums"
              tabIndex={0}
              hidden={activeTab !== 'symposiums'}
              className={
                activeTab === 'symposiums'
                  ? 'space-y-6 animate-in fade-in duration-150'
                  : 'hidden'
              }
            >
              <AccountSymposiumSection userId={user.id} />
            </section>

            {/* Tab Panel 4: Reading Preferences */}
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
              <AccountPreferencesSection
                theme={theme}
                onThemeChange={handleThemeChange}
                stickyScrollEnabled={stickyScrollEnabled}
                onStickyScrollChange={setStickyScrollEnabled}
                speechRate={speechRate}
                onSpeechRateChange={setSpeechRate}
                speechVoiceURI={speechVoiceURI}
                onSpeechVoiceChange={setSpeechVoiceURI}
                speechAutoPageAdvance={speechAutoPageAdvance}
                onSpeechAutoPageAdvanceChange={setSpeechAutoPageAdvance}
                speechHighlightEnabled={speechHighlightEnabled}
                onSpeechHighlightEnabledChange={setSpeechHighlightEnabled}
                onResetSpeechPreferences={resetSpeechPreferences}
              />
            </section>

            {/* Tab Panel 5: Account & Security */}
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
                onSignOut={async () => {
                  await signOut();
                  router.push(ROUTES.HOME);
                }}
                onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
                userEmail={user.email ?? ''}
              />
            </section>

            {/* Delete Account Confirmation Modal */}
            <AccountDeleteModal
              isOpen={isDeleteModalOpen}
              onClose={() => {
                setIsDeleteModalOpen(false);
                setDeletionEmailSent(false);
                setDeleteError(null);
              }}
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
      <BackToTop />
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
