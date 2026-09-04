'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    // Surface boundary exception for diagnostic tracing
    console.error('[AppRouter:FatalBoundary]', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6" role="alert">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6 shadow-booksaw">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">
            A Disturbance in the Library
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The volume or section you requested encountered an unexpected rendering fault.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-muted-foreground/60 break-all">
              Error Digest: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => reset()} className="w-full sm:w-auto gap-2">
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>
          <Link href={ROUTES.HOME} className="w-full sm:w-auto">
            <Button variant="primary" className="w-full gap-2">
              <Home className="w-4 h-4" />
              Return to Catalog
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

