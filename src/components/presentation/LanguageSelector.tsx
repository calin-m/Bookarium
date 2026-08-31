'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { CATALOG_LANGUAGES } from '@/config/catalog-filters';

export interface LanguageSelectorProps {
  value?: string;
  onChange?: (lang: string) => void;
  variant?: 'compact' | 'full';
  id?: string;
  dataTestId?: string;
  className?: string;
  showIcon?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value = '',
  onChange,
  variant = 'compact',
  id,
  dataTestId = 'language-select',
  className = '',
  showIcon = variant === 'compact',
}) => {
  const selectElement = (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid={dataTestId}
      aria-label="Filter catalog by language"
      className={`bg-card text-foreground border border-border rounded focus:outline-hidden focus:border-primary cursor-pointer transition-colors ${
        variant === 'compact'
          ? 'px-2 py-0.5 text-xs'
          : 'w-full p-2.5 text-xs rounded-lg'
      } ${className}`}
    >
      {CATALOG_LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value} className="bg-card text-foreground">
          {lang.label}
        </option>
      ))}
    </select>
  );

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {showIcon && <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />}
        <span className="font-mono text-[11px] uppercase text-muted-foreground select-none">Language:</span>
        {selectElement}
      </div>
    );
  }

  return selectElement;
};

