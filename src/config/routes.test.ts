import { describe, it, expect } from 'vitest';
import { ROUTES } from './routes';

describe('ROUTES Configuration', () => {
  it('provides static canonical routes', () => {
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.CATALOG).toBe('/');
    expect(ROUTES.ACCOUNT).toBe('/account');
    expect(ROUTES.PROFILE).toBe('/account');
    expect(ROUTES.CONFIRM_DELETION).toBe('/auth/confirm-deletion');
    expect(ROUTES.AUTH_CALLBACK).toBe('/auth/callback');
    expect(ROUTES.BOOKSHELF).toBe('/?view=bookshelf');
    expect(ROUTES.LIKES).toBe('/?view=likes');
    expect(ROUTES.API_BOOKS).toBe('/api/books');
    expect(ROUTES.API_CONTENT).toBe('/api/books/content');
  });

  it('builds dynamic reader route with id', () => {
    expect(ROUTES.READ(1342)).toBe('/read/1342');
    expect(ROUTES.READ('84')).toBe('/read/84');
  });

  it('builds view query route correctly', () => {
    expect(ROUTES.VIEW('catalog')).toBe('/');
    expect(ROUTES.VIEW('bookshelf')).toBe('/?view=bookshelf');
    expect(ROUTES.VIEW('likes')).toBe('/?view=likes');
  });
});

