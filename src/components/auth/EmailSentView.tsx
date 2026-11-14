'use client';

import React, { useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  TurnstileWidget,
  getTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from './TurnstileWidget';

export interface EmailSentViewProps {
  title?: string;
  email: string;
  messagePrefix: string;
  subtitle?: string;
  resendSuccess?: boolean;
  onResend?: (captchaToken?: string) => void | Promise<void>;
  isResending?: boolean;
  resendCooldown?: number;
  onBackToSignIn: () => void;
  backButtonLabel?: string;
}

export function EmailSentView({
  title = 'Check your email',
  email,
  messagePrefix,
  subtitle,
  resendSuccess = false,
  onResend,
  isResending = false,
  resendCooldown = 0,
  onBackToSignIn,
  backButtonLabel = 'Back to Sign In',
}: EmailSentViewProps) {
  const turnstileSiteKey = getTurnstileSiteKey();
  const [resendToken, setResendToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [resendHint, setResendHint] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleResendClick = async () => {
    if (!onResend) return;
    if (turnstileSiteKey && !resendToken) {
      setResendHint('Please complete the security verification check above before resending.');
      return;
    }
    setResendHint(null);
    const tokenToSend = resendToken || undefined;
    try {
      await (tokenToSend ? onResend(tokenToSend) : onResend());
    } finally {
      if (turnstileSiteKey) {
        setResendToken(null);
        turnstileRef.current?.reset();
      }
    }
  };

  return (
    <div className="space-y-4 text-center py-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mx-auto">
        <Mail className="w-6 h-6" />
      </div>
      <div className="space-y-2">
        <h3 className="font-serif font-bold text-lg text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          {messagePrefix} <strong className="text-foreground">{email}</strong>.
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground font-sans">
            {subtitle}
          </p>
        )}
        {resendSuccess && (
          <p className="text-xs font-mono text-success pt-1">
            Fresh verification link sent! Please check your inbox.
          </p>
        )}
        {turnstileError && (
          <p className="text-[11px] font-mono text-destructive pt-1">{turnstileError}</p>
        )}
        {resendHint && (
          <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400 pt-1">
            {resendHint}
          </p>
        )}
      </div>
      {onResend && turnstileSiteKey && (
        <TurnstileWidget
          ref={turnstileRef}
          testId="email-sent-turnstile-widget"
          onTokenChange={(token) => {
            setResendToken(token);
            if (token) {
              setTurnstileError(null);
              setResendHint(null);
            }
          }}
          onLoadError={setTurnstileError}
          className="pt-1 flex justify-center"
        />
      )}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
        {onResend && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleResendClick();
            }}
            disabled={isResending || resendCooldown > 0}
            className="font-mono text-xs cursor-pointer w-full sm:w-auto"
          >
            {isResending
              ? 'Sending...'
              : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : 'Resend Email'}
          </Button>
        )}
        <Button
          type="button"
          variant={onResend ? 'primary' : 'outline'}
          size="sm"
          onClick={onBackToSignIn}
          className="font-mono text-xs cursor-pointer w-full sm:w-auto"
        >
          {backButtonLabel}
        </Button>
      </div>
    </div>
  );
}

