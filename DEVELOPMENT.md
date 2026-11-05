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
npm test

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
npm run verify

# Standalone pre-commit security, SAST, AST taint & governance audit
npm run security:audit

# Sync Living Documentation (AST Matrix, Gutenberg Parser docs, Quality Report, Roadmap, and Changelog)
npm run docs:sync

# Quality audit report (Pass 4 engine audit)
npm run report

# Add a new Architecture Decision Record (ADR)
npm run adr:new -- "Decision Title"

# Public Domain Catalog Ingestion, Quotes & Translation Pipelines
npm run catalog:sync
npm run catalog:ingest
npm run translations:sync
npm run quotes:sync
```

---

## 🔐 Environment Variables & Secrets Reference

Configure these variables in `.env.local` for local development, in **Vercel Project Settings** for web deployments, and in **GitHub Secrets** for automated GitHub Actions workflows.

### 📋 Platform-by-Platform Placement Checklist

| Target Platform | What Goes Here | How to Set Up |
| :--- | :--- | :--- |
| 🚀 **Vercel Project Settings**<br>*(Production Web App)* | • `NEXT_PUBLIC_SITE_URL`<br>• `NEXT_PUBLIC_SUPABASE_URL`<br>• `NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>• `NEXT_PUBLIC_GITHUB_REPO` *(Optional)*<br>• `NEXT_PUBLIC_TURNSTILE_SITE_KEY` *(Optional)*<br>• `NEXT_PUBLIC_LEGAL_CONTACT_FORM` *(Optional)* | Go to **Vercel Dashboard $\to$ Project $\to$ Settings $\to$ Environment Variables**. Ensure all variables needed by browser visitors and edge routes are set. |
| ⚙️ **GitHub Actions Secrets**<br>*(Automated Cron / CI Sync)* | • `NEXT_PUBLIC_SUPABASE_URL`<br>• `SUPABASE_SERVICE_ROLE_KEY`<br>• `GUTENBERG_CONTACT_EMAIL` *(Optional)* | Go to **GitHub Repository $\to$ Settings $\to$ Secrets and variables $\to$ Actions $\to$ New repository secret**. Used by background catalog, quote, and translation workflows. |
| 💻 **Local `.env.local`**<br>*(Development Machine)* | • All public `NEXT_PUBLIC_*` variables<br>• `SUPABASE_SERVICE_ROLE_KEY` *(if running local sync)*<br>• `GUTENBERG_CONTACT_EMAIL` *(Optional)* | Copy `.env.example` to `.env.local`. This file is gitignored and stays strictly on your computer. |
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
| **`NEXT_PUBLIC_SITE_URL`** | Your production domain (e.g. `https://bookarium.vercel.app`) | • `.env.local`<br>• Vercel Project Settings | **Public Origin**: Canonical origin for OpenGraph social preview images, sitemaps, and shareable links. |
| **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** | [Cloudflare Dashboard](https://dash.cloudflare.com/) $\to$ Turnstile $\to$ Add Site | • `.env.local` *(Optional)*<br>• Vercel Project Settings *(Optional)* | **Public Bot Protection**: Renders Cloudflare Turnstile challenge on the auth modal to prevent automated account spam. |
| **`NEXT_PUBLIC_LEGAL_CONTACT_FORM`** | Any external form link (Google Forms, Tally, Formspree) | • `.env.local` *(Optional)*<br>• Vercel Project Settings *(Optional)* | **Optional Intake**: Link displayed on `/copyright` for DMCA/jurisdictional requests. Falls back to GitHub Issues if blank. |
| **`GUTENDEX_API_URL`** | Custom Gutendex instance URL | • `.env.local` *(Optional)*<br>• Vercel Project Settings *(Optional)* | **API Override**: Overrides default public Gutendex endpoint (`https://gutendex.com/books`). |
| **`DEV_COUNTRY`** | ISO 3166-1 alpha-2 code (`US`, `RO`, `DE`, `MX`, `GB`) | • `.env.local` only *(Dev)* | **Dev Override**: Simulates reading from specific countries to test multi-jurisdictional copyright rules (`Life+70`, `Life+80`, `Life+100`). |
