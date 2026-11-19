# Development Guide - Bookarium

## Getting Started

### Prerequisites
- Node.js 22+ (Node 22 LTS or Node 24 LTS recommended)
- npm 10+

### Installation
```bash
npm install
```

### Running the Development Server
```bash
npm run dev:open
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Tests
```bash
# Run unit tests with V8 code coverage (enforcing tiered thresholds: Lines >= 95%, Statements >= 95%, Functions >= 92%, Branches >= 85%)
npm test                      # Alias: npm run test:coverage

# Run tests quickly without coverage overhead
npm run test:fast

# Run pre-commit security, SAST, AST taint & governance audit (Passes 0.5, 0.75 & 5)
npm run security:audit

# Run interactive Vitest UI
npm run test:ui

# Run tests in watch mode
npm run test:watch
```

### Automated Governance & Quality Checks
```bash
# Full 7-Gateway Quality Engine (Passes 0.5, 0.75, and 1 - 7)
npm run verify                # CI alias: npm run verify:build

# Standalone pre-commit security, SAST, AST taint & governance audit
npm run security:audit

# Combined ESLint (--max-warnings 0) & Knip dead-code check
npm run audit:detailed

# Sync Living Documentation (AST Matrix, System Contracts `@scope`/`@invariant`, Gutenberg Parser docs, Quality Report, Roadmap, and Changelog)
npm run docs:sync
npm run docs:contracts

# Quality audit report (Pass 4 engine audit; alias: npm run audit:quality)
npm run report

# Public Domain Catalog Ingestion, R2 Asset Sync, Content Scan, Quotes & Translation Pipelines
npm run catalog:sync
npm run r2:sync
npm run r2:scan
npm run catalog:ingest
npm run translations:sync
npm run quotes:sync
```

> ⚡ **GitHub Actions & Edge Cache Automation**: For all 11 GitHub Actions workflows (triggers, `workflow_dispatch` inputs, required/optional secrets, `catalog-cache` release bootstrap, CodeQL/Dependency Review gates, R2 integrity scans, and manual `Vercel-Cache-Tag` purges), see [**`docs/GITHUB_ACTIONS.md`**](docs/GITHUB_ACTIONS.md). For the 7-Gateway Quality Engine and console telemetry formats, see [**`docs/PIPELINE_GUIDE.md`**](docs/PIPELINE_GUIDE.md).

---

## 🔐 Environment Variables & Secrets Reference

Configure these variables in `.env.local` for local development, in **Vercel Project Settings** for web deployments, and in **GitHub Secrets** (detailed per workflow in [**`docs/GITHUB_ACTIONS.md`**](docs/GITHUB_ACTIONS.md#-2-prerequisites-secrets--cache-infrastructure)) for automated GitHub Actions workflows. For Mode `0`–`2` hosting options, Free vs. Paid provider limits, and hard platform coding guardrails, see [**`docs/INFRASTRUCTURE.md`**](docs/INFRASTRUCTURE.md).

### 📋 Platform-by-Platform Placement Checklist

| Target Platform | What Goes Here | How to Set Up |
| :--- | :--- | :--- |
| 🚀 **Vercel Project Settings**<br>*(Production Web App)* | • `NEXT_PUBLIC_SITE_URL`<br>• `NEXT_PUBLIC_SUPABASE_URL` *(Required for 78k+ catalog & Auth)*<br>• `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(Required for 78k+ catalog & Auth)*<br>• `R2_ACCOUNT_ID` *(Required for online covers & `.txt` reading)*<br>• `R2_BUCKET_NAME` *(Required for online covers & `.txt` reading)*<br>• `R2_ACCESS_KEY_ID` *(Required, Read-Only S3 key)*<br>• `R2_SECRET_ACCESS_KEY` *(Required, Read-Only signing secret)*<br>• `NEXT_PUBLIC_GITHUB_REPO` *(Optional)*<br>• `NEXT_PUBLIC_TURNSTILE_SITE_KEY` *(Optional)*<br>• `NEXT_PUBLIC_LEGAL_CONTACT_FORM` *(Optional)*<br>• `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` *(Optional)* | Go to **Vercel Dashboard $\to$ Project $\to$ Settings $\to$ Environment Variables**. Required for full online deployments (missing `R2_*` fails closed with `404`/`503`). *Note: Hosting the full 78k+ R2 corpus (~25+ GB) exceeds Cloudflare R2's 10 GB free storage quota.* |
| ⚙️ **GitHub Actions Secrets**<br>*(Automated Cron / CI Sync)* | • `NEXT_PUBLIC_SUPABASE_URL`<br>• `SUPABASE_SERVICE_ROLE_KEY`<br>• `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` *(Bucket-scoped Read & Write required for `r2-sync.yml` and R2 steps in `catalog-sync.yml` / `quotes-sync.yml`)*<br>• `GUTENBERG_CONTACT_EMAIL` *(Optional)*<br>• `VERCEL_API_TOKEN` *(Optional, recommended)*<br>• `VERCEL_PROJECT_ID` *(Optional, recommended)*<br>• `VERCEL_TEAM_ID` *(Optional, team/personal team)* | Go to **GitHub Repository $\to$ Settings $\to$ Secrets and variables $\to$ Actions $\to$ New repository secret**. Used by background catalog, R2 asset, quote, translation, and Edge cache purge workflows. |
| 💻 **Local `.env.local`**<br>*(Development Machine)* | • Public `NEXT_PUBLIC_*` variables & `R2_*` *(Optional for offline UI tests / curated preview; **Required** to test live Supabase catalog & R2 cover/text streaming locally)*<br>• `SUPABASE_SERVICE_ROLE_KEY` *(if running local sync)*<br>• `GUTENBERG_CONTACT_EMAIL` *(Optional)* | Copy `.env.example` to `.env.local`. This file is gitignored and stays strictly on your computer. |
| 🔑 **Supabase Dashboard**<br>*(Where to obtain keys)* | • `NEXT_PUBLIC_SUPABASE_URL` *(Project URL)*<br>• `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(anon public key)*<br>• `SUPABASE_SERVICE_ROLE_KEY` *(service_role secret key)* | Open your **Supabase Dashboard $\to$ Project Settings $\to$ API**. Copy keys from *Project API Keys*. |

### 📖 Complete Environment Variables Reference

| Environment Variable | Where to Obtain | Where to Configure | Security Scope & Purpose |
| :--- | :--- | :--- | :--- |
| **`NEXT_PUBLIC_SUPABASE_URL`** | Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ *Project URL* | • `.env.local`<br>• Vercel Project Settings<br>• GitHub Actions Secrets | **Public URL**: Connects client components and backend CLI engines to your PostgreSQL catalog (`public.books`). |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ *anon / public* key | • `.env.local`<br>• Vercel Project Settings | **Public Client Key**: Scoped strictly by PostgreSQL Row Level Security (RLS) for public catalog reads and authenticated user sync. *(Never needed on GitHub).* |
| **`NEXT_PUBLIC_GITHUB_REPO`** | Your hosted Git repository link (e.g. `https://github.com/<owner>/<repo>`) | • Vercel Project Settings *(Optional)*<br>• `.env.local` *(Optional)* | **Public Repository Link**: Dynamically sets the repository destination for the Navbar GitHub icon, Footer links, and DMCA issue intake. Auto-detected from Git/Vercel/CI if omitted. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ *service_role* key | • `.env.local`<br>• GitHub Actions Secrets | ⚠️ **Admin Secret (CLI Only)**: Bypasses RLS to batch-upsert catalog, quote, and translation data. **NEVER expose to Vercel or client browser bundles.** |
| **`GUTENBERG_CONTACT_EMAIL`** | Your personal or organization contact email | • `.env.local`<br>• GitHub Actions Secrets *(Optional)* | **Optional Contact**: Appended to automated `User-Agent` headers across Project Gutenberg mirrors and Wikidata. If omitted, cleanly falls back to the public repository URL. |
| **`BOOKARIUM_REPO_URL`** | Your Git repository link (e.g. `https://github.com/<owner>/<repo>`) | • `.env.local` *(Optional)*<br>• Vercel / CI *(Optional)* | **Optional Override**: Overrides automatic repository discovery (`GITHUB_REPOSITORY` on CI, `VERCEL_GIT_REPO_*` on Vercel) for `User-Agent` contact headers. |
| **`VERCEL_API_TOKEN`** | Vercel Dashboard $\to$ Account Settings $\to$ *Tokens* | • GitHub Actions Secrets *(Optional, recommended)* | **Optional CI Edge Cache Purge Token**: Authenticates `scripts/purge-vercel-cache.js` (`POST /v1/edge-cache/dangerously-delete-by-tags?projectIdOrName={projectId}`) at the end of non-dry-run catalog, quote, translation, and conditional `r2-sync.yml` (`covers`, `book-content`) runs as well as manual `cache-purge.yml` dispatches (`exit 0` skip if unset). |
| **`VERCEL_PROJECT_ID`** | Vercel Dashboard $\to$ Project $\to$ Settings $\to$ General $\to$ *Project ID* (`prj_...`) | • GitHub Actions Secrets *(Optional, recommended)* | **Optional CI Edge Cache Project ID**: Identifies the Vercel project whose `Vercel-Cache-Tag` entries (`catalog`, `quotes`, `translations`, `covers`, `book-content`) should be purged after ingestion or R2 overwrites/deletions. |
| **`VERCEL_TEAM_ID`** | Vercel Dashboard $\to$ Team Settings $\to$ General $\to$ *Team ID* (`team_...`) | • GitHub Actions Secrets *(Optional)* | **Optional CI Edge Cache Team ID**: Appends `&teamId=...` to the Vercel tag-purge API request when your project lives inside a Vercel Team or Hobby personal team scope. |
| **`NEXT_PUBLIC_SITE_URL`** | Canonical production origin (e.g. `https://your-domain.com`); falls back automatically via `NEXT_PUBLIC_SITE_URL` $\to$ `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` $\to$ SSR-only `VERCEL_PROJECT_PRODUCTION_URL` $\to$ `https://bookarium.vercel.app` | • `.env.local`<br>• Vercel Project Settings | **Public Origin**: Canonical origin for OpenGraph social preview images, sitemaps, reading card host footers, PKCE auth callbacks, and shareable links. |
| **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** | [Cloudflare Dashboard](https://dash.cloudflare.com/) $\to$ Turnstile $\to$ Add Site | • `.env.local` *(Optional)*<br>• Vercel Project Settings *(Optional)* | **Public Bot Protection**: Renders Cloudflare Turnstile challenges on `AuthModal`, `EmailSentView` resends, and `/account` recovery/verification flows when configured to prevent automated account spam. |
| **`NEXT_PUBLIC_LEGAL_CONTACT_FORM`** | Any external form link (Google Forms, Tally, Formspree) | • `.env.local` *(Optional)*<br>• Vercel Project Settings *(Optional)* | **Optional Intake**: Link displayed on `/copyright` for DMCA/jurisdictional requests. Falls back to GitHub Issues if blank. |
| **`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`** | [Google Search Console](https://search.google.com/search-console) $\to$ Add Property (`URL prefix`) $\to$ HTML tag `content` value | • Vercel Project Settings *(Optional)*<br>• `.env.local` *(Optional)* | **Domain Ownership Verification**: Dynamically emits `<meta name="google-site-verification" content="..." />` in root metadata without hardcoding verification tokens. |
| **`DEV_COUNTRY`** | ISO 3166-1 alpha-2 code (`US`, `RO`, `DE`, `MX`, `GB`) | • `.env.local` only *(Dev)* | **Dev Override**: Simulates reading from specific countries to test multi-jurisdictional copyright rules (`Life+70`, `Life+80`, `Life+100`). |
| **`R2_ACCOUNT_ID`** | Cloudflare Dashboard $\to$ R2 Overview $\to$ *Account ID* | • Vercel Project Settings *(Required for online covers/texts)*<br>• GitHub Secrets / `.env.local` | **Server-Only R2 Endpoint Identifier**: Builds private S3 endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` inside `src/lib/r2-client.ts`. Missing `R2_*` fails closed (`404` covers / `503` uncached texts); full 78k+ catalog exceeds R2's 10 GB free-tier allowance. |
| **`R2_BUCKET_NAME`** | Cloudflare Dashboard $\to$ R2 $\to$ Bucket Name (e.g. `bookarium-assets`) | • Vercel Project Settings *(Required for online covers/texts)*<br>• GitHub Secrets / `.env.local` | **Server-Only R2 Bucket Name**: Targets `covers/<id>.jpg` and `books/<id>.txt.gz` inside private R2 storage via `/api/books/content` (zero runtime PG fallback). |
| **`R2_ACCESS_KEY_ID`** | Cloudflare Dashboard $\to$ R2 $\to$ Manage R2 API Tokens *(Read-Only in Vercel / Read & Write in GitHub Secrets)* | • Vercel Project Settings *(Required, Read-Only)*<br>• GitHub Actions Secrets *(Read/Write)*<br>• `.env.local` | **Server-Only S3 Access Key**: Signs AWS SigV4 `GET` requests in Vercel/local `r2-client.ts` & `sync-featured-quotes.js` and `List`/`Put`/`Delete` operations in `sync-r2-assets.js`. |
| **`R2_SECRET_ACCESS_KEY`** | Cloudflare Dashboard $\to$ R2 $\to$ Manage R2 API Tokens *(Read-Only in Vercel / Read & Write in GitHub Secrets)* | • Vercel Project Settings *(Required, Read-Only)*<br>• GitHub Actions Secrets *(Read/Write)*<br>• `.env.local` | ⚠️ **Server-Only Signing Secret**: Derives `AWS4-HMAC-SHA256` keys for private R2 asset reads (`type=cover` & `.txt.gz` streams) and CI asset synchronization. |

---

## 🔑 Google OAuth & Account Linking Setup (Supabase Dashboard & Google Cloud Console)

Bookarium's **Continue with Google** sign-in and **Connected Accounts** linking/unlinking require **zero repository or `.env.local` secrets**. All OAuth credentials live strictly inside your Supabase Dashboard:

1. **Google Cloud Console (`APIs & Services -> Credentials`)**:
   - Create an **OAuth client ID** (`Web application`).
   - **Authorized redirect URIs**: Add your Supabase OAuth callback URL:
     ```text
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - **Authorized JavaScript origins**: Set to your production domain (`https://<your-production-domain>`) or leave blank (`http://localhost:3000` is not needed in Google Cloud Console because Supabase brokers the OAuth redirect server-side).
2. **Supabase Dashboard (`Authentication -> Providers -> Google`)**:
   - Toggle **Enable Sign in with Google** to **ON** and paste your **Client ID** and **Client Secret**.
   - Keep **Skip nonce checks** and **Allow users without an email** **OFF** to enforce full OIDC replay protection and verified email requirements.
3. **Supabase Dashboard (`Authentication -> User Signups` & `URL Configuration`)**:
   - Toggle **Enable Manual Linking** to **ON** so authenticated users can manually connect or disconnect Google inside `/account?tab=security`.
   - Under **Redirect URLs**, include your exact production callback (`https://<your-production-domain>/auth/callback`) and local callback (`http://localhost:3000/auth/callback`).
   - *(Optional — Cross-Device Password Reset Links)*: Default Supabase `{{ .ConfirmationURL }}` / `{{ .RedirectTo }}` recovery templates use PKCE, which requires opening the reset link in the same browser that requested it (and intentionally preserves `http://localhost:3000` when requested from local Next.js, whereas `{{ .SiteURL }}` uses Supabase's configured Site URL). To support stateless cross-device recovery links (e.g. requesting on desktop and opening on mobile mail), customize **Authentication -> Email Templates -> Reset Password** to link via token-hash OTP: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue` (for local testing, substitute `{{ .RedirectTo }}` or keep `{{ .ConfirmationURL }}` during local-only PKCE flows).

---

## ☁️ Private Cloudflare R2 Storage & Dual-Token Setup

Bookarium proxies book covers (`covers/<id>.jpg`) and gzipped plain-text books (`books/<id>.txt.gz`) strictly from private Cloudflare R2 storage with zero runtime fallback to Project Gutenberg mirrors:

1. **Create a Private Bucket (`bookarium-assets`)**:
   - In **Cloudflare Dashboard $\to$ R2 Object Storage**, create your bucket (e.g., `bookarium-assets`).
   - Keep **Public Development URL (`r2.dev`)** and custom public domains **disabled** so all covers and texts flow exclusively through `/api/books/content` (`HTTP 451` jurisdiction checks and rate limits).
2. **Generate Least-Privilege API Tokens (`Manage R2 API Tokens`)**:
   - **Vercel / Runtime Token (Read-Only)**: Grant `Object Read only` scoped to your bucket; set `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in **Vercel Project Settings** (and optionally local `.env.local` to stream online volumes locally).
   - **GitHub Actions / CLI Token (Read & Write)**: Grant `Object Read & Write` scoped strictly to your bucket; store `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in **GitHub Repository Secrets** for `npm run r2:sync` and `catalog-sync.yml`.
3. **Seed Initial Corpus & Storage Sizing Note**:
   - Hosting the complete 78,000+ catalog text + cover corpus exceeds Cloudflare R2's `10 GB` free storage quota (`~25+ GB` — see [**`docs/INFRASTRUCTURE.md`**](docs/INFRASTRUCTURE.md) for Mode `0`–`2` tiers and Free vs. Paid provider bounds).
   - Run `npm run catalog:sync -- --cache-file=gutenberg-catalog-cache.json.gz` followed by `npm run r2:sync -- --cache-file=gutenberg-catalog-cache.json.gz --source=rsync --rsync-host=auto` (or `--rsync-host=ibiblio` for large initial backfills on Linux/macOS/CI; `--source=wsl-rsync` or `--source=https --ids=...` on Windows) to populate initial volumes before going live.

