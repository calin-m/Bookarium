import { describe, it, expect } from 'vitest';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parser = require('@babel/parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const traverseModule = require('@babel/traverse');
const traverse = traverseModule.default || traverseModule;
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

    it('flags unencrypted http:// in Node https.get/http.get inside scripts/ while permitting loopback dev probing', () => {
      const badNodeHttp = runRuleOnCode(
        'no-unsafe-fetch',
        `const https = require('https');
        function run(arg) {
          https.get('http://insecure.example/feed.csv');
          https.get(process.argv[2]);
        }`,
        'scripts/sync-custom.js'
      );
      expect(badNodeHttp).toHaveLength(2);
      expect(badNodeHttp[0].message).toContain('Unencrypted http://');
      expect(badNodeHttp[1].message).toContain('CLI process.argv');

      const safeLoopback = runRuleOnCode(
        'no-unsafe-fetch',
        `const http = require('http');
        http.get('http://127.0.0.1:3000/api/health');`,
        'scripts/open-browser.js'
      );
      expect(safeLoopback).toHaveLength(0);
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
        import { isClientSideNavigation } from '@/lib/server-rsc-nav';
        import { fetchR2CoverBytes } from '@/lib/r2-client';
        import fs from 'fs';
        import http from 'node:http';
        const loadMiddleware = () => import('@/lib/supabase/middleware');
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const r2Key = process.env.R2_SECRET_ACCESS_KEY;
        const { DATABASE_URL } = process.env;`,
        'src/components/reader/ReaderSurface.tsx'
      );
      expect(violations.length).toBeGreaterThanOrEqual(9);
      expect(violations.some((v) => v.message.includes('@/lib/supabase/server'))).toBe(true);
      expect(violations.some((v) => v.message.includes('@/lib/server-rsc-nav'))).toBe(true);
      expect(violations.some((v) => v.message.includes('@/lib/r2-client'))).toBe(true);
      expect(violations.some((v) => v.message.includes('@/lib/supabase/middleware'))).toBe(true);
      expect(violations.some((v) => v.message.includes('"fs" is a server-only module'))).toBe(true);
      expect(violations.some((v) => v.message.includes('"node:http" is a server-only module'))).toBe(true);
      expect(violations.some((v) => v.message.includes('SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
      expect(violations.some((v) => v.message.includes('R2_SECRET_ACCESS_KEY'))).toBe(true);
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
    it('flags eval(), new Function(), string setTimeout(), shell execSync() in src/, and catastrophic backtracking ReDoS regex literals or static new RegExp() patterns', () => {
      const violations = runRuleOnCode(
        'no-dangerous-execution',
        `import { execSync } from 'child_process';
        eval('2 + 2');
        const fn = new Function('a', 'return a');
        setTimeout('alert(1)', 100);
        execSync('ls -la');
        const redos = /(\\w+)+/;
        const staticStringRedos = new RegExp('(a+)+');`,
        'src/lib/unsafe-helper.ts'
      );
      expect(violations).toHaveLength(6);
      expect(violations[4].message).toContain('Catastrophic backtracking ReDoS pattern (CWE-1333)');
      expect(violations[5].message).toContain('Catastrophic backtracking ReDoS pattern (CWE-1333)');
    });

    it('permits function-reference setTimeout(), setInterval(), RegExp.prototype.exec(), and dynamic template new RegExp()', () => {
      const clean = runRuleOnCode(
        'no-dangerous-execution',
        `setTimeout(() => {}, 250);
        setInterval(function tick() {}, 1000);
        const chapterRegex = /^CHAPTER\\s+([IVXLCDM]+|\\d+)/im;
        chapterRegex.exec('CHAPTER I');
        /^Title:\\s*(.+)$/im.exec('Title: Pride and Prejudice');
        const query = 'pride';
        const dyn = new RegExp(\`\\\\b\${query}\`, 'i');
        dyn.test('Pride');`,
        'src/hooks/useNetworkStatus.ts'
      );
      expect(clean).toHaveLength(0);
    });

    it('flags { shell: true } in scripts/ spawn/execFile calls while permitting shell: false array args', () => {
      const unsafeShell = runRuleOnCode(
        'no-dangerous-execution',
        `const { spawn } = require('child_process');
        spawn('tar', ['-xOjf', '-'], { shell: true });
        spawn('tar', ['-xOjf', '-'], { shell: false });`,
        'scripts/sync-custom.js'
      );
      expect(unsafeShell).toHaveLength(1);
      expect(unsafeShell[0].message).toContain('{ shell: true }');
    });
  });

  describe('5. no-unsafe-dom-injection', () => {
    it('flags dangerouslySetInnerHTML, .innerHTML, document.write, insertAdjacentHTML, JSX javascript: href, Reverse Tabnabbing target="_blank", and wildcard postMessage("*")', () => {
      const violations = runRuleOnCode(
        'no-unsafe-dom-injection',
        `export function BadComponent({ html, el }: { html: string; el: HTMLElement }) {
          el.innerHTML = html;
          document.write(html);
          el.insertAdjacentHTML('beforeend', html);
          window.postMessage({ type: 'PING' }, '*');
          return (
            <div>
              <div dangerouslySetInnerHTML={{ __html: html }} />
              <a href="javascript:alert(1)">Bad Link</a>
              <a href="https://example.com" target="_blank">Tabnabbing Link</a>
            </div>
          );
        }`,
        'src/components/reader/ReaderSurface.tsx'
      );
      expect(violations).toHaveLength(7);
      expect(violations.some((v) => v.message.includes('Cross-origin message leak (CWE-345)'))).toBe(true);
      expect(violations.some((v) => v.message.includes('dangerous "href" URI scheme'))).toBe(true);
      expect(violations.some((v) => v.message.includes('Reverse Tabnabbing risk (CWE-1022)'))).toBe(true);
    });

    it('permits <a target="_blank" rel="noopener noreferrer"> and explicit origin postMessage', () => {
      const clean = runRuleOnCode(
        'no-unsafe-dom-injection',
        `export function SafeComponent({ id }: { id: number }) {
          window.postMessage({ type: 'PING' }, window.location.origin);
          return (
            <div>
              <a href="https://www.gutenberg.org" target="_blank" rel="noopener noreferrer">Safe</a>
              <a href={'https://www.gutenberg.org/ebooks/' + id}>Safe Concat</a>
            </div>
          );
        }`,
        'src/components/presentation/Footer.tsx'
      );
      expect(clean).toHaveLength(0);
    });

    it('flags dynamic JSX href/src expressions with concatenated, conditional, logical, template, TS-cast, or split-constant dangerous URI schemes', () => {
      const violations = runRuleOnCode(
        'no-unsafe-dom-injection',
        `export function DynamicUriComponent({ path, ok, custom, payload }: { path: string; ok: boolean; custom: string; payload: string }) {
          return (
            <div>
              <a href={'javascript:' + path}>Concat Link</a>
              <img src={ok ? '/cover.jpg' : 'javascript:alert(1)'} alt="Conditional" />
              <a href={custom || 'vbscript:msgbox(1)'}>Logical Link</a>
              <iframe src={\`data:text/html,\${payload}\`} title="Template Frame" />
              <a href={('ja' + 'vascript:alert(1)') as string}>Split Cast Link</a>
            </div>
          );
        }`,
        'src/components/reader/ReaderSurface.tsx'
      );
      expect(violations).toHaveLength(5);
      expect(violations.filter((v) => v.message.includes('dangerous "href" URI scheme'))).toHaveLength(3);
      expect(violations.filter((v) => v.message.includes('dangerous "src" URI scheme'))).toHaveLength(2);
    });

    it('flags imperative setAttribute("srcdoc"|"href"|"src") XSS sinks and window.open(..., "_blank") missing noopener', () => {
      const violations = runRuleOnCode(
        'no-unsafe-dom-injection',
        `export function ImperativeDomComponent(el: HTMLElement, url: string) {
          el.setAttribute('srcdoc', '<script>alert(1)</script>');
          el.setAttribute('href', 'javascript:alert(1)');
          window.open(url, '_blank');
          window.open(url, '_blank', 'width=600,height=400');
          window.open(url, '_blank', 'noopener,noreferrer');
          el.setAttribute('href', 'https://www.gutenberg.org/ebooks/1342');
        }`,
        'src/components/reader/ReaderSurface.tsx'
      );
      expect(violations).toHaveLength(4);
      expect(violations.some((v) => v.message.includes(".setAttribute('srcdoc'"))).toBe(true);
      expect(violations.some((v) => v.message.includes('dangerous "href" URI scheme') && v.message.includes('setAttribute()'))).toBe(true);
      expect(violations.filter((v) => v.message.includes('Reverse Tabnabbing risk (CWE-1022)'))).toHaveLength(2);
    });
  });

  describe('6. no-tainted-request-sink (Intra-Procedural Request Taint Analysis)', () => {
    it('tracks taint from searchParams, headers, cookies, and request.json() to fetch, redirect, DB writes, shell, fs, external URLs, PostgREST .or(), and new RegExp()', () => {
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
          await supabase.from('books').select('*').or(\`title.ilike.%\${rawTarget}%\`);
          const rx = new RegExp(rawTarget);
          return rx;
        }`,
        'src/app/api/books/route.ts'
      );
      expect(violations).toHaveLength(10);
      expect(violations[0].message).toContain('reaches fetch() sink');
      expect(violations[1].message).toContain('reaches redirect() sink');
      expect(violations[2].message).toContain('reaches database write sink (.insert())');
      expect(violations[3].message).toContain('reaches shell command sink');
      expect(violations[4].message).toContain('reaches file system sink');
      expect(violations[5].message).toContain('reaches external URL navigation sink');
      expect(violations[6].message).toContain('reaches external URL sink (location.href)');
      expect(violations[7].message).toContain('Prototype Pollution risk');
      expect(violations[8].message).toContain('PostgREST Filter Injection CWE-943');
      expect(violations[9].message).toContain('dynamic new RegExp() constructor');
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

    it('tracks module-level process.argv CLI taint into shell and HTTP sinks while exempting sanitized CLI URLs and config file paths', () => {
      const cliViolations = runRuleOnCode(
        'no-tainted-request-sink',
        `const { exec } = require('child_process');
        const https = require('https');
        const rawUrl = process.argv[2];
        function run() {
          exec('open ' + rawUrl);
          https.get(rawUrl);
        }`,
        'scripts/unsafe-cli.js'
      );
      expect(cliViolations).toHaveLength(2);
      expect(cliViolations[0].message).toContain('CLI process.argv');
      expect(cliViolations[0].message).toContain('Command Injection');
      expect(cliViolations[1].message).toContain('CLI process.argv');
      expect(cliViolations[1].message).toContain('SSRF risk');

      const safeCli = runRuleOnCode(
        'no-tainted-request-sink',
        `const fs = require('fs');
        const https = require('https');
        const { spawn } = require('child_process');
        const rawUrl = process.argv[2];
        const safeUrl = sanitizeLocalDevUrl(rawUrl);
        const cachePath = process.argv[3];
        function run() {
          fs.readFileSync(cachePath);
          https.get(safeUrl);
          spawn('xdg-open', [safeUrl], { shell: false });
        }`,
        'scripts/open-browser.js'
      );
      expect(safeCli).toHaveLength(0);
    });

    it('enforces sink-scoped sanitization and catches cross-sink sanitizer misuse', () => {
      // 1. Cross-sink misuse: passing parseCatalogQuery into fetch() or NextResponse.redirect()
      const crossSinkViolations = runRuleOnCode(
        'no-tainted-request-sink',
        `import { NextResponse } from 'next/server';
        import { parseCatalogQuery } from '@/lib/catalog-query-parser';
        import { sanitizeRedirectPath } from '@/lib/redirect-sanitizer';
        export async function GET(request: Request) {
          const { searchParams } = new URL(request.url);
          const rawQ = searchParams.get('q') || '';
          const cleanQuery = parseCatalogQuery(rawQ);
          const safePath = sanitizeRedirectPath(searchParams.get('next'));

          // Misuse: cleanQuery (scoped to db/filter/query) passed to fetch() and redirect()
          await fetch(cleanQuery);
          NextResponse.redirect(cleanQuery);

          // Misuse: safePath (scoped to redirect/navigation) passed to PostgREST .or()
          await supabase.from('books').select('*').or(\`title.ilike.%\${safePath}%\`);
        }`,
        'src/app/api/books/route.ts'
      );
      expect(crossSinkViolations).toHaveLength(3);
      expect(crossSinkViolations[0].message).toContain('reaches fetch() sink');
      expect(crossSinkViolations[1].message).toContain('reaches redirect() sink');
      expect(crossSinkViolations[2].message).toContain('PostgREST Filter Injection CWE-943');

      // 2. Correct sink usage: parseCatalogQuery in .or(), sanitizeRedirectPath / stripRecoveryFromRedirectPath in redirect(), and sanitizeBookFormatUrl in fetch()
      const correctSink = runRuleOnCode(
        'no-tainted-request-sink',
        `import { NextResponse } from 'next/server';
        import { parseCatalogQuery } from '@/lib/catalog-query-parser';
        import { sanitizeRedirectPath, resolveCanonicalAuthOrigin, stripRecoveryFromRedirectPath } from '@/lib/redirect-sanitizer';
        import { sanitizeBookFormatUrl } from '@/lib/utils';
        export async function GET(request: Request) {
          const { searchParams, origin } = new URL(request.url);
          const rawQ = searchParams.get('q') || '';
          const cleanQuery = parseCatalogQuery(rawQ);
          const safePath = sanitizeRedirectPath(searchParams.get('next'));
          const safeOrigin = resolveCanonicalAuthOrigin(origin);
          const stripped = stripRecoveryFromRedirectPath(searchParams.get('next') || '');
          const safeBookUrl = sanitizeBookFormatUrl(searchParams.get('bookUrl') || '');

          await supabase.from('books').select('*').or(\`title.ilike.%\${cleanQuery}%\`);
          await fetch(safeBookUrl);
          if (stripped) {
            return NextResponse.redirect(new URL(stripped, safeOrigin));
          }
          return NextResponse.redirect(new URL(safePath, safeOrigin));
        }`,
        'src/app/api/books/route.ts'
      );
      expect(correctSink).toHaveLength(0);
    });

    it('tracks client useSearchParams() and document.referrer taint into router.push()/replace() while allowing static path prefixes, ROUTES builders, and sanitized paths', () => {
      const unsafeClientNav = runRuleOnCode(
        'no-tainted-request-sink',
        `'use client';
        import { useRouter, useSearchParams } from 'next/navigation';
        export function UnsafeRedirect({ router }: { router: ReturnType<typeof useRouter> }) {
          const rawNext = useSearchParams().get('next') || '/';
          const protocolRelativeRisk = \`/\${rawNext}\`;
          router.push(rawNext);
          router.replace(protocolRelativeRisk);
          router.push(document.referrer);
        }`,
        'src/components/auth/UnsafeRedirect.tsx'
      );
      expect(unsafeClientNav).toHaveLength(3);
      expect(unsafeClientNav.every((v) => v.message.includes('client navigation sink'))).toBe(true);

      const safeClientNav = runRuleOnCode(
        'no-tainted-request-sink',
        `'use client';
        import { useRouter, useSearchParams } from 'next/navigation';
        import { ROUTES } from '@/config/routes';
        import { sanitizeRedirectPath } from '@/lib/redirect-sanitizer';
        export function SafeRedirect({ router }: { router: ReturnType<typeof useRouter> }) {
          const searchParams = useSearchParams();
          const rawNext = searchParams.get('next') || '';
          const safePath = sanitizeRedirectPath(rawNext);
          router.push(safePath);
          router.replace(\`/read/\${rawNext}?page=1\`);
          router.push(\`\${ROUTES.ACCOUNT}?dir=\${rawNext}\`);
          router.push(ROUTES.VIEW(rawNext));
        }`,
        'src/components/auth/SafeRedirect.tsx'
      );
      expect(safeClientNav).toHaveLength(0);
    });
  });

  describe('7. no-secret-env-or-public-route-leak (Project Security Rules)', () => {
    it('flags NEXT_PUBLIC_ secret naming, service role usage in API routes, process.env serialization, missing RateLimiter, missing API security headers, and unsafe response cookie writes', () => {
      const violations = runRuleOnCode(
        'no-secret-env-or-public-route-leak',
        `import { NextResponse } from 'next/server';
        export async function GET(req: { url: string; cookies: { set: (n: string, v: string) => void } }) {
          const badPublicSecret = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
          const badPublicR2 = process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID;
          const srvRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const res = NextResponse.json(process.env);
          res.cookies.set('flag', '1', { path: '/' });
          req.cookies.set('inbound', '1');
          return res;
        }`,
        'src/app/api/books/route.ts'
      );
      expect(violations).toHaveLength(7);
      expect(violations.some((v) => v.message.includes('NEXT_PUBLIC_R2_ACCESS_KEY_ID'))).toBe(true);
      expect(violations.some((v) => v.message.includes('never prefix secret'))).toBe(true);
      expect(violations.some((v) => v.message.includes('must not reference SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
      expect(violations.some((v) => v.message.includes('Exposing raw process.env'))).toBe(true);
      expect(violations.some((v) => v.message.includes('must enforce rate limiting'))).toBe(true);
      expect(violations.some((v) => v.message.includes('must enforce buildApiSecurityHeaders()'))).toBe(true);
      expect(violations.some((v) => v.message.includes('Response cookies.set() options must declare explicit "sameSite" and protocol-aware "secure"'))).toBe(true);
    });

    it('passes compliant public API route handlers that invoke RateLimiter.check(), apply buildApiSecurityHeaders(), and set sameSite + secure cookies', () => {
      const clean = runRuleOnCode(
        'no-secret-env-or-public-route-leak',
        `import { NextRequest, NextResponse } from 'next/server';
        import { booksApiRateLimiter } from '@/lib/rate-limiter';
        import { buildApiSecurityHeaders, isHttpsRequest } from '@/lib/api-utils';
        export async function GET(request: NextRequest) {
          const limit = booksApiRateLimiter.check('127.0.0.1');
          if (!limit.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
          const res = NextResponse.json({ ok: true }, { headers: buildApiSecurityHeaders('same-origin') });
          res.cookies.set('ok', '1', { path: '/', sameSite: 'lax', secure: isHttpsRequest(request) });
          return res;
        }`,
        'src/app/api/books/route.ts'
      );
      expect(clean).toHaveLength(0);
    });

    it('flags arrow-function export const GET/POST API route handlers missing RateLimiter or buildApiSecurityHeaders while permitting compliant arrow handlers', () => {
      const badArrow = runRuleOnCode(
        'no-secret-env-or-public-route-leak',
        `import { NextResponse } from 'next/server';
        export const maxDuration = 30;
        export const GET = async () => NextResponse.json({ ok: true });`,
        'src/app/api/books/route.ts'
      );
      expect(badArrow).toHaveLength(2);
      expect(badArrow.some((v) => v.message.includes('must enforce rate limiting'))).toBe(true);
      expect(badArrow.some((v) => v.message.includes('must enforce buildApiSecurityHeaders()'))).toBe(true);

      const cleanArrow = runRuleOnCode(
        'no-secret-env-or-public-route-leak',
        `import { NextResponse } from 'next/server';
        import { booksApiRateLimiter } from '@/lib/rate-limiter';
        import { buildApiSecurityHeaders } from '@/lib/api-utils';
        export const maxDuration = 30;
        export const GET = async () => {
          booksApiRateLimiter.check('127.0.0.1');
          return NextResponse.json({ ok: true }, { headers: buildApiSecurityHeaders('same-origin') });
        };`,
        'src/app/api/books/route.ts'
      );
      expect(cleanArrow).toHaveLength(0);
    });
  });

  describe('8. no-focused-or-tautological-tests', () => {
    it('flags describe.only, it.only, expect(true).toBe(true), and zero-assertion test blocks in test files', () => {
      const violations = runRuleOnCode(
        'no-focused-or-tautological-tests',
        `describe.only('suite', () => {
          it.only('tautology', () => {
            expect(true).toBe(true);
          });
          it('zero assertion test', () => {
            const x = 1 + 1;
          });
        });`,
        'src/components/BookCard.test.tsx'
      );
      expect(violations).toHaveLength(4);
      expect(violations[3].message).toContain(
        'Zero-assertion test "zero assertion test" violates Rule 3'
      );
    });
  });

  describe('9. enforce-gutenberg-and-copyright-policy', () => {
    it('flags copyright=true query strings, URLSearchParams.set("copyright", "true"), direct fetch() to www.gutenberg.org, bare-hostname .includes("aleph.gutenberg.org"), and incomplete regex escaping .replace(/\\./g, "\\\\.")', () => {
      const violations = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export async function badCatalogFetch(url: string, ver: string) {
          const params = new URLSearchParams();
          params.set('copyright', 'true');
          await fetch('https://aleph.gutenberg.org/books?copyright=true');
          await fetch('https://www.gutenberg.org/cache/epub/1342/pg1342.txt');
          const badEscaped = ver.replace(/\\./g, '\\\\.');
          const badUnderscoreEscaped = ver.replace(/_/g, '\\\\_');
          if (url.includes('aleph.gutenberg.org') || badEscaped || badUnderscoreEscaped) {
            return null;
          }
        }`,
        'src/lib/catalog/supabase-provider.ts'
      );
      expect(violations).toHaveLength(6);
      expect(violations[0].message).toContain('setting "copyright" parameter to "true" is forbidden');
      expect(violations[1].message).toContain('"copyright=true" is forbidden');
      expect(violations[2].message).toContain('direct fetch() to www.gutenberg.org is forbidden');
      expect(violations[3].message).toContain('Incomplete string escaping or encoding (CodeQL CWE-116 / js/incomplete-sanitization)');
      expect(violations[4].message).toContain('Incomplete string escaping or encoding (CodeQL CWE-116 / js/incomplete-sanitization)');
      expect(violations[5].message).toContain('Incomplete URL substring sanitization (CodeQL CWE-20)');
    });

    it('permits copyright=false, mirror-prioritized fetches, single-column download_count ordering, and PK-bounded quote queries', () => {
      const clean = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export async function goodCatalogFetch(supabase: any, ids: number[]) {
          const params = new URLSearchParams();
          params.set('copyright', 'false');
          await fetch('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
          await supabase.from('books').select('*').order('download_count', { ascending: false });
          await supabase.from('books').select('id').in('id', ids).neq('quotes', '[]').order('download_count', { ascending: false });
        }`,
        'src/lib/catalog/supabase-provider.ts'
      );
      expect(clean).toHaveLength(0);
    });

    it('flags 78k-row index violations (Rule 10): chaining .order("id") onto .order("download_count") or combining .neq("quotes") with .order("download_count") without .in("id")', () => {
      const violations = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export async function badIndexQueries(supabase: any) {
          await supabase.from('books').select('*').order('download_count', { ascending: false }).order('id', { ascending: true });
          await supabase.from('books').select('*').neq('quotes', '[]').order('download_count', { ascending: false });
        }`,
        'src/lib/catalog/supabase-provider.ts'
      );
      expect(violations).toHaveLength(2);
      expect(violations[0].message).toContain('Chaining .order("id") onto .order("download_count")');
      expect(violations[1].message).toContain('Combining .neq("quotes", ...) with .order("download_count")');
    });

    it('flags external gutendex.com runtime URLs in production code while permitting DTO types and test fixtures (ADR-080)', () => {
      const prodViolations = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export interface GutendexBook { id: number; }
        export function toGutendexBook(book: GutendexBook) { return book; }
        export async function retiredFetch(id: number) {
          const direct = 'https://gutendex.com/books';
          return fetch(\`https://api.gutendex.com/books/\${id}\` + direct);
        }`,
        'src/lib/catalog/supabase-provider.ts'
      );
      expect(prodViolations).toHaveLength(2);
      expect(prodViolations[0].message).toContain('Retired external dependency (ADR-080)');
      expect(prodViolations[1].message).toContain('Retired external dependency (ADR-080)');

      const testViolations = runRuleOnCode(
        'enforce-gutenberg-and-copyright-policy',
        `export const fixture = 'https://gutendex.com/books/1342';`,
        'src/lib/catalog/supabase-provider.test.ts'
      );
      expect(testViolations).toHaveLength(0);
    });
  });

  describe('Full Codebase Standalone AST Security Audit', () => {
    it('verifies zero AST, parse, or taint violations across src/, scripts/, public/sw.js, and next.config.ts', () => {
      const rootDir = path.resolve(__dirname, '../..');
      const violations = bookariumSecurity.runStandaloneAstSecurityAudit(rootDir);
      expect(violations).toEqual([]);
    }, 30000);
  });
});

