'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useThemeStore, type AppTheme } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { BackToTop } from '@/components/ui/BackToTop';
import { ProfileIdentityCard } from '@/components/profile/ProfileIdentityCard';
import { ProfileLibraryStats } from '@/components/profile/ProfileLibraryStats';
import { ProfileSecuritySection } from '@/components/profile/ProfileSecuritySection';
import { ProfilePreferencesSection } from '@/components/profile/ProfilePreferencesSection';
import { ProfileDeleteModal } from '@/components/profile/ProfileDeleteModal';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, isLoading, updateProfile, updatePassword, requestAccountDeletion, signOut, openAuthModal } = useAuthStore();
  const { savedCount, likedCount, cloudBookshelves } = useHydratedBookshelf();
  const customShelvesCount = useMemo(
    () => cloudBookshelves.filter((s) => !s.is_default).length,
    [cloudBookshelves]
  );
  const { theme, setTheme } = useThemeStore();
  const { stickyScrollEnabled, setStickyScrollEnabled } = usePreferencesStore();

  const defaultName = profile?.display_name || user?.user_metadata?.display_name || '';
  const [customName, setCustomName] = useState<string | null>(null);
  const displayName = customName !== null ? customName : defaultName;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let generated = '';
    const array = new Uint32Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
      for (let i = 0; i < 16; i++) {
        generated += chars[array[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 16; i++) {
        generated += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    setNewPassword(generated);
    setConfirmPassword(generated);
    setPasswordError(null);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generated);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    }
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-destructive' };
    if (score === 2) return { score: 2, label: 'Moderate', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

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
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200">
      <Navbar
        onViewChange={(view) => {
          if (view === 'catalog') {
            router.push('/');
          } else {
            router.push(`/?view=${view}`);
          }
        }}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Library</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-border">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bookarium Account</span>
          </div>
        </div>

        {/* Guest View Prompt */}
        {!isLoading && !user && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-border text-primary flex items-center justify-center mx-auto">
              <UserIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold">Guest Reader</h2>
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
              <Link href="/">
                <Button variant="outline" size="md" className="font-mono text-xs uppercase">
                  Browse Catalog
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Authenticated View */}
        {user && (
          <div className="space-y-6">
            {/* Account Hero Card */}
            <ProfileIdentityCard
              user={user}
              profile={profile}
              formattedDate={formattedDate}
              displayName={displayName}
              onDisplayNameChange={setCustomName}
              onSaveProfile={handleSaveProfile}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              saveError={saveError}
            />

            {/* Reading & Navigation Preferences Card */}
            <ProfilePreferencesSection
              theme={theme}
              onThemeChange={handleThemeChange}
              stickyScrollEnabled={stickyScrollEnabled}
              onStickyScrollChange={setStickyScrollEnabled}
            />

            {/* Security & Password Card */}
            <ProfileSecuritySection
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
                router.push('/');
              }}
              onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
            />

            {/* Library Statistics Card */}
            <ProfileLibraryStats
              savedCount={savedCount}
              likedCount={likedCount}
              customShelvesCount={customShelvesCount}
            />

            {/* Delete Account Confirmation Modal */}
            <ProfileDeleteModal
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