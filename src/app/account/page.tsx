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
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useReaderStore, getActiveReadingCount } from '@/stores/useReaderStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useHydratedHabits } from '@/stores/useHabitsStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { BackToTop } from '@/components/ui/BackToTop';
import { AccountIdentityCard } from '@/components/account/AccountIdentityCard';
import { AccountLibraryStats } from '@/components/account/AccountLibraryStats';
import { AccountHabitsCard } from '@/components/account/AccountHabitsCard';
import { AccountAccoladesCard } from '@/components/account/AccountAccoladesCard';
import { AccountPublicProfileSection } from '@/components/account/AccountPublicProfileSection';
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection';
import { AccountPreferencesSection } from '@/components/account/AccountPreferencesSection';
import { AccountDeleteModal } from '@/components/account/AccountDeleteModal';
import { generateStrongPassword as generatePasswordUtil, evaluatePasswordStrength } from '@/lib/password';
import { useMobileViewSwipe } from '@/hooks/useMobileViewSwipe';
import type { NavViewId } from '@/config/views.config';
import { ROUTES } from '@/config/routes';

type AccountTabId = 'habits' | 'profile' | 'preferences' | 'security';

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
    id: 'preferences',
    label: 'Preferences',
    icon: Sliders,
    description: 'Atmosphere themes, speech narration & backups',
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
  const {
    user: authUser,
    profile: authProfile,
    isLoading,
    updateProfile,
    updatePassword,
    requestAccountDeletion,
    signOut,
    openAuthModal,
    resendVerificationEmail,
  } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      isLoading: s.isLoading,
      updateProfile: s.updateProfile,
      updatePassword: s.updatePassword,
      requestAccountDeletion: s.requestAccountDeletion,
      signOut: s.signOut,
      openAuthModal: s.openAuthModal,
      resendVerificationEmail: s.resendVerificationEmail,
    }))
  );

  const searchParams = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === 'true';

  const user =
    authUser ||
    (isPreviewMode
      ? ({
          id: 'preview-scholar',
          email: 'scholar@bookarium.test',
          user_metadata: { display_name: 'Scholar Reader' },
          created_at: '2024-01-01T00:00:00Z',
        } as any)
      : null);

  const profile =
    authProfile ||
    (isPreviewMode
      ? ({
          id: 'preview-scholar',
          display_name: 'Scholar Reader',
          created_at: '2024-01-01T00:00:00Z',
        } as any)
      : null);
  const { savedCount, favoriteCount, cloudBookshelves, bookStatuses } = useHydratedBookshelf();
  const { annotations } = useHydratedAnnotations();
  const { getStreakStats } = useHydratedHabits();
  const annotationCount = annotations.length;
  const bookmarksCount = useReaderStore(getActiveReadingCount);
  const readingStreak = getStreakStats().currentStreak;

  const completedBooksCount = useMemo(() => {
    const finishedFromStatus = Object.entries(bookStatuses || {})
      .filter(([_, status]) => status === 'finished')
      .map(([id]) => Number(id));
    const finishedFromProgress = Object.entries(useReaderStore.getState().readingProgress || {})
      .filter(([_, p]) => p >= 100)
      .map(([id]) => Number(id));
    return new Set([...finishedFromStatus, ...finishedFromProgress]).size;
  }, [bookStatuses]);

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
  const validTab: AccountTabId =
    tabParam === 'profile' || tabParam === 'preferences' || tabParam === 'security'
      ? tabParam
      : 'habits';

  const [activeTab, setActiveTab] = useState<AccountTabId>(validTab);
  const [prevTabParam, setPrevTabParam] = useState<string | null>(tabParam);

  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    setActiveTab(validTab);
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

  const defaultName = profile?.display_name || user?.user_metadata?.display_name || '';
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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

    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
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

  const { handleTouchStart, handleTouchEnd } = useMobileViewSwipe({
    activeView: 'account',
    onViewChange: (view) => {
      if (view === 'bookmarks') {
        router.push(ROUTES.VIEW('bookmarks'));
      } else if (view !== 'account') {
        router.push(ROUTES.VIEW(view as NavViewId));
      }
    },
    enabled: !isDeleteModalOpen,
  });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-theme">
      <Navbar
        activeView="account"
        isVisible={isHeaderVisible}
        onViewChange={(view) => {
          router.push(ROUTES.VIEW(view));
        }}
      />

      <main
        className="flex-1 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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

        {/* Guest View Prompt */}
        {!isLoading && !user && (
          <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-booksaw">
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
        )}

        {/* Authenticated View: Executive Modular Dashboard */}
        {user && (
          <div className="space-y-8">
            {/* Tier 1: Reader Identity & Library Statistics (Side-by-Side on Desktop/Laptop) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-7 h-full">
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
                />
              </div>

              <div className="lg:col-span-5 h-full">
                <AccountLibraryStats
                  savedCount={savedCount}
                  favoriteCount={favoriteCount}
                  customShelvesCount={customShelvesCount}
                  annotationCount={annotationCount}
                  bookmarksCount={bookmarksCount}
                  readingStreak={readingStreak}
                />
              </div>
            </div>

            {/* Segmented Sub-Tabs Navigation Strip */}
            <div className="pt-2">
              <div
                role="tablist"
                aria-label="Account sections"
                onKeyDown={handleTabKeyDown}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-card border border-border rounded-2xl shadow-booksaw w-full"
              >
                {ACCOUNT_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
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
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'flex-1 min-w-0 px-3 sm:px-4 bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'shrink-0 px-2.5 sm:flex-1 sm:px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                      <span className={`truncate min-w-0 ${isActive ? 'inline' : 'hidden sm:inline'}`}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Panel 1: Habits & Accolades */}
            <section
              id="account-tabpanel-habits"
              role="tabpanel"
              aria-labelledby="account-tab-habits"
              tabIndex={0}
              className={activeTab === 'habits' ? 'space-y-8 animate-in fade-in duration-150' : 'hidden'}
            >
              {/* Tier 2: Literary Immersion & Reading Habits Card (Full Width) */}
              <AccountHabitsCard
                userId={user?.id}
                completedBooksCount={completedBooksCount}
              />

              {/* Tier 3: Ex-Libris Bookplates & Accolades Compendium (Full Width) */}
              <AccountAccoladesCard userId={user?.id} />
            </section>

            {/* Tab Panel 2: Public Scholar Profile */}
            <section
              id="account-tabpanel-profile"
              role="tabpanel"
              aria-labelledby="account-tab-profile"
              tabIndex={0}
              className={activeTab === 'profile' ? 'space-y-8 animate-in fade-in duration-150' : 'hidden'}
            >
              <AccountPublicProfileSection
                user={user}
                profile={profile}
                onUpdateProfile={updateProfile}
              />
            </section>

            {/* Tab Panel 3: Reading Preferences */}
            <section
              id="account-tabpanel-preferences"
              role="tabpanel"
              aria-labelledby="account-tab-preferences"
              tabIndex={0}
              className={activeTab === 'preferences' ? 'space-y-8 animate-in fade-in duration-150' : 'hidden'}
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
                userId={user?.id}
              />
            </section>

            {/* Tab Panel 4: Account & Security */}
            <section
              id="account-tabpanel-security"
              role="tabpanel"
              aria-labelledby="account-tab-security"
              tabIndex={0}
              className={activeTab === 'security' ? 'space-y-8 animate-in fade-in duration-150' : 'hidden'}
            >
              <AccountSecuritySection
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                showPassword={showPassword}
                copiedPassword={copiedPassword}
                isUpdatingPassword={isUpdatingPassword}
                passwordSuccess={passwordSuccess}
                passwordError={passwordError}
                strength={strength}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onToggleShowPassword={() => setShowPassword(!showPassword)}
                onGeneratePassword={generateStrongPassword}
                onUpdatePassword={handleUpdatePassword}
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
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AccountDashboardContent />
    </Suspense>
  );
}

