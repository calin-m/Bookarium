/**
 * Pure domain utilities for cryptographic password generation and strength evaluation.
 * Decoupled from React runtimes for zero-dependency portability and testing.
 */

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3;
  label: string;
  color: string;
}

/**
 * Generates a high-entropy, random 16-character password using standard browser crypto.
 */
export function generateStrongPassword(length = 16): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
  let generated = '';
  const array = new Uint32Array(length);

  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      generated += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      generated += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return generated;
}

/**
 * Evaluates password complexity and returns a structured score, semantic label, and Tailwind color.
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '', color: 'bg-transparent' };
  }
  if (password.length < 6) {
    return { score: 0, label: 'Too short', color: 'bg-muted' };
  }

  let score = 1;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 12) score++;

  if (score === 1) return { score: 1, label: 'Weak', color: 'bg-destructive' };
  if (score === 2) return { score: 2, label: 'Moderate', color: 'bg-amber-500' };
  return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
}

