# Security Policy

The Bookarium engineering team takes the security and integrity of our application, user data, and public domain catalog seriously. This policy outlines supported versions and our responsible disclosure protocol.

---

## Supported Versions

Security patches, dependency updates, and bug fixes are applied to the active release stream on the `master` branch.

| Version | Supported | Notes |
|---|:---:|---|
| **2.8.x** | ✅ | **Active Release** (Recommended for all users and deployments) |
| < 2.8.0 | ❌ | Older releases are not actively maintained; please upgrade to the latest release |

---

## Reporting a Vulnerability

If you discover a security vulnerability, security bug, or potential data exposure in **Bookarium**, please disclose it responsibly.

### ⚠️ Please Do NOT Open a Public Issue
Never disclose potential security vulnerabilities through public GitHub issues, pull requests, or public discussions.

### Preferred Reporting Method: GitHub Private Vulnerability Advisories
GitHub provides a secure, private advisory workflow for public repositories:
1. Navigate to [**github.com/calin-m/Bookarium/security/advisories**](https://github.com/calin-m/Bookarium/security/advisories).
2. Click **Report a vulnerability**.
3. Provide a detailed summary, including:
   - Description of the vulnerability and its potential impact
   - Clear, reproducible proof-of-concept steps or payload
   - Browser environment, device, or API endpoints affected
   - Any suggested remediations or patches

### Response Timeline
- **Initial Acknowledgement**: Within 48 hours of receiving the report.
- **Triage & Assessment**: Within 5 business days, confirming severity and validity.
- **Resolution & Release**: A security patch will be prepared on a private branch and released alongside an official CVE/GitHub Security Advisory once verified.

---

## Security Architecture & Core Safeguards

Bookarium incorporates multi-layered security controls designed into its architecture:

1. **Zero Secret Footprint, Env Parity & Transitive Boundary Isolation (Pass 0.5 Scanner)**:
   - Automated pre-commit scanning (`scripts/verify-build.js`) prevents accidental commits of API keys, RSA/EC/OpenSSH private keys, fine-grained GitHub PATs (`github_pat_`), Supabase tokens (`sbp_`, `sbs_`, `sb_secret_`), Base64URL-decoded Supabase `service_role` JWTs, Slack/Discord webhooks, PostgreSQL connection strings with embedded credentials, tracked `.env*`/`.pem`/`.key` files, oversized binaries (`> 5 MB`), undocumented `NEXT_PUBLIC_*` variables (verified against `.env.example`), or direct/transitive client$\to$server AST dependency leaks (`src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `next/headers`, `fs`, `child_process`, `zlib`, `net`, `tls`).
2. **7-Pillar OWASP Pre-Commit SAST, Supply-Chain & 9-Rule AST Taint Suite (Pass 0.75)**:
   - Automated pre-commit gates (`npm run security:audit` and `scripts/eslint-rules/bookarium-security.js`) enforce seven security pillars alongside a custom 9-rule ESLint & Babel AST security engine:
     1. **Supply-Chain Lockfile Sanity, GitHub Actions Workflow Guard & CVE Audit**: Enforces `package-lock.json` `lockfileVersion >= 3`, `sha512-` SRI integrity digests, `https://registry.npmjs.org/` resolution origins, and `package.json` specifier synchronization; scans `.github/workflows/*.yml` against direct `${{ github.event.* }}` shell interpolation in `run:` blocks and floating `@main`/`@master` action tags; and runs `npm audit --omit=dev --audit-level=high` (`0` High/Critical CVEs).
     2. **API Route Rate Limiting & Redirect-Hop SSRF Guard (`no-unsafe-fetch`)**: Verifies `RateLimiter.check()` and manual redirect-hop validation (`redirect: 'manual'`, `isSafeUpstreamUrl()`) across `/api/books/content`, `/api/books`, and `/api/books/translations`, confining upstream requests strictly to the approved Project Gutenberg mirror allowlist (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, `www.gutenberg.org`, `gutenberg.org`) and Gutendex.
     3. **DOM XSS & Code Execution Guard (`no-dangerous-execution`, `no-unsafe-dom-injection`)**: Blocks `eval()`, `new Function()`, string-based `setTimeout`/`setInterval`, shell execution in `src/`, `dangerouslySetInnerHTML`, `.innerHTML =`, `.outerHTML =`, `iframe.srcdoc`, `document.write()`, `.insertAdjacentHTML()`, and `.createContextualFragment()`.
     4. **Open Redirect Sanitization & Intra-Procedural Request Taint Analysis (`no-unvalidated-redirect`, `no-tainted-request-sink`)**: Enforces `sanitizeRedirectPath` and `resolveCanonicalAuthOrigin` (`src/lib/redirect-sanitizer.ts`) on all redirects and performs flow-sensitive AST taint tracking from request sources (`request params`, `searchParams.get()`, `headers.get()`, `cookies.get()`, `request.json()`) to sensitive sinks (`fetch`, `redirect`, database writes, shell commands, file system access, external URLs, and dynamic computed property writes / Prototype Pollution).
     5. **MIT License, Public Domain (`copyright=false`) & Gutenberg Mirror Policy (`enforce-gutenberg-and-copyright-policy`)**: Verifies `package.json` MIT licensing, blocks `copyright=true` in query strings or `URLSearchParams`, and forbids direct `fetch('https://www.gutenberg.org/...')` calls that bypass official mirror prioritization.
     6. **PostgreSQL Row Level Security (RLS), Migration Idempotency & `SECURITY DEFINER` Hardening**: Statically verifies `ENABLE ROW LEVEL SECURITY` across all 13 public tables (14 total with `supabase_migrations.schema_migrations`), 100% DDL/policy/trigger idempotency (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`), scoped write-RLS isolation, `SET search_path = ''` across all `SECURITY DEFINER` functions in `supabase/schema.sql`, and 1:1 table/column parity with `src/types/database.types.ts` (`Pass 5`).
     7. **OWASP HTTP Security Headers & Service Worker Cache Guard**: Verifies all 7 hardened security headers (`Content-Security-Policy` with production `unsafe-eval` stripping, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`) in `next.config.ts` and verifies `public/sw.js` bypasses non-GET requests and `/auth/callback`.
3. **Continuous Cloud Code Scanning (GitHub CodeQL)**:
   - GitHub Actions automated analysis continuously inspects all commits to `master` for semantic code flaws, security regressions, and tainted data flows.
4. **PostgreSQL Row Level Security (RLS)**:
   - Cloud synchronization utilizes Supabase PostgreSQL with strict RLS policies (`auth.uid() = user_id`, participant isolation, and read-only public catalog policies) across all 13 tables: `public.books`, `public.book_translations`, `public.profiles`, `public.bookshelves`, `public.bookshelf_items`, `public.user_favorites`, `public.reading_progress`, `public.user_annotations`, `public.user_book_curation`, `public.user_reading_habits`, `public.user_accolades`, `public.reader_circles`, and `public.symposium_sessions`. Users cannot read, mutate, or delete private records belonging to other accounts.
5. **Public Domain Integrity & Safe Ingestion**:
   - All catalog queries strictly enforce `copyright=false`. Ingested Gutenberg texts are parsed through isolated Web Workers and sanitized reflow algorithms to guard against script injection (XSS).
6. **Offline-First Data Isolation**:
   - Stored books, notes, and reading positions reside in client-side browser storage (`localStorage` and `IndexedDB`) and are never exposed to untrusted third-party trackers or ad networks.

