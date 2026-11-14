import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './server';
import { handleUnhandledMswRequest, mockBooks, sampleBookText } from './handlers';

describe('MSW test isolation handlers & fail-closed guard', () => {
  it('intercepts hosted Supabase endpoints across rest, auth, storage, realtime, functions, and graphql with 503 offline fallback', async () => {
    const services = ['rest', 'auth', 'storage', 'realtime', 'functions', 'graphql'] as const;

    for (const service of services) {
      const response = await fetch(`https://example-project.supabase.co/${service}/v1/health`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ message: 'Mock offline fallback' });
    }
  });

  it('intercepts local Supabase CLI :54321 endpoints cleanly without live socket I/O', async () => {
    const loopbackOrigins = ['127.0.0.1:54321', 'localhost:54321'] as const;

    for (const host of loopbackOrigins) {
      const localUrl = new URL('/rest/v1/user_annotations', `http://${host}`).toString();
      const response = await fetch(localUrl);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ message: 'Mock offline fallback' });
    }
  });

  it('provides deterministic catalog and content mocks via MSW', async () => {
    expect(mockBooks.length).toBeGreaterThan(0);
    expect(sampleBookText).toContain('Pride and Prejudice');

    server.use(
      http.get('/api/books', () => {
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [mockBooks[0]],
          source: 'supabase',
        });
      })
    );

    const res = await fetch(new URL('/api/books?search=Pride', window.location.origin).toString());
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { results: Array<{ id: number }>; source: string };
    expect(data.results.map((b) => b.id)).toEqual([1342]);
    expect(data.source).toBe('supabase');
  });

  it('throws fail-closed when handleUnhandledMswRequest sees unmocked Supabase, :54321, or external URLs', () => {
    expect(() =>
      handleUnhandledMswRequest(new Request('https://abc.supabase.co/rest/v2/unknown'))
    ).toThrow(/\[MSW Fail-Closed\]/);

    expect(() =>
      handleUnhandledMswRequest(new Request(new URL('/functions/v2/edge', 'http://127.0.0.1:54321')))
    ).toThrow(/\[MSW Fail-Closed\]/);

    expect(() =>
      handleUnhandledMswRequest(new Request('https://api.external-service.example/data'))
    ).toThrow(/\[MSW Fail-Closed\]/);

    expect(() =>
      handleUnhandledMswRequest(new Request(new URL('/api/books?page=1', 'http://localhost:3000')))
    ).toThrow(/\[MSW Fail-Closed\]/);

    expect(() =>
      handleUnhandledMswRequest(new Request(new URL('/api/books/content?id=1342', 'http://127.0.0.1:3000')))
    ).toThrow(/\[MSW Fail-Closed\]/);

    expect(() =>
      handleUnhandledMswRequest(new Request(new URL('/_next/static/chunk.js', 'http://localhost:3000')))
    ).not.toThrow();
  });
});
