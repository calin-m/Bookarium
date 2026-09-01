import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { proxy, config } from './proxy';
import * as supabaseMiddleware from '@/lib/supabase/middleware';

describe('Root Proxy (Next.js 16)', () => {
  it('calls updateSession with the incoming request', async () => {
    const mockResponse = NextResponse.next();
    const updateSessionSpy = vi
      .spyOn(supabaseMiddleware, 'updateSession')
      .mockResolvedValueOnce(mockResponse);

    const req = new NextRequest('http://localhost:3000/account');
    const res = await proxy(req);

    expect(updateSessionSpy).toHaveBeenCalledWith(req);
    expect(res).toBe(mockResponse);
  });

  it('exports valid matcher config', () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher.length).toBeGreaterThan(0);
  });
});

