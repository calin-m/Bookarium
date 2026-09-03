'use client';

import React from 'react';
import type { PasswordStrength } from '@/lib/password';

export interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
  className?: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  strength,
  className = '',
}) => {
  if (!strength.label && strength.score === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 text-[11px] font-mono ${className}`}
      data-testid="password-strength-meter"
    >
      <div className="flex h-1.5 flex-1 gap-1 rounded-full bg-muted/30 p-0.5 overflow-hidden">
        <div
          data-testid="strength-segment-1"
          className={`h-full flex-1 rounded-full transition-all duration-300 ${
            strength.score >= 1 ? strength.color : 'bg-transparent'
          }`}
        />
        <div
          data-testid="strength-segment-2"
          className={`h-full flex-1 rounded-full transition-all duration-300 ${
            strength.score >= 2 ? strength.color : 'bg-transparent'
          }`}
        />
        <div
          data-testid="strength-segment-3"
          className={`h-full flex-1 rounded-full transition-all duration-300 ${
            strength.score >= 3 ? strength.color : 'bg-transparent'
          }`}
        />
      </div>
      <span className="text-muted-foreground">Password strength:</span>
      <span className="font-bold text-foreground">{strength.label}</span>
    </div>
  );
};

