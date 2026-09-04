'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { BackToTop } from '@/components/ui/BackToTop';
import { AccountIdentityCard } from '@/components/account/AccountIdentityCard';
import { AccountLibraryStats } from '@/components/account/AccountLibraryStats';
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection';
import { AccountPreferencesSection } from '@/components/account/AccountPreferencesSection';
import { AccountDeleteModal } from '@/components/account/AccountDeleteModal';
import { generateStrongPassword as generatePasswordUtil, evaluatePasswordStrength } from '@/lib/password';
import { ROUTES } from '@/config/routes';

export default function AccountPage() {
  const router = useRouter();
  const {
    user,
    profile,
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
  const { savedCount, likedCount, cloudBookshelves } = useHydratedBookshelf();
  const { annotations } = useHydratedAnnotations();
  const annotationCount = annotations.length;
  const readingPositions = useReaderStore((s) => s.readingPositions);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const bookmarksCount = useMemo(() => {
    const activeIds = new Set<number>();
    Object.keys(readingPositions || {}).forEach((id) => {
      const num = Number(id);
      if (!Number.isNaN(num)) activeIds.add(num);
    });
    Object.entries(readingProgress || {}).forEach(([id, progress]) => {
      const num = Number(id);
      if (!Number.isNaN(num) && progress > 0) activeIds.add(num);
    });
    return activeIds.size;
  }, [readingPositions, readingProgress]);
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
  React.useEffect(() => {
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

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-theme">
      <Navbar
        activeView="account"
        isVisible={isHeaderVisible}
        onViewChange={(view) => {
          router.push(ROUTES.VIEW(view));
        }}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
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

        {/* Authenticated View: 2-Column Responsive Dashboard */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (Reader Dossier & Library Stats) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              {/* Account Hero Card */}
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

              {/* Library Statistics Card */}
              <AccountLibraryStats
                savedCount={savedCount}
                likedCount={likedCount}
                customShelvesCount={customShelvesCount}
                annotationCount={annotationCount}
                bookmarksCount={bookmarksCount}
              />
            </div>

            {/* Right Column (Reading Preferences & Security) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Reading & Navigation Preferences Card */}
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

              {/* Security & Password Card */}
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
              />
            </div>

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

