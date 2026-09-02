import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, translateRateLimiter } from './route';

describe('/api/translate route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
