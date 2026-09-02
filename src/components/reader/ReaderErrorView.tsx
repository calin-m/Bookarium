import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ReaderThemeConfig } from '@/config/reader-themes';

export interface ReaderErrorViewProps {
  activeTheme: ReaderThemeConfig;
  onRetry?: () => void;
}

export const ReaderErrorView: React.FC<ReaderErrorViewProps> = ({ activeTheme, onRetry }) => {
  return (
    <main
      className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`}
      role="main"
      data-testid="reader-error-view"
    >
      <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
      <h2 className="font-serif text-lg font-bold mb-2">
        Unable to Load Masterwork Text
      </h2>
      <p className={`text-xs font-mono max-w-md mb-6 ${activeTheme.textMuted}`}>
        The Project Gutenberg plain-text mirror could not be streamed. Please check your network connection or try again.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </main>
  );
};

