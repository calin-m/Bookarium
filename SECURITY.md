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

1. **Zero Secret Footprint (Pass 0.5 Scanner)**:
   - Automated pre-commit scanning (`scripts/verify-build.js`) strictly prevents accidental commits of API keys, RSA/EC/OpenSSH private keys, fine-grained GitHub PATs (`github_pat_`), Supabase tokens (`sbp_`, `sbs_`), Slack/Discord webhooks, database connection strings, or client-bundle leaks of `SUPABASE_SERVICE_ROLE_KEY`.
2. **7-Pillar OWASP Pre-Commit SAST & Dependency Security Suite (Pass 0.75)**:
   - Automated pre-commit gates (`npm run security:audit`) enforce seven static and dependency security pillars:
     1. **Production Dependency Audit (`npm audit --omit=dev --audit-level=high`)**: Blocks high and critical CVEs across runtime dependencies.
     2. **API Route Rate Limiting & Redirect-Hop SSRF Guard**: Verifies `RateLimiter.check()` and manual redirect-hop validation (`redirect: 'manual'`) across `/api/books/content` and `/api/books`, confining upstream requests strictly to the approved Project Gutenberg mirror allowlist (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, `www.gutenberg.org`, `gutenberg.org`) and Gutendex.
     3. **DOM XSS & Code Execution Guard**: Blocks `eval()`, `new Function()`, string-based `setTimeout`/`setInterval`, `dangerouslySetInnerHTML`, `.innerHTML =`, `.outerHTML =`, `document.write()`, and `.insertAdjacentHTML()`.
     4. **Open Redirect Sanitization**: Enforces relative-path redirect validation (`startsWith('/') && !startsWith('//')`) in `/auth/callback`.
     5. **MIT License & Public Domain (`copyright=false`) Integrity**: Verifies `package.json` MIT licensing and mandatory `copyright=false` upstream filtering.
     6. **PostgreSQL Row Level Security (RLS) & `SECURITY DEFINER` Hardening**: Statically verifies `ENABLE ROW LEVEL SECURITY` across all 13 public tables and `SET search_path = ''` across all `SECURITY DEFINER` RPC and trigger functions in `supabase/schema.sql`.
     7. **OWASP HTTP Security Headers**: Verifies all 7 hardened security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`) in `next.config.ts`.
3. **Continuous Cloud Code Scanning (GitHub CodeQL)**:
   - GitHub Actions automated analysis continuously inspects all commits to `master` for semantic code flaws, security regressions, and tainted data flows.
4. **PostgreSQL Row Level Security (RLS)**:
   - Cloud synchronization utilizes Supabase PostgreSQL with strict RLS policies (`auth.uid() = user_id`, participant isolation, and read-only public catalog policies) across all 13 tables: `public.books`, `public.book_translations`, `public.profiles`, `public.bookshelves`, `public.bookshelf_items`, `public.user_favorites`, `public.reading_progress`, `public.user_annotations`, `public.user_book_curation`, `public.user_reading_habits`, `public.user_accolades`, `public.reader_circles`, and `public.symposium_sessions`. Users cannot read, mutate, or delete private records belonging to other accounts.
5. **Public Domain Integrity & Safe Ingestion**:
   - All catalog queries strictly enforce `copyright=false`. Ingested Gutenberg texts are parsed through isolated Web Workers and sanitized reflow algorithms to guard against script injection (XSS).
6. **Offline-First Data Isolation**:
   - Stored books, notes, and reading positions reside in client-side browser storage (`localStorage` and `IndexedDB`) and are never exposed to untrusted third-party trackers or ad networks.

