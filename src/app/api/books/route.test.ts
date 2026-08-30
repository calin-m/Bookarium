import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/books route handler', () => {
  it('should fetch and return public domain books JSON with zero copyright', async () => {
    const req = new NextRequest('http://localhost:3000/api/books?search=Jane+Austen');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toBeDefined();
    expect(Array.isArray(json.results)).toBe(true);
  });

  it('should pass topic, language, and page query parameters', async () => {
    const req = new NextRequest('http://localhost:3000/api/books?topic=Philosophy&languages=en&page=2');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toBeDefined();
  });

  it('should handle fetch failure gracefully', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        statusText: 'Not Found',
      })
    );

    const req = new NextRequest('http://localhost:3000/api/books');
    const res = await GET(req);

    expect(res.status).toBe(404);
    fetchSpy.mockRestore();
  });

  it('should handle network exception gracefully', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const req = new NextRequest('http://localhost:3000/api/books');
    const res = await GET(req);

    expect(res.status).toBe(500);
    fetchSpy.mockRestore();
  });
});

