# GitHub Actions & Automation Runbook — Bookarium

Complete operator reference for every workflow under [`.github/workflows/`](../.github/workflows), including triggers, schedules, permissions, concurrency locks, required & optional secrets, `workflow_dispatch` inputs, CI execution steps, and copy-paste local CLI / `--dry-run` equivalents.

> **Related Documentation**:
> - For the **7-Gateway Quality Engine** architecture and console telemetry reference, see [**`docs/PIPELINE_GUIDE.md`**](PIPELINE_GUIDE.md).
> - For local `.env.local` / Vercel environment variable setup, see [**`DEVELOPMENT.md`**](../DEVELOPMENT.md#-environment-variables--secrets-reference) and [**`.env.example`**](../.env.example).
> - For end-to-end architecture diagrams (`Diagram 1`, `Diagram 8`, `Diagram 10`, `Diagram 12`), see [**`docs/ARCHITECTURE.md`**](ARCHITECTURE.md#-background-data-pipelines--automation-engines).

---

## 📋 1. Workflow Matrix at a Glance

Bookarium maintains **8** GitHub Actions workflows (validated 1:1 against [`.github/workflows/`](../.github/workflows) by **Pass 5** in [`scripts/verify-build.js`](../scripts/verify-build.js)):

| Workflow Name | File | Triggers & Exact Schedule | Permissions | Concurrency Lock | Timeout | `npm ci` | Required Secrets | Optional Secrets |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Unified Gutenberg Catalog Sync** | [`.github/workflows/catalog-sync.yml`](../.github/workflows/catalog-sync.yml) | `cron: 0 2 * * 0` (Sundays 02:00 UTC)<br>+ `workflow_dispatch` | `contents: write` | `gutenberg-catalog-sync` | `45m` | Yes | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY`<br>+ built-in `GITHUB_TOKEN` | `GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **Featured Quotes Sync** | [`.github/workflows/quotes-sync.yml`](../.github/workflows/quotes-sync.yml) | `workflow_dispatch` only *(Manual Override)* | `contents: read` | `featured-quotes-sync` | `30m` | Yes | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY` | `GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **Gutenberg Translations Sync** | [`.github/workflows/translations-sync.yml`](../.github/workflows/translations-sync.yml) | `workflow_dispatch` only *(Manual Override)* | `contents: read` | `gutenberg-translations-sync` | `20m` | Yes | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY` | `GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **Manual Cache Purge** | [`.github/workflows/cache-purge.yml`](../.github/workflows/cache-purge.yml) | `workflow_dispatch` only *(Selective Purge)* | `contents: read` | `cache-purge` | `5m` | **No** *(~5s)* | `VERCEL_API_TOKEN`\*<br>`VERCEL_PROJECT_ID`\* | `VERCEL_TEAM_ID` |
| **Bookarium CI** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `push` & `pull_request` on `main`, `master`, `dev` | `contents: read` | — | Runner default | Yes | **None** *(Zero keys)* | — |
| **CodeQL SAST Analysis** | [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) | `push` & `pull_request` on `main`, `master`, `dev`<br>+ `cron: 30 1 * * 1` (Mondays 01:30 UTC) | Top: `contents: read`<br>Job: `actions: read`, `contents: read`, `security-events: write` | `codeql-${{ github.ref }}` | `20m` | **No** *(Native CodeQL)* | **None** *(Public Repo)* | — |
| **Dependency Review** | [`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml) | `pull_request` on `main`, `master`, `dev` | `contents: read` | `dependency-review-${{ github.ref }}` | `10m` | **No** *(GitHub Graph)* | **None** *(Public Repo)* | — |
| **Create Release** | [`.github/workflows/release.yml`](../.github/workflows/release.yml) | `push` tags `v*`<br>+ `workflow_dispatch` (`tag`) | Top: `contents: read`<br>Job: `contents: write` | — | Runner default | Yes | Built-in `GITHUB_TOKEN` | — |

\* *Safety Fallback*: `scripts/purge-vercel-cache.js` exits cleanly (`exit 0`) with a skip notice when `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` are unset so community forks and dry-runs never fail on missing Vercel credentials. In `cache-purge.yml`, configure both secrets in GitHub Settings if you want live CDN invalidations to execute.

---

## 🔐 2. Prerequisites, Secrets & Cache Infrastructure

### 2.1 GitHub Repository Secrets Checklist
Configure repository secrets under **GitHub Repository $\to$ Settings $\to$ Secrets and variables $\to$ Actions $\to$ New repository secret**:

| Secret Name | Required By | Requirement Level | How to Obtain / Purpose |
| :--- | :--- | :--- | :--- |
| **`NEXT_PUBLIC_SUPABASE_URL`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` | **Required** for ingestion workflows | **Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ Project URL**. Target database instance for catalog, quotes, and translations upserts. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` | **Required** for ingestion workflows | **Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ `service_role` secret**. Admin key bypassing RLS for CLI batch writes (never exposed to browser bundles or Vercel client env). |
| **`GUTENBERG_CONTACT_EMAIL`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` | *Optional (Recommended)* | Appended to outbound `User-Agent` headers sent to Project Gutenberg mirrors and Wikidata; cleanly falls back to the repository URL if unset. |
| **`VERCEL_API_TOKEN`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml` | *Optional* *(Required for live CDN purge)* | **Vercel Dashboard $\to$ Account Settings $\to$ Tokens**. Bearer token used by [`scripts/purge-vercel-cache.js`](../scripts/purge-vercel-cache.js) (`POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags`). |
| **`VERCEL_PROJECT_ID`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml` | *Optional* *(Required for live CDN purge)* | **Vercel Dashboard $\to$ Project $\to$ Settings $\to$ General $\to$ Project ID** (`prj_...`). Passed as `projectIdOrName`. |
| **`VERCEL_TEAM_ID`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml` | *Optional* *(Team scope only)* | **Vercel Dashboard $\to$ Team Settings $\to$ General $\to$ Team ID** (`team_...`). Appends `&teamId=...` for Vercel Team or Hobby personal team scopes. |
| **`GITHUB_TOKEN`** | `catalog-sync.yml`, `release.yml` | **Automatic** *(Built-in)* | Provisioned automatically by GitHub Actions; requires no manual secret creation. Must remain allowed to write releases (`contents: write`) in repository workflow permissions. |

### 2.2 Permanent Release Snapshot Asset (`catalog-cache`)
- [`catalog-sync.yml`](../.github/workflows/catalog-sync.yml) persists `gutenberg-catalog-cache.json.gz` (~4.5 MB) inside a permanent GitHub Release tagged `catalog-cache` instead of short-lived GitHub Actions caches.
- **Zero manual bootstrap needed**: on the first full non-dry-run run (`dry_run: false` with blank `limit`), `gh release download` tolerates a missing release, `sync-gutenberg-catalog.js` runs cleanly from cold state, and the workflow automatically creates the `catalog-cache` release (`gh release create catalog-cache`) or updates it (`gh release upload ... --clobber`), guarded by a `>= 50,000`-book safety floor.

### 2.3 Vercel Edge Cache Tag Invalidation (`Vercel-Cache-Tag`)
- Live database responses attach semantic CDN tags (`catalog`, `quotes`, or `catalog,quotes` on `GET /api/books`, and `translations` on `GET /api/books/translations`), while fallback `"cache"` and `no-store` error responses omit tags.
- On live runs (`dry_run != true`), the three ingestion workflows automatically invoke [`scripts/purge-vercel-cache.js`](../scripts/purge-vercel-cache.js) with exact scope tags (`catalog,quotes,translations`, `quotes`, or `translations`), and [`cache-purge.yml`](../.github/workflows/cache-purge.yml) lets operators invalidate any custom subset manually without re-syncing Supabase.

---

## ⚙️ 3. Workflow-by-Workflow Operator Reference

### 3.1 `Unified Gutenberg Catalog Sync` ([`.github/workflows/catalog-sync.yml`](../.github/workflows/catalog-sync.yml))

Consolidates all scheduled database synchronization into a single deterministic Sunday pipeline so `translations`, `quotes`, and Edge CDN tags always update from the latest catalog state without overlapping cron contention.

- **Triggers**:
  - Scheduled: `cron: 0 2 * * 0` (Every Sunday at `02:00 UTC`)
  - Manual: `workflow_dispatch`
- **Concurrency & Permissions**: `concurrency: gutenberg-catalog-sync` (`cancel-in-progress: true`), `permissions: contents: write`, `timeout-minutes: 45`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `string` | No | `""` *(blank)* | Optional max books to ingest (e.g. `100` for smoke tests). Leave blank to process all ~78,000+ books and refresh the `catalog-cache` release asset. |
| `update_existing` | `boolean` | No | `false` | Pass `--update-existing` to force full row overwrites on `sync-gutenberg-catalog.js` and `ingest-translations.js` (default diffs field-by-field and preserves existing `quotes`). |
| `dry_run` | `boolean` | No | `false` | Simulate all 3 ingestion stages without mutating Supabase, uploading `catalog-cache`, or purging Vercel Edge cache. |
| `feed_source` | `choice` | No | `'auto'` | Download location for `rdf-files.tar.bz2` & `pg_catalog.csv.gz`: `'auto'` (`gutenberg.pglaf.org` -> `aleph.gutenberg.org` -> `www.gutenberg.org`), or pin to `'gutenberg.pglaf.org'`, `'aleph.gutenberg.org'`, or `'www.gutenberg.org'` (`--feed-source=...`). |

- **CI Execution Sequence**:
  1. Checkout repo (`actions/checkout@v4`), setup Node `22` with npm cache (`actions/setup-node@v4`), and run `npm ci`.
  2. Download `gutenberg-catalog-cache.json.gz` from release `catalog-cache` (`gh release download catalog-cache -p "gutenberg-catalog-cache.json.gz" --clobber` with `GH_TOKEN`).
  3. Run `node scripts/sync-gutenberg-catalog.js --cache-file=gutenberg-catalog-cache.json.gz --diff-output=quote-diff.json` (+ `--dry-run`, `--update-existing`, `--feed-source=HOST`, `--limit=N` per inputs).
  4. When `dry_run != 'true'`, `limit == ''`, and `gutenberg-catalog-cache.json.gz` exists: upload updated snapshot to `catalog-cache` release (`--clobber`, creating the release if absent).
  5. Run `node scripts/ingest-translations.js` (+ `--dry-run`, `--update-existing`, and `--limit=N` or `--all` when `limit` is blank).
  6. Run `node scripts/sync-featured-quotes.js --mirrors=pglaf` (+ `--diff-file=quote-diff.json` if emitted, `--dry-run`, `--limit=N`).
  7. When `dry_run != 'true'`: run `node scripts/purge-vercel-cache.js --tags=catalog,quotes,translations`.
- **Local CLI Equivalents**:
  ```bash
  # Dry-run catalog diff + inspect options (pin a specific feed mirror if needed)
  npm run catalog:sync -- --dry-run --limit=100 --feed-source=gutenberg.pglaf.org
  node scripts/sync-gutenberg-catalog.js --help

  # Live full chain matching Sunday CI
  npm run catalog:sync -- --cache-file=gutenberg-catalog-cache.json.gz --diff-output=quote-diff.json
  npm run translations:sync -- --all
  npm run quotes:sync -- --mirrors=pglaf --diff-file=quote-diff.json
  node scripts/purge-vercel-cache.js --tags=catalog,quotes,translations
  ```

---

### 3.2 `Featured Quotes Sync` ([`.github/workflows/quotes-sync.yml`](../.github/workflows/quotes-sync.yml))

On-demand multi-mirror quote extractor maintaining Bookarium's **Two-Tier Bounded Quote Pool (`Top 500 Popular + Rolling 64 Most Recent`)** in `public.books.quotes` with Option-A `1-for-1` out-of-window surplus pruning (`<= 2,000` per run).

- **Triggers**: `workflow_dispatch` only *(automated Sunday runs are chained in `.github/workflows/catalog-sync.yml`)*
- **Concurrency & Permissions**: `concurrency: featured-quotes-sync` (`cancel-in-progress: true`), `permissions: contents: read`, `timeout-minutes: 30`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `string` | No | `'50'` | Max volumes to quote in this batch (`40 Popular + 10 Recent` slot split). |
| `delay_range` | `string` | No | `'8-16'` | Randomized decimal delay range in seconds between Gutenberg requests. |
| `target_count` | `string` | No | `'14'` | Desired quotes extracted per volume (`10–16` bounded). |
| `ids` | `string` | No | `''` | Comma-separated Gutenberg IDs for targeted backfill (blank uses automatic priority pool scanning). |
| `mirror_pglaf` | `boolean` | No | `true` | Enable `gutenberg.pglaf.org` mirror. |
| `mirror_aleph` | `boolean` | No | `false` | Enable `aleph.gutenberg.org` mirror. |
| `mirror_readingroo` | `boolean` | No | `false` | Enable `gutenberg.readingroo.ms` mirror. *(At least 1 mirror must be checked or workflow fails fast.)* |
| `force_refresh` | `boolean` | No | `false` | Re-extract and overwrite quotes even for already-populated IDs (`--force`). |
| `dry_run` | `boolean` | No | `false` | Simulate extraction and generate SQL preview without writing Supabase or purging Vercel Edge cache. |

- **CI Execution Sequence**:
  1. Checkout repo, setup Node `22` with npm cache, `npm ci`.
  2. Resolve checked mirrors into `--mirrors=...` (failing fast if none checked), then run `node scripts/sync-featured-quotes.js` with `limit`, `delay_range`, `target_count`, optional `--ids=...`, `--force`, and `--dry-run`.
  3. When `dry_run != 'true'`: run `node scripts/purge-vercel-cache.js --tags=quotes`.
- **Local CLI Equivalents**:
  ```bash
  # Dry-run without DB mutation
  npm run quotes:sync -- --dry-run

  # Sync specific classics or custom pool/prune settings
  npm run quotes:sync -- --ids=1342,84,2701 --force
  npm run quotes:sync -- --limit=50 --delay-range=8-16 --mirrors=pglaf --max-prune=2000
  node scripts/purge-vercel-cache.js --tags=quotes
  ```

---

### 3.3 `Gutenberg Translations Sync` ([`.github/workflows/translations-sync.yml`](../.github/workflows/translations-sync.yml))

On-demand FRBR relational edition clusterer fetching Wikidata `P2034` / `P407` mappings (with offline cache fallback) and batch-upserting multilingual book links into `public.book_translations`.

- **Triggers**: `workflow_dispatch` only *(automated Sunday runs are chained in `.github/workflows/catalog-sync.yml`)*
- **Concurrency & Permissions**: `concurrency: gutenberg-translations-sync` (`cancel-in-progress: true`), `permissions: contents: read`, `timeout-minutes: 20`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `string` | No | `''` *(blank)* | Max Wikidata clusters to process; blank automatically passes `--all` for full cluster ingestion. |
| `update_existing` | `boolean` | No | `false` | Pass `--update-existing` to overwrite existing translation cluster rows. |
| `dry_run` | `boolean` | No | `false` | Validate clustering without writing to Supabase or purging Vercel Edge cache. |

- **CI Execution Sequence**:
  1. Checkout repo, setup Node `22` with npm cache, `npm ci`.
  2. Run `node scripts/ingest-translations.js` (+ `--dry-run`, `--update-existing`, and `--limit=N` or `--all`).
  3. When `dry_run != 'true'`: run `node scripts/purge-vercel-cache.js --tags=translations`.
- **Local CLI Equivalents**:
  ```bash
  npm run translations:sync -- --dry-run
  npm run translations:sync -- --limit=200
  npm run translations:sync -- --all
  node scripts/ingest-translations.js --help
  node scripts/purge-vercel-cache.js --tags=translations
  ```

---

### 3.4 `Manual Cache Purge` ([`.github/workflows/cache-purge.yml`](../.github/workflows/cache-purge.yml))

Lightweight, standalone `workflow_dispatch`-only utility for selectively invalidating Vercel Edge `Vercel-Cache-Tag` caches without running `npm ci` or touching Supabase.

- **Triggers**: `workflow_dispatch` only
- **Concurrency & Permissions**: `concurrency: cache-purge` (`cancel-in-progress: true`), `permissions: contents: read`, `timeout-minutes: 5`
- **Dependencies**: Zero `npm ci` / zero npm cache (uses Node `22` built-in `fetch` directly; completes in seconds).
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `purge_catalog` | `boolean` | No | `false` | Purge `catalog` Edge tag (`/api/books` catalog listings & book metadata). |
| `purge_quotes` | `boolean` | No | `false` | Purge `quotes` Edge tag (`/api/books?pool=quotes` & `has_quotes=true`). |
| `purge_translations` | `boolean` | No | `false` | Purge `translations` Edge tag (`/api/books/translations` FRBR editions). |
| `target` | `choice` (`production`, `preview`) | **Yes** | `'production'` | Target Vercel environment (`production` or `preview`). |
| `dry_run` | `boolean` | No | `false` | Build target endpoint URL, log payload, and publish `$GITHUB_STEP_SUMMARY` without calling Vercel API. |

- **Fail-Fast Safety Guard**: All three tag checkboxes start **unchecked (`false`)** intentionally so operators never trigger accidental full purges; submitting with zero checkboxes checked immediately fails (`exit 1`) with an error notice in logs and Job Summary before contacting Vercel.
- **CI Execution Sequence**:
  1. Checkout repo and setup Node `22`.
  2. Bind inputs via `env:` (no direct shell interpolation), validate at least one tag checkbox is `true` and `target` is `production` or `preview`.
  3. Execute `node scripts/purge-vercel-cache.js --tags=<selected> --target=<target> [--dry-run]`.
- **Local CLI Equivalents**:
  ```bash
  # Preview request safely without contacting Vercel API
  node scripts/purge-vercel-cache.js --tags=quotes --target=production --dry-run

  # Purge selected tags or all 3 tags on production
  node scripts/purge-vercel-cache.js --tags=catalog,quotes,translations --target=production
  ```

---

### 3.5 `Bookarium CI` ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))

Continuous integration quality gate verifying every branch push and pull request through the complete **7-Gateway Quality Engine** without requiring any external keys or secrets.

- **Triggers**: `push` and `pull_request` on branches `main`, `master`, `dev`
- **Permissions**: `contents: read`
- **Required Secrets**: **None** (runs hermetically with MSW v2 network mocks and bundled test fixtures)
- **CI Execution Sequence**:
  1. Checkout repo (`actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`), setup Node `22` with npm cache (`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`), run `npm ci`.
  2. Execute `npm run verify:build` (Pass 0.5 secret/env/AST boundary scan $\to$ Pass 0.75 7-Pillar OWASP/SAST/Workflow/AST taint suite $\to$ Pass 1 TypeScript $\to$ Pass 2 & 3 Vitest with `95/95/92/85` V8 coverage $\to$ Pass 4 AST doc sync parity $\to$ Pass 5 ADR, 18 governance docs, 1:1 SQL$\leftrightarrow$TS parity, 1:1 workflow/cron parity & co-location $\to$ Pass 6 ESLint zero-warning + Knip $\to$ Pass 7 Next.js production build).
  3. Execute `git diff --exit-code` across the `10` deterministic AST/SemVer/contract living-documentation artifacts (`docs/ARCHITECTURE.md`, `docs/GUTENBERG_PARSER.md`, `docs/SYSTEM_CONTRACTS.md`, `CHANGELOG.md`, `ROADMAP.md`, `package.json`, `package-lock.json`, `SECURITY.md`, `.github/workflows/release.yml`, and `.github/ISSUE_TEMPLATE/bug_report.yml`) to reject PRs with unsynchronized generated outputs (deliberately excluding `docs/QUALITY_AUDIT_REPORT.md`, `docs/quality-audit-results.json`, `README.md`, and `next-env.d.ts` whose outputs embed dynamic V8 coverage floats or local Next typegen stubs).
- **Local CLI Equivalents**:
  ```bash
  # Exact CI command (full 7-Gateway Quality Engine)
  npm run verify:build

  # Faster standalone security + governance check (Passes 0.5, 0.75 & 5)
  npm run security:audit
  ```

---

### 3.6 `Create Release` ([`.github/workflows/release.yml`](../.github/workflows/release.yml))

Automated semantic release pipeline that re-verifies the entire repository, extracts matching release notes from [`CHANGELOG.md`](../CHANGELOG.md), and publishes a signed GitHub Release.

- **Triggers**:
  - `push` matching `tags: ['v*']`
  - `workflow_dispatch` with required `tag` string (default `'v2.9.48'`, automatically synchronized to `RELEASES[0].version` in [`.github/workflows/release.yml`](../.github/workflows/release.yml) by `scripts/generate-changelog.js` via `npm run docs:sync`)
- **Permissions**: Top-level `contents: read`; job-level `contents: write`
- **Required Secrets**: Built-in `GITHUB_TOKEN` (automatic)
- **CI Execution Sequence**:
  1. Checkout repo with `fetch-depth: 0`, setup Node `22` with npm cache, run `npm ci`.
  2. Run `npm run verify` (full 7-Gateway verification before release publication).
  3. Extract the exact section matching the active release version from [`CHANGELOG.md`](../CHANGELOG.md) into `RELEASE_NOTES.md`.
  4. Publish the GitHub Release via `softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2.6.2` (`generate_release_notes: true`).
- **Local Pre-Release Checklist**:
  ```bash
  # Sync versioned docs & run pre-commit approval + security/governance gates
  npm run docs:sync
  npm run gate:approve
  npm run verify
  ```

---

### 3.7 `CodeQL SAST Analysis` ([`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml))

Continuous inter-procedural GitHub CodeQL SAST scanning both TypeScript/JavaScript source code and GitHub Actions workflow definitions, publishing SARIF findings directly to GitHub's **Security $\to$ Code scanning** tab on public repositories.

- **Triggers**:
  - `push` and `pull_request` on `main`, `master`, `dev`
  - Scheduled: `cron: 30 1 * * 1` (Every Monday at `01:30 UTC`, staggered away from Sunday `catalog-sync.yml`)
- **Permissions**: Top-level `contents: read`; job-level `actions: read`, `contents: read`, `security-events: write`
- **Language Matrix**: `javascript-typescript`, `actions` (`fail-fast: false`, `timeout-minutes: 20`)
- **GitHub Repository Settings Note**: Because Bookarium configures CodeQL via `.github/workflows/codeql.yml` (Advanced Setup), keep GitHub UI **Settings $\to$ Code security $\to$ CodeQL analysis** *Default setup* disabled so the two modes never conflict.

---

### 3.8 `Dependency Review` ([`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml))

Automated pull-request supply-chain firewall backed by GitHub's Dependency Graph, blocking newly introduced `high` or `critical` vulnerabilities and incompatible copyleft (`GPL-2.0`, `GPL-3.0`, `AGPL-3.0`) transitive dependencies before merge.

- **Triggers**: `pull_request` on `main`, `master`, `dev`
- **Permissions**: `contents: read` (`timeout-minutes: 10`)
- **Policy Configuration**: `fail-on-severity: high`, `deny-licenses: GPL-2.0, GPL-3.0, AGPL-3.0` (powered automatically on public repositories by GitHub Dependency Graph).

---

## 🛠️ 4. Related GitHub Automation & Marketplace Actions

| Component | Configuration / Pin | Scope & Schedule |
| :--- | :--- | :--- |
| **Dependabot** | [`.github/dependabot.yml`](../.github/dependabot.yml) | Automated `monthly` PRs targeting `master` for `npm` dependencies (`open-pull-requests-limit: 5`, `chore(deps)`) and `github-actions` commit-SHA updates (`open-pull-requests-limit: 3`, `chore(ci)`). |
| **Checkout Action** | `actions/checkout@11d5960a326750d5838078e36cf38b85af677262` (`v4.4.0`) | Used across all 8 workflows (`fetch-depth: 0` in `release.yml` for tag/changelog extraction). |
| **Node.js Setup** | `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (`v4.4.0`) | Pins `node-version: '22'` across 6 Node.js workflows (enables `cache: 'npm'` except `cache-purge.yml`, which needs zero npm dependencies). |
| **CodeQL Action (`init` / `analyze`)** | `github/codeql-action/*@33d7b85da1a04171e211befe2c739303b9a4c066` (`v4.39.3`) | Executes multi-target `javascript-typescript` and `actions` SARIF analysis inside `codeql.yml`. |
| **Dependency Review Action** | `actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48` (`v4.9.0`) | Enforces `high` CVE and `GPL`/`AGPL` license checks on PR dependency changes inside `dependency-review.yml`. |
| **Release Publisher** | `softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` (`v2.6.2`) | Publishes GitHub Releases from extracted `CHANGELOG.md` notes inside `release.yml`. |

> **Workflow Security Posture (Pass 0.75 Enforced)**: All 8 workflows declare explicit least-privilege `permissions:`, pin every external `uses:` step to a 40-character immutable commit SHA (`/@[0-9a-f]{40}$/`), forbid combining `pull_request_target` with `contents: write`, and bind inputs via `env:` instead of directly interpolating `${{ github.event.* }}` inside `run:` shell scripts.

---

## 🩺 5. Quick Operator Troubleshooting

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| `cache-purge.yml` fails immediately with *"Select at least one cache tag to purge"* | All 3 tag checkboxes left unchecked (`false`). | Re-run **Manual Cache Purge** with one or more of `purge_catalog`, `purge_quotes`, or `purge_translations` checked. |
| `quotes-sync.yml` fails before running script | None of `mirror_pglaf`, `mirror_aleph`, or `mirror_readingroo` was checked. | Enable at least one mirror checkbox (default: `mirror_pglaf: true`). |
| Purge step exits `0` with skip notice in logs | `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` is unset in GitHub Secrets. | Expected safe default for forks; add both secrets under Repository Settings $\to$ Actions to enable live CDN purges. |
| Vercel purge returns `401` / `403` | Token expired or team scope mismatched. | Regenerate `VERCEL_API_TOKEN`, verify `VERCEL_PROJECT_ID` (`prj_...`), and set `VERCEL_TEAM_ID` (`team_...`) if the project belongs to a Vercel Team / personal team. |
| `gh release download catalog-cache` prints not-found warning | First-ever cold sync before `catalog-cache` release exists. | Safe to ignore on first full live run (`limit` blank, `dry_run: false`): Step 3 creates the `catalog-cache` release automatically once active books exceed `50,000`. |
| `release.yml` changelog extraction is empty | Dispatched tag does not match an entry header in `CHANGELOG.md`. | Update `RELEASES[0]` in [`scripts/generate-changelog.js`](../scripts/generate-changelog.js) and run `npm run docs:sync` first so `CHANGELOG.md` and `release.yml` share the exact tag version. |
