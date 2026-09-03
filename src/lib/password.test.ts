import { describe, it, expect } from 'vitest';
import { generateStrongPassword, evaluatePasswordStrength } from './password';

describe('password utilities', () => {
  describe('generateStrongPassword', () => {
    it('generates a password of default length 16', () => {
      const pwd = generateStrongPassword();
      expect(pwd).toHaveLength(16);
      expect(typeof pwd).toBe('string');
    });

    it('generates a password of custom length', () => {
      const pwd = generateStrongPassword(24);
      expect(pwd).toHaveLength(24);
    });

    it('produces distinct passwords on successive calls (entropy check)', () => {
      const p1 = generateStrongPassword();
      const p2 = generateStrongPassword();
      expect(p1).not.toBe(p2);
    });
  });

  describe('evaluatePasswordStrength', () => {
    it('handles empty or null string', () => {
      expect(evaluatePasswordStrength('')).toEqual({
        score: 0,
        label: '',
        color: 'bg-transparent',
      });
    });

    it('handles passwords shorter than 6 characters as Too short', () => {
      expect(evaluatePasswordStrength('abc')).toEqual({
        score: 0,
        label: 'Too short',
        color: 'bg-muted',
      });
      expect(evaluatePasswordStrength('12345')).toEqual({
        score: 0,
        label: 'Too short',
        color: 'bg-muted',
      });
    });

    it('rates standard 6-character passwords as Weak', () => {
      const res = evaluatePasswordStrength('simple');
      expect(res.score).toBe(1);
      expect(res.label).toBe('Weak');
      expect(res.color).toBe('bg-destructive');
    });

    it('rates mixed-case alphanumeric passwords as Moderate', () => {
      const res = evaluatePasswordStrength('Pass123');
      expect(res.score).toBe(2);
      expect(res.label).toBe('Moderate');
      expect(res.color).toBe('bg-amber-500');
    });

    it('rates long complex passwords with symbols as Strong', () => {
      const res = evaluatePasswordStrength('MySuperP@ssw0rd!');
      expect(res.score).toBe(3);
      expect(res.label).toBe('Strong');
      expect(res.color).toBe('bg-emerald-500');
    });
  });
});
