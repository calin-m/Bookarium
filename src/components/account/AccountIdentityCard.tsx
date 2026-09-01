'use client';

import React from 'react';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, Mail, Calendar, ShieldCheck, Check } from 'lucide-react';
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
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-border text-primary flex items-center justify-center shadow-inner">
            <UserIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">
              {profile?.display_name || user?.user_metadata?.display_name || 'Reader'}
            </h1>
            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-success/10 text-success border border-border">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Reader</span>
          </div>
        </div>
      </div>

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

