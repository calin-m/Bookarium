'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface CopyrightNoticeBannerProps {
  country: string;
  ruleDescription?: string;
  reason?: string;
  publicDomainYear?: number;
  title?: string;
  subtext?: string;
  compact?: boolean;
  testId?: string;
  className?: string;
}

export const CopyrightNoticeBanner: React.FC<CopyrightNoticeBannerProps> = ({
  country,
  ruleDescription,
  reason,
  publicDomainYear,
  title,
  subtext,
  compact = false,
  testId = 'copyright-notice-banner',
  className = '',
}) => {
  const displayTitle = title || (compact ? `Restricted in ${country}` : 'Downloads Withheld Under Local Copyright Law');
  const descriptionText =
    reason ||
    (ruleDescription
      ? `This edition is protected by copyright in ${country} under ${ruleDescription}.`
      : `Protected under local copyright law in ${country}.`);
  const pdYearText = publicDomainYear
    ? compact
      ? ` Scheduled to enter the public domain on January 1, ${publicDomainYear}.`
      : ` This volume is scheduled to enter the public domain in your jurisdiction on January 1, ${publicDomainYear}.`
    : '';

  return (
    <div
      data-testid={testId}
      className={`rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 ${
        compact ? 'p-3 text-xs space-y-1' : 'p-4 space-y-2.5'
      } ${className}`}
    >
      <div
        className={`flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300 ${
          compact ? 'text-xs' : 'font-serif text-sm'
        }`}
      >
        <AlertTriangle className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-600 dark:text-amber-400 shrink-0`} />
        <span>{displayTitle}</span>
      </div>

      <p className={`${compact ? 'text-[11px] leading-relaxed text-muted-foreground' : 'text-xs font-sans leading-relaxed'}`}>
        {descriptionText}
        {pdYearText}
      </p>

      {subtext && !compact && (
        <p className="text-[11px] font-mono text-muted-foreground">
          {subtext}
        </p>
      )}
    </div>
  );
};

