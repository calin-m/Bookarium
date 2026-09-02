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
}) => {
  return (
    <>
      {/* Security & Password Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-border shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Security & Password
            </h2>
            <p className="text-xs text-muted-foreground font-sans">
              Update your account password to protect your cloud reading lists.
            </p>
          </div>
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
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-muted-foreground">Password strength:</span>
                <span className="font-bold text-foreground">{strength.label}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex gap-1">
                <div className={`h-full flex-1 rounded-full transition-all duration-200 ${strength.score >= 1 ? strength.color : 'bg-transparent'}`} />
                <div className={`h-full flex-1 rounded-full transition-all duration-200 ${strength.score >= 2 ? strength.color : 'bg-transparent'}`} />
                <div className={`h-full flex-1 rounded-full transition-all duration-200 ${strength.score >= 3 ? strength.color : 'bg-transparent'}`} />
              </div>
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

      {/* Account Session Actions Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Account Session
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Active Device Session</p>
            <p className="text-xs text-muted-foreground font-sans">
              Sign out from this browser. Your local bookshelf and bookmarks will remain safely stored.
            </p>
          </div>
          <Button
            variant="outline"
            size="chip"
            onClick={onSignOut}
            className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-destructive font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone: Delete Account</span>
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Permanent Account Deletion</p>
            <p className="text-xs text-muted-foreground font-sans max-w-md">
              Deleting your account purges your cloud profile and synced custom shelves. Requires email link verification.
            </p>
          </div>
          <Button
            variant="outline"
            size="chip"
            onClick={onOpenDeleteModal}
            className="border-border text-destructive hover:bg-destructive/10 shrink-0 font-mono text-xs"
            aria-label="Delete Account"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </Button>
        </div>
      </div>
    </>
  );
};

