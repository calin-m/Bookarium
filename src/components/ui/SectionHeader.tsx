import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionTitleProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  showFlankLines?: boolean;
  className?: string;
  titleClassName?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  children,
  as: Component = 'h2',
  showFlankLines = true,
  className = '',
  titleClassName = '',
}) => {
  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      {showFlankLines && (
        <div className="h-[1px] w-12 bg-border shrink-0" aria-hidden="true" />
      )}
      <Component
        className={cn(
          'text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight text-center',
          titleClassName
        )}
      >
        {children}
      </Component>
      {showFlankLines && (
        <div className="h-[1px] w-12 bg-border shrink-0" aria-hidden="true" />
      )}
    </div>
  );
};

export interface SectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  showFlankLines?: boolean;
  className?: string;
  titleClassName?: string;
  children?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  titleAs = 'h2',
  showFlankLines = true,
  className = '',
  titleClassName = '',
  children,
}) => {
  return (
    <div className={cn('text-center max-w-2xl mx-auto mb-10 space-y-2', className)}>
      {eyebrow && (
        <div className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground font-semibold">
          {eyebrow}
        </div>
      )}

      <SectionTitle
        as={titleAs}
        showFlankLines={showFlankLines}
        titleClassName={titleClassName}
      >
        {title}
      </SectionTitle>

      {subtitle && (
        <p className="text-xs sm:text-sm text-muted-foreground font-serif italic max-w-lg mx-auto">
          {subtitle}
        </p>
      )}

      {children}
    </div>
  );
};

