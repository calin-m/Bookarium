'use client';

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';
import {
  generateStrongPassword as generatePasswordUtil,
  evaluatePasswordStrength,
} from '@/lib/password';

export interface UseAccountSecurityActionsParams {
  user: User | null;
  profile: Profile | null;
  isRecoveryMode: boolean;
  onClearRecoveryParam: () => void;
  clearPasswordRecovery?: () => void;
  updateProfile: (updates: { display_name?: string }) => Promise<{ error: Error | null }>;
  updatePassword: (
    newPassword: string,
    currentPassword?: string
  ) => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  requestAccountDeletion: () => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
}

export function useAccountSecurityActions({
  user,
  profile,
  isRecoveryMode,
  onClearRecoveryParam,
  clearPasswordRecovery,
  updateProfile,
  updatePassword,
  resetPasswordForEmail,
  requestAccountDeletion,
  resendVerificationEmail,
}: UseAccountSecurityActionsParams) {
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
        onClearRecoveryParam();
        clearPasswordRecovery?.();
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

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletionEmailSent(false);
    setDeleteError(null);
  };

  return {
    displayName,
    setCustomName,
    isSaving,
    saveSuccess,
    saveError,
    handleSaveProfile,
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
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    closeDeleteModal,
    isSendingDeletionEmail,
    deletionEmailSent,
    deleteError,
    handleRequestDeletion,
  };
}
