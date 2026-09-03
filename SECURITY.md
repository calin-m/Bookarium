# Security Policy

The Bookarium engineering team takes the security and integrity of our application, user data, and public domain catalog seriously. This policy outlines supported versions and our responsible disclosure protocol.

---

## Supported Versions

Security patches, dependency updates, and bug fixes are applied to the active release stream on the `master` branch.

| Version | Supported | Notes |
|---|:---:|---|
| **1.9.x** | ✅ | **Active Release** (Recommended for all users and deployments) |
| < 1.9.0 | ❌ | Older releases are not actively maintained; please upgrade to the latest release |

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
   - Automated pre-commit scanning (`scripts/verify-build.js`) strictly prevents accidental commits of API keys, private keys, database connection strings, or credentials.
2. **OWASP Pre-Commit SAST & Dependency Security Suite (Pass 0.75)**:
   - Automated pre-commit gates block high/critical dependency CVEs (`npm audit`), statically prevent SSRF taint flows in API routes, guarantee zero XSS evaluation primitives (`eval`, `new Function`, `dangerouslySetInnerHTML`), enforce internal redirect sanitization, and verify MIT license compliance. Run standalone via `npm run security:audit`.
3. **Continuous Cloud Code Scanning (GitHub CodeQL)**:
   - GitHub Actions automated analysis continuously inspects all commits to `master` for semantic code flaws, security regressions, and tainted data flows.
4. **PostgreSQL Row Level Security (RLS)**:
   - Cloud synchronization utilizes Supabase PostgreSQL with strict RLS policies (`auth.uid() = user_id`) on `public.user_bookshelves` and `public.user_annotations`. Users cannot read, mutate, or delete records belonging to other accounts.
5. **Public Domain Integrity & Safe Ingestion**:
   - All catalog queries strictly enforce `copyright=false`. Ingested Gutenberg texts are parsed through isolated Web Workers and sanitized reflow algorithms to guard against script injection (XSS).
6. **Offline-First Data Isolation**:
   - Stored books, notes, and reading positions reside in client-side browser storage (`localStorage` and `IndexedDB`) and are never exposed to untrusted third-party trackers or ad networks.

