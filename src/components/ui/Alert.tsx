import React from 'react';
import { cn } from '@/lib/utils';

export type AlertVariant = 'info' | 'neutral' | 'success' | 'success-token' | 'warning' | 'error';

export interface AlertProps {
  /** Visual severity styling for the callout banner. */
  variant?: AlertVariant;
  /** ARIA live role (`'status'` | `'alert'`), or `null` to omit any `role` attribute. */
  role?: 'status' | 'alert' | null;
  /** Optional icon rendered alongside the alert body. */
  icon?: React.ReactNode;
  /** Optional stacked action/footer bar rendered below the icon + message row. */
  footer?: React.ReactNode;
  /** Optional class override for the inner icon + message row when `footer` is present. */
  headerClassName?: string;
  /** Optional `data-testid` hook for testing. */
  dataTestId?: string;
  /** Standard `data-testid` alias for HTML attribute compatibility. */
  'data-testid'?: string;
  /** Additional Tailwind classes overriding container spacing, radius, or alignment. */
  className?: string;
  /** Alert message or custom inline JSX body. */
  children: React.ReactNode;
}

const ALERT_VARIANTS: Record<AlertVariant, string> = {
  info: 'bg-primary/10 border-border text-primary font-mono text-xs',
  neutral: 'bg-muted/30 border-border text-[11px] text-muted-foreground leading-relaxed',
  success:
    'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono',
  'success-token': 'bg-success/10 border-border text-xs font-mono text-success',
  warning:
    'bg-amber-500/10 border-amber-500/40 dark:border-amber-500/50 text-amber-800 dark:text-amber-200 text-xs',
  error: 'bg-destructive/10 border-destructive/30 text-destructive text-xs font-mono',
};

const DEFAULT_ROLES: Record<AlertVariant, 'status' | 'alert' | undefined> = {
  info: 'status',
  neutral: undefined,
  success: 'status',
  'success-token': 'status',
  warning: 'alert',
  error: 'alert',
};

/**
 * Shared boxed feedback callout supporting status, informative, warning, error,
 * and stacked footer banners with exact per-surface spacing overrides.
 */
export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  role,
  icon,
  footer,
  headerClassName,
  dataTestId,
  'data-testid': dataTestIdAttr,
  className,
  children,
}) => {
  const resolvedRole = role === null ? undefined : role ?? DEFAULT_ROLES[variant];
  const resolvedTestId = dataTestIdAttr ?? dataTestId;
  const content =
    typeof children === 'string' || typeof children === 'number' ? <span>{children}</span> : children;

  return (
    <div
      role={resolvedRole}
      data-testid={resolvedTestId}
      className={cn(
        'p-3 rounded-lg border',
        footer ? 'space-y-2' : 'flex items-center gap-2.5',
        ALERT_VARIANTS[variant],
        className
      )}
    >
      {footer ? (
        <>
          <div className={cn('flex items-center gap-2.5', headerClassName)}>
            {icon}
            {content}
          </div>
          {footer}
        </>
      ) : (
        <>
          {icon}
          {content}
        </>
      )}
    </div>
  );
};
