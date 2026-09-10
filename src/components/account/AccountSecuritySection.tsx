'use client';

import React from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  KeyRound,
  LogOut,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import type { PasswordStrength } from '@/lib/password';

export interface AccountSecuritySectionProps {
  newPassword: string;
  confirmPassword: string;
  showPassword: boolean;
  copiedPassword: boolean;
  isUpdatingPassword: boolean;
  passwordSuccess: boolean;
  passwordError: string | null;
  strength: { score: number; label: string; color: string };
  onNewPasswordChange: (val: string) => void;
  onConfirmPasswordChange: (val: string) => void;
  onToggleShowPassword: () => void;
  onGeneratePassword: () => void;
  onUpdatePassword: (e: React.FormEvent) => void;
  onSignOut: () => Promise<void>;
  onOpenDeleteModal: () => void;
  userEmail?: string;
}

export const AccountSecuritySection: React.FC<AccountSecuritySectionProps> = ({
  newPassword,
  confirmPassword,
  showPassword,
  copiedPassword,
  isUpdatingPassword,
  passwordSuccess,
  passwordError,
  strength,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onGeneratePassword,
  onUpdatePassword,
  onSignOut,
  onOpenDeleteModal,
  userEmail,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-6">
      {/* Master Card Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-border shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
            Security & Password
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Update your account password credentials, manage active browser sessions, and review account actions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Password Form */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Update Account Password
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              Minimum 6 characters
            </span>
          </div>

          <form onSubmit={onUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between min-h-[1.5rem]">
                  <label htmlFor="new-password" className="text-xs font-mono text-foreground font-bold">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={onGeneratePassword}
                    className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Suggest Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                    placeholder="At least 6 characters"
                    className="text-xs font-mono pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={onToggleShowPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded p-0.5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between min-h-[1.5rem]">
                  <label htmlFor="confirm-password" className="text-xs font-mono text-foreground font-bold">
                    Confirm New Password
                  </label>
                </div>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  placeholder="Repeat new password"
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Password Generator Feedback Pill */}
            {copiedPassword && (
              <div className="p-2.5 rounded-lg bg-primary/10 border border-border flex items-center gap-2 text-xs font-mono text-primary animate-in fade-in duration-150">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Generated high-entropy password auto-filled and copied to clipboard!</span>
              </div>
            )}

            {/* Live Password Strength Meter */}
            {newPassword.length > 0 && (
              <div className="pt-1">
                <PasswordStrengthMeter strength={strength as PasswordStrength} />
              </div>
            )}

            {passwordError && (
              <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="chip"
                isLoading={isUpdatingPassword}
                disabled={!newPassword || !confirmPassword}
                aria-label="Update Password"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Update Password</span>
              </Button>
              {passwordSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-success animate-in fade-in duration-150">
                  <Check className="w-3.5 h-3.5" />
                  <span>Password successfully updated</span>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Right Column (5 cols): Active Device Session & Quarantined Danger Zone */}
        <div className="lg:col-span-5 space-y-6 lg:border-l lg:border-border lg:pl-8">
          {/* Section 2: Active Device Session */}
          <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                Active Device Session
              </p>
              {userEmail && (
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[170px]" title={userEmail}>
                  {userEmail}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Sign out from this browser. Your local bookshelf and bookmarks will remain safely stored.
            </p>
            <div className="pt-1">
              <Button
                variant="outline"
                size="chip"
                onClick={onSignOut}
                className="w-full justify-center text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>

          {/* Section 3: Danger Zone (Framed Inset Callout) */}
          <div className="rounded-xl border border-destructive/40 dark:border-destructive/50 bg-destructive/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-destructive font-mono text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Danger Zone: Delete Account</span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Permanent Account Deletion</p>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                Deleting your account purges your cloud profile and synced custom shelves. Requires email link verification.
              </p>
            </div>

            <div className="pt-1">
              <Button
                variant="outline"
                size="chip"
                onClick={onOpenDeleteModal}
                className="w-full justify-center border-destructive/50 dark:border-destructive/60 text-destructive hover:bg-destructive/10 font-mono text-xs cursor-pointer"
                aria-label="Delete Account"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

