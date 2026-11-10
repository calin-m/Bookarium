import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeLocalStorage } from './safe-storage';

describe('safeLocalStorage adapter', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('Browser Environment (window defined)', () => {
    it('delegates getItem, setItem, and removeItem to window.localStorage', () => {
      expect(safeLocalStorage.getItem('test-key')).toBeNull();

      safeLocalStorage.setItem('test-key', 'test-value');
      expect(safeLocalStorage.getItem('test-key')).toBe('test-value');
      expect(window.localStorage.getItem('test-key')).toBe('test-value');

      safeLocalStorage.removeItem('test-key');
      expect(safeLocalStorage.getItem('test-key')).toBeNull();
      expect(window.localStorage.getItem('test-key')).toBeNull();
    });

    it('gracefully handles exceptions in window.localStorage.getItem', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
        throw new Error('Storage disabled');
      });

      expect(safeLocalStorage.getItem('restricted-key')).toBeNull();
    });

    it('gracefully handles QuotaExceededError in window.localStorage.setItem', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        safeLocalStorage.setItem('large-key', 'oversized-value');
      }).not.toThrow();
    });

    it('gracefully handles exceptions in window.localStorage.removeItem', () => {
      vi.spyOn(window.localStorage, 'removeItem').mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        safeLocalStorage.removeItem('broken-key');
      }).not.toThrow();
    });
  });

  describe('Server-Side Rendering Environment (window undefined)', () => {
    it('returns null on getItem without throwing or referencing window', () => {
      // @ts-expect-error simulating SSR
      delete globalThis.window;

      expect(safeLocalStorage.getItem('any-key')).toBeNull();
    });

    it('acts as a safe no-op on setItem without throwing', () => {
      // @ts-expect-error simulating SSR
      delete globalThis.window;

      expect(() => {
        safeLocalStorage.setItem('any-key', 'any-value');
      }).not.toThrow();
    });

    it('acts as a safe no-op on removeItem without throwing', () => {
      // @ts-expect-error simulating SSR
      delete globalThis.window;

      expect(() => {
        safeLocalStorage.removeItem('any-key');
      }).not.toThrow();
    });
  });
});
