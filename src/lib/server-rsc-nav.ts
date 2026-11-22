/**
 * @module src/lib/server-rsc-nav
 * @scope Server-only App Router navigation header inspector isolating `next/headers` checks from client component bundles.
 * @invariant Read Next.js internal flight/prefetch headers (`rsc`, `next-router-state-tree`, `next-router-prefetch`, `accept`) defensively inside `try/catch`, returning `false` outside active request scopes and never importing client-side modules.
 * @rationale Keeping `next/headers` inside a dedicated server leaf lets layout utilities detect RSC transitions cleanly without failing `Pass 0.5` transitive client-to-server AST isolation checks.
 * @adr ADR-035, ADR-042
 */

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
