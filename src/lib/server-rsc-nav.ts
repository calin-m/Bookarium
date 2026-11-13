import { headers } from 'next/headers';

/**
 * Server-only helper detecting Next.js internal App Router RSC navigations and prefetches.
 * Kept isolated from client modules so `next/headers` never leaks into browser bundles.
 */
export async function isClientSideNavigation(): Promise<boolean> {
  try {
    const headersList = await headers();
    return (
      headersList.get('rsc') === '1' ||
      Boolean(headersList.get('next-router-state-tree')) ||
      Boolean(headersList.get('next-router-prefetch')) ||
      headersList.get('accept')?.includes('text/x-component') === true
    );
  } catch {
    return false;
  }
}
