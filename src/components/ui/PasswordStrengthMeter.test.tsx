import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

describe('PasswordStrengthMeter', () => {
  it('renders nothing when strength is empty or score is 0 without label', () => {
    const { container } = render(
      <PasswordStrengthMeter strength={{ score: 0, label: '', color: '' }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders score segments and label for Moderate password', () => {
    render(
      <PasswordStrengthMeter
        strength={{ score: 2, label: 'Moderate', color: 'bg-amber-500' }}
      />
    );

    expect(screen.getByText('Password strength:')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();

    const seg1 = screen.getByTestId('strength-segment-1');
    const seg2 = screen.getByTestId('strength-segment-2');
    const seg3 = screen.getByTestId('strength-segment-3');

    expect(seg1.className).toContain('bg-amber-500');
    expect(seg2.className).toContain('bg-amber-500');
    expect(seg3.className).toContain('bg-transparent');
  });

  it('renders all 3 segments filled for Strong password', () => {
    render(
      <PasswordStrengthMeter
        strength={{ score: 3, label: 'Strong', color: 'bg-emerald-500' }}
      />
    );

    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByTestId('strength-segment-1').className).toContain('bg-emerald-500');
    expect(screen.getByTestId('strength-segment-2').className).toContain('bg-emerald-500');
    expect(screen.getByTestId('strength-segment-3').className).toContain('bg-emerald-500');
  });
});

