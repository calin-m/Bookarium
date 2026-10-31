import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS } from './api-endpoints';

describe('src/config/api-endpoints', () => {
  it('exposes HTTPS upstream Gutenberg/Gutendex URLs and root-relative internal API routes', () => {
    expect(API_ENDPOINTS.GUTENDEX_BASE_URL).toMatch(/^https:\/\//);
    expect(API_ENDPOINTS.GUTENBERG_CACHE_BASE_URL).toBe(
      'https://www.gutenberg.org/cache/epub'
    );
    expect(API_ENDPOINTS.GUTENBERG_FILES_BASE_URL).toBe(
      'https://www.gutenberg.org/files'
    );
    expect(API_ENDPOINTS.INTERNAL_API_BOOKS).toBe('/api/books');
    expect(API_ENDPOINTS.INTERNAL_API_CONTENT).toBe('/api/books/content');
  });
});

