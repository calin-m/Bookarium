'use client';

import React from 'react';
import type { User } from '@supabase/supabase-js';
import { Mail, Calendar, ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import type { Profile } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface AccountIdentityCardProps {
  user: User;
  profile: Profile | null;
  formattedDate: string;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onResendVerification?: () => Promise<void>;
  isResendingVerification?: boolean;
  resendSuccess?: boolean;
  resendError?: string | null;
  resendCooldown?: number;
}

export const AccountIdentityCard: React.FC<AccountIdentityCardProps> = ({
  user,
  profile,
  formattedDate,
  displayName,
  onDisplayNameChange,
  onSaveProfile,
  isSaving,
  saveSuccess,
  saveError,
  onResendVerification,
  isResendingVerification = false,
  resendSuccess = false,
  resendError = null,
  resendCooldown = 0,
}) => {
  const isEmailVerified = Boolean(user.email_confirmed_at || (user as any).confirmed_at);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground truncate">
            {profile?.display_name || user?.user_metadata?.display_name || 'Reader'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground mt-1">
            <span className="flex items-center gap-1 truncate max-w-[200px]" title={user.email}>
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formattedDate}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEmailVerified ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-success/10 text-success border border-success/30">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Verified Reader</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Email Unverified</span>
            </div>
          )}
        </div>
      </div>

      {/* Unverified Email Warning & Resend Banner */}
      {!isEmailVerified && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="space-y-1 min-w-0">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Please verify your email address</span>
            </p>
            <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
              Verification links expire in 1 hour. Confirm your email to secure your account.
            </p>
            {resendError && (
              <p className="text-[11px] text-destructive font-mono pt-1">{resendError}</p>
            )}
            {resendSuccess && (
              <p className="text-[11px] text-success font-mono pt-1">
                Verification link sent! Check your inbox.
              </p>
            )}
          </div>

          {onResendVerification && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResendVerification}
              disabled={isResendingVerification || resendCooldown > 0}
              className="shrink-0 text-xs font-mono cursor-pointer"
            >
              {isResendingVerification ? (
                'Sending...'
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                'Resend Verification Link'
              )}
            </Button>
          )}
        </div>
      )}

      {/* Profile Editor Form */}
      <form onSubmit={onSaveProfile} className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Account Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="display-name" className="text-xs font-mono text-foreground font-bold">
              Display Name
            </label>
            <Input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Your reading pen name"
              className="text-xs font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">
              Account Email
            </label>
            <Input
              type="email"
              value={user.email ?? ''}
              disabled
              className="text-xs font-mono opacity-70 bg-muted cursor-not-allowed"
            />
          </div>
        </div>

        {saveError && (
          <p className="text-xs font-mono text-destructive">{saveError}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="chip"
            isLoading={isSaving}
            aria-label="Save Changes"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </Button>
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-success animate-in fade-in duration-150">
              <Check className="w-3.5 h-3.5" />
              <span>Changes saved to cloud</span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
