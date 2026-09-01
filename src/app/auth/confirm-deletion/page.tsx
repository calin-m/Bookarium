'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, ArrowLeft, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Navbar } from '@/components/presentation/Navbar';
import { Footer } from '@/components/presentation/Footer';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export default function ConfirmDeletionPage() {
  const router = useRouter();
  const { user, isLoading, deleteAccount } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await deleteAccount();
      if (error) {
        setDeleteError(error.message);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/?account_deleted=true');
        }, 1500);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200">
      <Navbar
        onViewChange={(view) => {
          router.push(ROUTES.VIEW(view));
        }}
      />

      <main className="flex-1 w-full max-w-xl mx-auto py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        {/* Loading State */}
        {isLoading && (
          <div className="text-center space-y-3 py-12 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto" />
            <p className="text-xs font-mono text-muted-foreground">Verifying secure deletion link...</p>
          </div>
        )}

        {/* Success State */}
        {!isLoading && isSuccess && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-sm w-full">
            <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/30 text-success flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-foreground">Account Permanently Deleted</h2>
              <p className="text-xs text-muted-foreground font-sans">
                Your profile, cloud custom bookshelves, and reading records have been purged. Redirecting you home...
              </p>
            </div>
          </div>
        )}

        {/* Unauthenticated / Expired Link */}
        {!isLoading && !isSuccess && !user && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5 shadow-sm w-full">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-serif font-bold text-foreground">Link Expired or Invalid</h2>
              <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto leading-relaxed">
                This deletion verification link is no longer valid or has already expired. To delete your account, please request a new verification link from your profile settings.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href={ROUTES.PROFILE}>
                <Button variant="primary" size="md" className="font-mono text-xs uppercase">
                  Go to Profile
                </Button>
              </Link>
              <Link href={ROUTES.HOME}>
                <Button variant="outline" size="md" className="font-mono text-xs uppercase">
                  Return Home
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Authenticated Confirmation Portal */}
        {!isLoading && !isSuccess && user && (
          <div className="bg-card border border-destructive/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg w-full">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-destructive/10 text-destructive border border-destructive/30">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Security Deletion Portal</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
                  Confirm Account Deletion
                </h1>
                <p className="text-xs text-muted-foreground font-sans">
                  Identity verified via email link sent to <strong className="text-foreground">{user.email}</strong>.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-mono text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Final Warning: Permanent Data Loss</span>
              </div>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                Executing deletion will permanently delete your account profile, custom cloud bookshelves, and remote reading progress. This action is irreversible.
              </p>
            </div>

            {deleteError && (
              <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{deleteError}</span>
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Link href={ROUTES.PROFILE} className="w-full sm:w-auto">
                <Button variant="outline" size="md" className="w-full sm:w-auto font-mono text-xs uppercase">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Cancel & Keep Account</span>
                </Button>
              </Link>
              <Button
                variant="primary"
                size="md"
                isLoading={isDeleting}
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent font-mono text-xs uppercase gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete Account</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

