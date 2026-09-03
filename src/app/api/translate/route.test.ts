import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, translateRateLimiter, serverTranslationCache } from './route';

describe('/api/translate route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    serverTranslationCache.clear();
  });

  it('translates text successfully and returns segments', async () => {
    const mockGoogleResponse = [
      [
        ['Hola mundo. ', 'Hello world. ', null, null, 1],
        ['Esta es una prueba.', 'This is a test.', null, null, 1],
      ],
      null,
      'en',
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockGoogleResponse),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello world. This is a test.',
        to: 'es',
        from: 'en',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.translatedText).toBe('Hola mundo. Esta es una prueba.');
    expect(data.detectedSourceLanguage).toBe('en');
    expect(data.targetLanguage).toBe('es');
    expect(data.segments).toHaveLength(2);
    expect(data.segments[0].translated).toBe('Hola mundo. ');
    expect(data.segments[0].original).toBe('Hello world. ');
  });

  it('rejects request with invalid JSON payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: 'invalid-json{',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid JSON');
  });

  it('rejects request with missing or empty text', async () => {
    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: '   ', to: 'fr' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('text');
  });

  it('rejects request with invalid target language code', async () => {
    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello', to: '123_invalid!' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('target language');
  });

  it('handles upstream service failure with 502', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello', to: 'de' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(502);
  });

  it('handles malformed upstream payload with 502', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ not: 'an array' }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello', to: 'de' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(502);
  });

  it('handles timeout (AbortError) with 504', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    global.fetch = vi.fn().mockRejectedValue(abortError);

    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello', to: 'de' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(504);
  });

  it('handles unexpected failure with 500', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network crash'));

    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello', to: 'de' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to process');
  });

  it('enforces rate limiting and returns 429 when quota exceeded', async () => {
    vi.spyOn(translateRateLimiter, 'check').mockReturnValue({
      success: false,
      limit: 60,
      remaining: 0,
      resetMs: 30000,
    });

    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello', to: 'es' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('rejects request exceeding 15,000 character maximum payload', async () => {
    const oversizedText = 'A'.repeat(15001);
    const request = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: oversizedText, to: 'es' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('15,000 characters');
  });

  it('serves identical translation from in-memory LRU cache on second call with X-Cache-Lookup HIT', async () => {
    const mockGoogleResponse = [
      [['Bonjour le monde.', 'Hello world.', null, null, 1]],
      null,
      'en',
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockGoogleResponse),
    } as any);
    global.fetch = fetchMock;

    const request1 = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello world.', to: 'fr', from: 'en' }),
    });

    const res1 = await POST(request1);
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-Cache-Lookup')).toBe('MISS');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second identical call
    const request2 = new NextRequest('http://localhost:3000/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello world.', to: 'fr', from: 'en' }),
    });

    const res2 = await POST(request2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-Cache-Lookup')).toBe('HIT');
    const data2 = await res2.json();
    expect(data2.translatedText).toBe('Bonjour le monde.');
    // Upstream fetch was NOT called again!
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
