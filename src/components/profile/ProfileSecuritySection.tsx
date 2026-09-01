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

export interface ProfileSecuritySectionProps {
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

export const ProfileSecuritySection: React.FC<ProfileSecuritySectionProps> = ({
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
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-border">
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
              <div className="flex items-center justify-between">
                <label htmlFor="new-password" className="text-xs font-mono text-foreground font-bold">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={onGeneratePassword}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer transition-colors"
                  aria-label="Suggest Strong Password"
                >
                  {copiedPassword ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500 font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3 h-3" />
                      <span>Suggest Strong Password</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  placeholder="••••••••••••"
                  className="text-xs font-mono pr-9"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={onToggleShowPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-mono text-foreground font-bold">
                Confirm New Password
              </label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                placeholder="••••••••••••"
                className="text-xs font-mono"
                minLength={6}
                required
              />
            </div>
          </div>

          {/* Password Strength Meter for Profile */}
          {newPassword.length > 0 && (
            <div className="space-y-1 pt-1 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 h-1">
                <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-muted'}`} />
                <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-muted'}`} />
                <div className={`h-full flex-1 rounded-full transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-muted'}`} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>Password strength:</span>
                <span className="font-bold text-foreground">{strength.label}</span>
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

      {/* Account Actions & Danger Zone */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-0.5">
            <h3 className="text-sm font-mono font-bold text-foreground">Sign Out of Bookarium</h3>
            <p className="text-xs text-muted-foreground font-sans">
              Your reading progress and cloud bookshelves are securely saved in Supabase.
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={onSignOut}
            className="font-mono text-xs uppercase text-destructive hover:bg-destructive/10 border border-border shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            <span>Sign Out</span>
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="space-y-0.5">
            <h3 className="text-sm font-mono font-bold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Danger Zone: Delete Account</span>
            </h3>
            <p className="text-xs text-muted-foreground font-sans">
              Permanently delete your profile and purge all custom cloud bookshelves. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={onOpenDeleteModal}
            className="font-mono text-xs uppercase bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            <span>Delete Account</span>
          </Button>
        </div>
      </div>
    </>
  );
};

