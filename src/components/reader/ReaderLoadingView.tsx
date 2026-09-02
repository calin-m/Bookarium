import React from 'react';
import type { ReaderThemeConfig } from '@/config/reader-themes';

export interface ReaderLoadingViewProps {
  activeTheme: ReaderThemeConfig;
}

export const ReaderLoadingView: React.FC<ReaderLoadingViewProps> = ({ activeTheme }) => {
  return (
    <main
      className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`}
      role="main"
      data-testid="reader-loading-view"
    >
      <div className="w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mb-4" />
      <p className="font-serif text-base font-bold">
        Fetching Masterwork from Project Gutenberg Mirror...
      </p>
      <p className={`text-xs font-mono mt-1 ${activeTheme.textMuted}`}>
        Parsing typography AST, chapters, and volume pagination
      </p>
    </main>
  );
};

