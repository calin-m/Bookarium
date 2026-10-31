import { describe, it, expect } from 'vitest';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parser = require('@babel/parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const traverse = require('@babel/traverse').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bookariumSecurity = require('./bookarium-security');

interface LintReport {
  ruleId: string;
  message: string;
  line: number;
}

function runRuleOnCode(
  ruleName: string,
  code: string,
  filename = 'src/app/api/books/route.ts'
): LintReport[] {
  const ruleDef = bookariumSecurity.rules[ruleName];
  if (!ruleDef) {
    throw new Error(`Unknown rule: ${ruleName}`);
  }

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  const reports: LintReport[] = [];
  const context = {
    filename,
    getFilename: () => filename,
    report({ node, message }: { node?: { loc?: { start?: { line?: number } } }; message: string }) {
      reports.push({
        ruleId: `bookarium-security/${ruleName}`,
        message,
        line: node?.loc?.start?.line || 1,
      });
    },
  };

  const listener = ruleDef.create(context);

  traverse(ast, {
    enter(pathNode: { node: { type: string } }) {
      const fn = listener[pathNode.node.type];
      if (typeof fn === 'function') {
        fn(pathNode.node);
      }
    },
    exit(pathNode: { node: { type: string } }) {
      const fn = listener[`${pathNode.node.type}:exit`];
      if (typeof fn === 'function') {
        fn(pathNode.node);
      }
    },
  });

  return reports;
}

describe('scripts/eslint-rules/bookarium-security AST & Taint Engine', () => {
  describe('1. no-unsafe-fetch', () => {
    it('flags unencrypted http:// URLs and direct untrusted searchParams in fetch()', () => {
      const badHttp = runRuleOnCode(
        'no-unsafe-fetch',
        `export async function load() { return fetch('http://aleph.gutenberg.org/cache/epub/1/pg1.txt'); }`
      );
      expect(badHttp).toHaveLength(1);
      expect(badHttp[0].message).toContain('Unencrypted http://');

      const badDirectParam = runRuleOnCode(
        'no-unsafe-fetch',
        `export async function GET(req: Request) {
          const { searchParams } = new URL(req.url);
          return fetch(searchParams.get('url')!);
        }`
      );
      expect(badDirectParam).toHaveLength(1);
      expect(badDirectParam[0].message).toContain('Unsafe fetch() call with direct untrusted input');
    });

    it('permits HTTPS and relative internal API fetch() calls', () => {
      const clean = runRuleOnCode(
        'no-unsafe-fetch',
        `export async function load() {
          await fetch('/api/books?page=1');
          await fetch('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
        }`
      );
      expect(clean).toHaveLength(0);
    });
  });

  describe('2. no-unvalidated-redirect', () => {
    it('flags unvalidated NextResponse.redirect() calls using raw searchParams or request.url', () => {
      const badRedirect = runRuleOnCode(
        'no-unvalidated-redirect',
        `import { NextResponse } from 'next/server';
        export async function GET(request: Request) {
          const { searchParams } = new URL(request.url);
          const rawNext = searchParams.get('next') || '/';
          return NextResponse.redirect(rawNext);
        }`,
        'src/app/auth/callback/route.ts'
      );
      expect(badRedirect).toHaveLength(1);
      expect(badRedirect[0].message).toContain('Unvalidated redirect target');
    });

    it('permits NextResponse.redirect() when path and origin are sanitized via redirect-sanitizer', () => {
      const cleanRedirect = runRuleOnCode(
        'no-unvalidated-redirect',
        `import { NextResponse } from 'next/server';
        import { sanitizeRedirectPath, resolveCanonicalAuthOrigin } from '@/lib/redirect-sanitizer';
        export async function GET(request: Request) {
          const { searchParams, origin } = new URL(request.url);
          const targetOrigin = resolveCanonicalAuthOrigin(origin);
          const next = sanitizeRedirectPath(searchParams.get('next'));
          return NextResponse.redirect(new URL(next, targetOrigin));
        }`,
        'src/app/auth/callback/route.ts'
      );
      expect(cleanRedirect).toHaveLength(0);
    });
  });

  describe('3. no-client-server-boundary-violation', () => {
    it('flags server-only module imports and secret process.env access in client components', () => {
      const violations = runRuleOnCode(
        'no-client-server-boundary-violation',
        `'use client';
        import { createClient } from '@/lib/supabase/server';
        import fs from 'fs';
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const { DATABASE_URL } = process.env;`,
        'src/components/reader/ReaderSurface.tsx'
      );
      expect(violations.length).toBeGreaterThanOrEqual(4);
      expect(violations.some((v) => v.message.includes('@/lib/supabase/server'))).toBe(true);
      expect(violations.some((v) => v.message.includes('"fs" is a server-only module'))).toBe(true);
      expect(violations.some((v) => v.message.includes('SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
      expect(violations.some((v) => v.message.includes('DATABASE_URL'))).toBe(true);
    });

    it('permits NEXT_PUBLIC_* and NODE_ENV in client-reachable modules', () => {
      const clean = runRuleOnCode(
        'no-client-server-boundary-violation',
        `'use client';
        import { createClient } from '@/lib/supabase/client';
        const isDev = process.env.NODE_ENV !== 'production';
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;`,
        'src/components/presentation/Navbar.tsx'
      );
      expect(clean).toHaveLength(0);
    });
  });

  describe('4. no-dangerous-execution', () => {
    it('flags eval(), new Function(), string setTimeout(), and shell execSync() in src/', () => {
      const violations = runRuleOnCode(
        'no-dangerous-execution',
        `import { execSync } from 'child_process';
        eval('2 + 2');
        const fn = new Function('a', 'return a');
        setTimeout('alert(1)', 100);
        execSync('ls -la');`,
        'src/lib/unsafe-helper.ts'
      );
      expect(violations).toHaveLength(4);
    });

    it('permits function-reference setTimeout(), setInterval(), and RegExp.prototype.exec()', () => {
      const clean = runRuleOnCode(
        'no-dangerous-execution',
        `setTimeout(() => {}, 250);
        setInterval(function tick() {}, 1000);
        const chapterRegex = /^CHAPTER\\s+([IVXLCDM]+|\\d+)/im;
        chapterRegex.exec('CHAPTER I');
        /^Title:\\s*(.+)$/im.exec('Title: Pride and Prejudice');`,
        'src/hooks/useNetworkStatus.ts'
      );
      expect(clean).toHaveLength(0);
    });
  });

  describe('5. no-unsafe-dom-injection', () => {
    it('flags dangerouslySetInnerHTML, .innerHTML, document.write, and insertAdjacentHTML', () => {
      const violations = runRuleOnCode(
        'no-unsafe-dom-injection',
        `export function BadComponent({ html, el }: { html: string; el: HTMLElement }) {
          el.innerHTML = html;
          document.write(html);
          el.insertAdjacentHTML('beforeend', html);
          return <div dangerouslySetInnerHTML={{ __html: html }} />;
        }`,
        'src/components/reader/ReaderSurface.tsx'
      );
      expect(violations).toHaveLength(4);
    });
  });

  describe('6. no-tainted-request-sink (Intra-Procedural Request Taint Analysis)', () => {
    it('tracks taint from searchParams, headers, cookies, and request.json() to fetch, redirect, DB writes, shell, fs, and external URLs', () => {
      const violations = runRuleOnCode(
        'no-tainted-request-sink',
        `import { NextResponse } from 'next/server';
        import fs from 'fs';
        import { execSync } from 'child_process';
        export async function POST(request: Request) {
          const { searchParams } = new URL(request.url);
          const rawTarget = searchParams.get('target') || '';
          const headerUrl = request.headers.get('x-upstream-url') || '';
          const cookiePath = request.cookies.get('file_path') || '';
          const body = await request.json();

          await fetch(\`\${rawTarget}/books\`);
          NextResponse.redirect(headerUrl);
          await supabase.from('books').insert(body);
          execSync(rawTarget);
          fs.readFileSync(cookiePath);
          window.open(rawTarget);
          location.href = headerUrl;
          const configObj: Record<string, string> = {};
          configObj[rawTarget] = 'polluted';
        }`,
        'src/app/api/books/route.ts'
      );
      expect(violations).toHaveLength(8);
      expect(violations[0].message).toContain('reaches fetch() sink');
      expect(violations[1].message).toContain('reaches redirect() sink');
      expect(violations[2].message).toContain('reaches database write sink (.insert())');
      expect(violations[3].message).toContain('reaches shell command sink');
      expect(violations[4].message).toContain('reaches file system sink');
      expect(violations[5].message).toContain('reaches external URL navigation sink');
      expect(violations[6].message).toContain('reaches external URL sink (location.href)');
      expect(violations[7].message).toContain('Prototype Pollution risk');
    });

    it('clears taint when values pass through sanitizers or isSafeUpstreamUrl() guards', () => {
      const clean = runRuleOnCode(
        'no-tainted-request-sink',
        `import { NextResponse } from 'next/server';
        import { isSafeUpstreamUrl } from './url-validator';
        import { sanitizeRedirectPath, resolveCanonicalAuthOrigin } from '@/lib/redirect-sanitizer';
        export async function GET(request: Request) {
          const { searchParams, origin } = new URL(request.url);
          const urlParam = searchParams.get('url') || '';
          if (urlParam && !isSafeUpstreamUrl(urlParam)) {
            return NextResponse.json({ error: 'Invalid' }, { status: 400 });
          }
          await fetch(urlParam);

          const bookId = parseInt(searchParams.get('id') || '', 10);
          await supabase.from('reading_progress').upsert({ book_id: bookId });

          const safeNext = sanitizeRedirectPath(searchParams.get('next'));
          const safeOrigin = resolveCanonicalAuthOrigin(origin);
          return NextResponse.redirect(new URL(safeNext, safeOrigin));
        }`,
        'src/app/api/books/content/route.ts'
      );
      expect(clean).toHaveLength(0);
    });
  });

  describe('7. no-secret-env-or-public-route-leak (Project Security Rules)', () => {
    it('flags NEXT_PUBLIC_ secret naming, service role usage in API routes, process.env serialization, and missing RateLimiter', () => {
      const violations = runRuleOnCode(
        'no-secret-env-or-public-route-leak',
        `import { NextResponse } from 'next/server';
        export async function GET() {
          const badPublicSecret = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
          const srvRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
          return NextResponse.json(process.env);
        }`,
        'src/app/api/books/route.ts'
      );
      expect(violations).toHaveLength(4);
      expect(violations.some((v) => v.message.includes('never prefix secret'))).toBe(true);
      expect(violations.some((v) => v.message.includes('must not reference SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
      expect(violations.some((v) => v.message.includes('Exposing raw process.env'))).toBe(true);
      expect(violations.some((v) => v.message.includes('must enforce rate limiting'))).toBe(true);
    });

    it('passes compliant public API route handlers that invoke RateLimiter.check()', () => {
      const clean = runRuleOnCode(
        'no-secret-env-or-public-route-leak',
        `import { NextRequest, NextResponse } from 'next/server';
        import { booksApiRateLimiter } from '@/lib/rate-limiter';
        export async function GET(request: NextRequest) {
          const limit = booksApiRateLimiter.check('127.0.0.1');
          if (!limit.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
          return NextResponse.json({ ok: true });
        }`,
        'src/app/api/books/route.ts'
      );
      expect(clean).toHaveLength(0);
    });
  });

  describe('8. no-focused-or-tautological-tests', () => {
    it('flags describe.only, it.only, and expect(true).toBe(true) in test files', () => {
      const violations = runRuleOnCode(
        'no-focused-or-tautological-tests',
        `describe.only('suite', () => {
          it.only('tautology', () => {
            expect(true).toBe(true);
          });
        });`,
        'src/components/BookCard.test.tsx'
      );
      expect(violations).toHaveLength(3);
    });
  });

  describe('9. enforce-gutenberg-and-copyright-policy', () => {
    it('flags copyright=true query strings, URLSearchParams.set("copyright", "true"), and direct fetch() to www.gutenberg.org', () => {
      const violations = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export async function badCatalogFetch() {
          const params = new URLSearchParams();
          params.set('copyright', 'true');
          await fetch('https://gutendex.com/books?copyright=true');
          await fetch('https://www.gutenberg.org/cache/epub/1342/pg1342.txt');
        }`,
        'src/lib/catalog/gutendex-provider.ts'
      );
      expect(violations).toHaveLength(3);
      expect(violations[0].message).toContain('setting "copyright" parameter to "true" is forbidden');
      expect(violations[1].message).toContain('"copyright=true" is forbidden');
      expect(violations[2].message).toContain('direct fetch() to www.gutenberg.org is forbidden');
    });

    it('permits copyright=false and mirror-prioritized fetches', () => {
      const clean = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export async function goodCatalogFetch() {
          const params = new URLSearchParams();
          params.set('copyright', 'false');
          await fetch('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
        }`,
        'src/lib/catalog/gutendex-provider.ts'
      );
      expect(clean).toHaveLength(0);
    });
  });

  describe('Full Codebase Standalone AST Security Audit', () => {
    it('verifies zero AST or taint violations across the entire production src/ directory', () => {
      const rootDir = path.resolve(__dirname, '../..');
      const violations = bookariumSecurity.runStandaloneAstSecurityAudit(rootDir);
      expect(violations).toEqual([]);
    }, 30000);
  });
});

