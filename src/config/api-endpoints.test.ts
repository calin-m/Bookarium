import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS } from './api-endpoints';

describe('src/config/api-endpoints', () => {
  it('exposes strictly internal Next.js App Router API routes backed by private Cloudflare R2', () => {
    expect(API_ENDPOINTS).toEqual({
      INTERNAL_API_BOOKS: '/api/books',
      INTERNAL_API_CONTENT: '/api/books/content',
    });
  });
});

