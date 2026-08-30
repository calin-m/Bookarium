import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { sampleBookText } from '@/mocks/handlers';

describe('GET /api/books/content', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 400 if neither url nor id is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/books/content');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it('should fetch and return book text for valid id', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => sampleBookText,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  });

  it('should return 502 if upstream fails or times out', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection aborted'));

    const req = new NextRequest('http://localhost:3000/api/books/content?id=99999');
    const res = await GET(req);

    expect(res.status).toBe(502);
  });
});

