import React from 'react';
import { cn } from '@/lib/utils';

export type TextareaVariant = 'default' | 'subtle' | 'reader';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Surface styling preset matching form inputs (`default`), card editors (`subtle`), or stone reader drawers (`reader`). */
  variant?: TextareaVariant;
}

const TEXTAREA_VARIANTS: Record<TextareaVariant, string> = {
  default:
    'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent resize-none transition-colors',
  subtle:
    'w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed resize-none',
  reader:
    'w-full text-xs p-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-1 focus:ring-primary-500 font-sans',
};

/**
 * Forwarded-ref textarea companion to `Input` preserving exact surface variants across
 * profile bios, notebook quote reflections, and in-reader marginalia editors.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(TEXTAREA_VARIANTS[variant], className)}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
