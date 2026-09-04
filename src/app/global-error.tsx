'use client';

import React, { useEffect } from 'react';

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[AppRouter:RootLayoutFault]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-neutral-50">
              Critical Library Error
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              The application encountered a critical system fault at the root level.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-neutral-500 break-all">
                Digest: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold rounded-xl transition-colors text-sm"
          >
            Reload Sanctuary
          </button>
        </div>
      </body>
    </html>
  );
}

