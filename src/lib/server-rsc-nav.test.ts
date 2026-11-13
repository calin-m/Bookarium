import { describe, it, expect, vi, beforeEach } from 'vitest';
import { headers } from 'next/headers';
import { isClientSideNavigation } from './server-rsc-nav';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('isClientSideNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when Next.js RSC or prefetch headers are present', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers({ rsc: '1' }));
    expect(await isClientSideNavigation()).toBe(true);

    vi.mocked(headers).mockResolvedValueOnce(new Headers({ 'next-router-state-tree': '%5B%5D' }));
    expect(await isClientSideNavigation()).toBe(true);

    vi.mocked(headers).mockResolvedValueOnce(new Headers({ 'next-router-prefetch': '1' }));
    expect(await isClientSideNavigation()).toBe(true);

    vi.mocked(headers).mockResolvedValueOnce(new Headers({ accept: 'text/x-component' }));
    expect(await isClientSideNavigation()).toBe(true);
  });

  it('returns false for standard document HTML requests or outside request scope', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers({ accept: 'text/html' }));
    expect(await isClientSideNavigation()).toBe(false);

    vi.mocked(headers).mockRejectedValueOnce(new Error('Outside request context'));
    expect(await isClientSideNavigation()).toBe(false);
  });
});
