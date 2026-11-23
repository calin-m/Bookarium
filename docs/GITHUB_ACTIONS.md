# GitHub Actions & Automation Runbook — Bookarium

Complete operator reference for every workflow under [`.github/workflows/`](../.github/workflows), including triggers, schedules, permissions, concurrency locks, required & optional secrets, `workflow_dispatch` inputs, CI execution steps, and copy-paste local CLI / `--dry-run` equivalents.

> **Related Documentation**:
> - For the **7-Gateway Quality Engine** architecture and console telemetry reference, see [**`docs/PIPELINE_GUIDE.md`**](PIPELINE_GUIDE.md).
> - For **Free vs. Paid deployment tiers, GitHub runner/Release caps, and platform coding guardrails**, see [**`docs/INFRASTRUCTURE.md`**](INFRASTRUCTURE.md).
> - For local `.env.local` / Vercel environment variable setup, see [**`DEVELOPMENT.md`**](../DEVELOPMENT.md#-environment-variables--secrets-reference) and [**`.env.example`**](../.env.example).
> - For end-to-end architecture diagrams (`Diagram 1` in `docs/ARCHITECTURE.md`, plus `Diagram 8`, `Diagram 10`, `Diagram 12` in subsystem slices), see [**`docs/ARCHITECTURE.md`**](ARCHITECTURE.md) and [**`docs/architecture/database-and-pipelines.md`**](architecture/database-and-pipelines.md#1-github-actions--database-ingestion-topology).

---

## 📋 1. Workflow Matrix at a Glance

<!-- BEGIN:workflows-matrix -->
Bookarium maintains **11** GitHub Actions workflows (validated 1:1 against [`.github/workflows/`](../.github/workflows) by **Pass 5** in [`scripts/verify-build.js`](../scripts/verify-build.js)):

| Workflow Name | File | Triggers & Exact Schedule | Permissions | Concurrency Lock | Timeout | `npm ci` | Required Secrets | Optional Secrets |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gutenberg Catalog Sync** | [`.github/workflows/catalog-sync.yml`](../.github/workflows/catalog-sync.yml) | `cron: 0 2 * * 0` (Sundays 02:00 UTC)<br>+ `workflow_dispatch` | `contents: write` | `gutenberg-catalog-sync` | `60m` | Yes | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY`<br>+ built-in `GITHUB_TOKEN` | `R2_ACCOUNT_ID`<br>`R2_BUCKET_NAME`<br>`R2_ACCESS_KEY_ID`<br>`R2_SECRET_ACCESS_KEY`<br>`GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **Sync catalog-cache Tag** | [`.github/workflows/catalog-tag-sync.yml`](../.github/workflows/catalog-tag-sync.yml) | `push` on `master`<br>+ `workflow_dispatch` | `contents: write` | `catalog-cache-tag-sync` | `5m` | **No** *(~5s)* | Built-in `GITHUB_TOKEN` | — |
| **R2 Asset Delta & Backfill Sync** | [`.github/workflows/r2-sync.yml`](../.github/workflows/r2-sync.yml) | `workflow_dispatch` only *(Manual Backfill)* | `contents: read` | `r2-asset-sync` | `90m` | Yes | `R2_ACCOUNT_ID`<br>`R2_BUCKET_NAME`<br>`R2_ACCESS_KEY_ID`<br>`R2_SECRET_ACCESS_KEY`\* | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY`<br>`GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **R2 Content Integrity Scan** | [`.github/workflows/r2-content-scan.yml`](../.github/workflows/r2-content-scan.yml) | `workflow_dispatch` only *(Manual Read Audit)* | `contents: read` | `r2-content-scan` | `60m` | **No** *(~5s)* | `R2_ACCOUNT_ID`<br>`R2_BUCKET_NAME`<br>`R2_ACCESS_KEY_ID`<br>`R2_SECRET_ACCESS_KEY`\* | — |
| **Gutenberg Translations Sync** | [`.github/workflows/translations-sync.yml`](../.github/workflows/translations-sync.yml) | `workflow_dispatch` only *(Manual Override)* | `contents: read` | `gutenberg-translations-sync` | `20m` | Yes | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY` | `GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **Featured Quotes Sync** | [`.github/workflows/quotes-sync.yml`](../.github/workflows/quotes-sync.yml) | `workflow_dispatch` only *(Manual Override)* | `contents: read` | `featured-quotes-sync` | `30m` | Yes | `NEXT_PUBLIC_SUPABASE_URL`<br>`SUPABASE_SERVICE_ROLE_KEY` | `R2_ACCOUNT_ID`<br>`R2_BUCKET_NAME`<br>`R2_ACCESS_KEY_ID`<br>`R2_SECRET_ACCESS_KEY`<br>`GUTENBERG_CONTACT_EMAIL`<br>`VERCEL_API_TOKEN`<br>`VERCEL_PROJECT_ID`<br>`VERCEL_TEAM_ID` |
| **Manual Cache Purge** | [`.github/workflows/cache-purge.yml`](../.github/workflows/cache-purge.yml) | `workflow_dispatch` only *(Selective Purge)* | `contents: read` | `cache-purge` | `5m` | **No** *(~5s)* | `VERCEL_API_TOKEN`\*<br>`VERCEL_PROJECT_ID`\* | `VERCEL_TEAM_ID` |
| **CI Pipeline** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `push` & `pull_request` on `main`, `master`, `dev` | `contents: read` | `ci-${{ github.workflow }}-${{ github.ref }}` *(PR cancel)* | `25m` | Yes | **None** *(Zero keys)* | — |
| **CodeQL SAST Analysis** | [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) | `push` & `pull_request` on `main`, `master`, `dev`<br>+ `cron: 30 1 * * 1` (Mondays 01:30 UTC) | Top: `contents: read`<br>Job: `actions: read`, `contents: read`, `security-events: write` | `codeql-${{ github.ref }}` | `20m` | **No** *(Native CodeQL)* | **None** *(Public Repo)* | — |
| **Dependency Review** | [`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml) | `pull_request` on `main`, `master`, `dev` | `contents: read` | `dependency-review-${{ github.ref }}` | `10m` | **No** *(GitHub Graph)* | **None** *(Public Repo)* | — |
| **Automated Release & Publish** | [`.github/workflows/release.yml`](../.github/workflows/release.yml) | `push` tags `v*`<br>+ `workflow_dispatch` (`tag`) | Top: `contents: read`<br>Job: `contents: write` | — | `25m` | Yes | Built-in `GITHUB_TOKEN` | — |
<!-- END:workflows-matrix -->

\* *Safety Fallback*: `scripts/purge-vercel-cache.js` exits cleanly (`exit 0`) with a skip notice when `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` are unset so community forks and dry-runs never fail on missing Vercel credentials (in `cache-purge.yml`, configure both secrets in GitHub Settings if you want live CDN invalidations to execute). Likewise, `r2-sync.yml`, `r2-content-scan.yml`, and `catalog-sync.yml` skip R2 scripts with `exit 0` only when **all 4** `R2_*` secrets are unset—partial or malformed `R2_*` setups fail fast (`exit 1`) via `assertValidR2ConfigIfPresent`.

---

## 🔐 2. Prerequisites, Secrets & Cache Infrastructure

### 2.1 GitHub Repository Secrets Checklist
Configure repository secrets under **GitHub Repository $\to$ Settings $\to$ Secrets and variables $\to$ Actions $\to$ New repository secret**:

| Secret Name | Required By | Requirement Level | How to Obtain / Purpose |
| :--- | :--- | :--- | :--- |
| **`NEXT_PUBLIC_SUPABASE_URL`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` | **Required** for ingestion workflows | **Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ Project URL**. Target database instance for catalog, quotes, and translations upserts. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` | **Required** for ingestion workflows | **Supabase Dashboard $\to$ Project Settings $\to$ API $\to$ `service_role` secret**. Admin key bypassing RLS for CLI batch writes (never exposed to browser bundles or Vercel client env). |
| **`GUTENBERG_CONTACT_EMAIL`** | `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` | *Optional (Recommended)* | Appended to outbound `User-Agent` headers sent to Project Gutenberg mirrors and Wikidata; cleanly falls back to the repository URL if unset. |
| **`VERCEL_API_TOKEN`** | `catalog-sync.yml`, `r2-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml` | *Optional* *(Required for live CDN purge)* | **Vercel Dashboard $\to$ Account Settings $\to$ Tokens**. Bearer token used by [`scripts/purge-vercel-cache.js`](../scripts/purge-vercel-cache.js) (`POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags`). |
| **`VERCEL_PROJECT_ID`** | `catalog-sync.yml`, `r2-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml` | *Optional* *(Required for live CDN purge)* | **Vercel Dashboard $\to$ Project $\to$ Settings $\to$ General $\to$ Project ID** (`prj_...`). Passed as `projectIdOrName`. |
| **`VERCEL_TEAM_ID`** | `catalog-sync.yml`, `r2-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml` | *Optional* *(Team scope only)* | **Vercel Dashboard $\to$ Team Settings $\to$ General $\to$ Team ID** (`team_...`). Appends `&teamId=...` for Vercel Team or Hobby personal team scopes. |
| **`R2_ACCOUNT_ID`** | `catalog-sync.yml`, `r2-sync.yml`, `r2-content-scan.yml`, `quotes-sync.yml` | **Required** for R2 asset sync, content scan & R2-first quotes *(CI R2 steps skip cleanly in forks if all 4 `R2_*` secrets are unset; partial configs fail fast)* | **Cloudflare Dashboard $\to$ R2 Overview $\to$ *Account ID***. Identifies private bucket storage (`scripts/lib/r2-sigv4.js`, `scripts/sync-r2-assets.js`, `scripts/scan-r2-content.js`). |
| **`R2_BUCKET_NAME`** | `catalog-sync.yml`, `r2-sync.yml`, `r2-content-scan.yml`, `quotes-sync.yml` | **Required** for R2 asset sync, content scan & R2-first quotes | Target private R2 bucket name (e.g. `bookarium-assets`) storing `books/<id>.txt.gz`, `covers/<id>.jpg`, and `_meta/r2-sync-state.json.gz`. *(Full 78k+ catalog exceeds R2's 10 GB free-tier allowance).* |
| **`R2_ACCESS_KEY_ID`** | `catalog-sync.yml`, `r2-sync.yml`, `r2-content-scan.yml`, `quotes-sync.yml` | **Required** for R2 asset sync & content scan *(Read-Only sufficient for `r2-content-scan.yml`; Read & Write bucket-scoped required for `r2-sync.yml` / `catalog-sync.yml`)* | **Cloudflare Dashboard $\to$ R2 $\to$ Manage R2 API Tokens**. Keep a separate Read-Only token in Vercel and a Read & Write bucket-scoped token in GitHub Secrets. |
| **`R2_SECRET_ACCESS_KEY`** | `catalog-sync.yml`, `r2-sync.yml`, `r2-content-scan.yml`, `quotes-sync.yml` | **Required** for R2 asset sync & content scan | HMAC-SHA256 signing secret paired with `R2_ACCESS_KEY_ID` for AWS SigV4 R2 API operations (`ListObjectsV2`, `GetObject`, `PutObject`, `DeleteObject`). |
| **`GITHUB_TOKEN`** | `catalog-sync.yml`, `catalog-tag-sync.yml`, `release.yml` | **Automatic** *(Built-in)* | Provisioned automatically by GitHub Actions; requires no manual secret creation. Must remain allowed to write releases and move tags (`contents: write`) in repository workflow permissions. |

### 2.2 Permanent Release Snapshot Asset (`catalog-cache`)
- [`catalog-sync.yml`](../.github/workflows/catalog-sync.yml) persists `gutenberg-catalog-cache.json.gz` (~4.5–6.4 MB) and its companion `gutenberg-catalog-cache.json.gz.sha256` checksum sidecar inside a permanent GitHub Release tagged `catalog-cache` instead of short-lived GitHub Actions caches.
- **Zero manual bootstrap needed & fail-closed checksum verification**: on restore, `loadCatalogSnapshotCache` verifies `gutenberg-catalog-cache.json.gz` against `gutenberg-catalog-cache.json.gz.sha256` via `crypto.timingSafeEqual` (falling back safely to live Supabase diff queries if corrupt or tampered, and gracefully tolerating a missing `.sha256` sidecar on legacy pre-upgrade snapshots); on the first full non-dry-run run (`dry_run: false` with blank `limit`), `catalog-sync.yml` automatically creates or updates the `catalog-cache` release (`gh release upload ... --clobber`) with both files, guarded by a `>= 50,000`-book safety floor.
- **Snapshot vs. auto-generated Source Archives**: `gutenberg-catalog-cache.json.gz` and `.sha256` update **only** on live `catalog-sync.yml` runs, whereas GitHub auto-generates `Source code (zip)` / `(tar.gz)` from the `catalog-cache` Git tag (`.../archive/refs/tags/catalog-cache.zip`). Both [`catalog-tag-sync.yml`](../.github/workflows/catalog-tag-sync.yml) (on `push` to `master`) and live `catalog-sync.yml` uploads advance `refs/tags/catalog-cache` in place (`PATCH` API with `force: true`), keeping source archives current with `master` without touching the catalog snapshot assets.

### 2.3 Vercel Edge Cache Tag Invalidation (`Vercel-Cache-Tag`)
- Live database and asset responses attach semantic CDN tags (`catalog`, `quotes`, or `catalog,quotes` on `GET /api/books`, `translations` on `GET /api/books/translations`, `covers` on `GET /api/books/content?type=cover`, and `book-content` on `GET /api/books/content` plain text), while fallback `"cache"`, `type=card`, and `no-store` error responses omit tags.
- On live runs (`dry_run != true`), the three ingestion workflows automatically invoke [`scripts/purge-vercel-cache.js`](../scripts/purge-vercel-cache.js) with exact scope tags (`catalog,quotes,translations[,r2-tags]`, `quotes`, or `translations`), `r2-sync.yml` conditionally purges `covers` / `book-content` whenever deletions or `--force` overwrites write `r2-purge-tags.txt`, and [`cache-purge.yml`](../.github/workflows/cache-purge.yml) lets operators invalidate any custom subset manually without re-syncing Supabase.

---

## ⚙️ 3. Workflow-by-Workflow Operator Reference

### 3.1 `Unified Gutenberg Catalog Sync` ([`.github/workflows/catalog-sync.yml`](../.github/workflows/catalog-sync.yml))

Consolidates all scheduled database synchronization into a single deterministic Sunday pipeline so `translations`, `quotes`, and Edge CDN tags always update from the latest catalog state without overlapping cron contention.

- **Triggers**:
  - Scheduled: `cron: 0 2 * * 0` (Every Sunday at `02:00 UTC`)
  - Manual: `workflow_dispatch`
- **Concurrency & Permissions**: `concurrency: gutenberg-catalog-sync` (`cancel-in-progress: false`), `permissions: contents: write`, `timeout-minutes: 60`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `string` | No | `""` *(blank)* | Optional max books to ingest (e.g. `100` for smoke tests). Leave blank to process all ~78,000+ books and refresh the `catalog-cache` release asset. |
| `update_existing` | `boolean` | No | `false` | Pass `--update-existing` to force full row overwrites on `sync-gutenberg-catalog.js` and `ingest-translations.js` (default diffs field-by-field and preserves existing `quotes`). |
| `dry_run` | `boolean` | No | `false` | Simulate all 4 ingestion stages without mutating Supabase, Cloudflare R2, uploading `catalog-cache`, or purging Vercel Edge cache. |
| `feed_source` | `choice` | No | `'auto'` | Download mirror for `rdf-files.tar.bz2` & `pg_catalog.csv.gz`: `'auto'` (`gutenberg.pglaf.org` -> `aleph.gutenberg.org`), or pin to `'gutenberg.pglaf.org'` or `'aleph.gutenberg.org'` (`--feed-source=...`). |
| `skip_r2` | `boolean` | No | `false` | Bypass the Cloudflare R2 delta asset sync step during catalog-only dispatches. |
| `r2_limit` | `string` | No | `""` *(blank)* | Optional max missing books to upload to R2 (defaults to `limit` when set, otherwise bounded by `--max-minutes=25`). |

- **CI Execution Sequence**:
  1. Checkout repo (`actions/checkout@v4`), setup Node `22` with npm cache (`actions/setup-node@v4`), and run `npm ci`.
  2. Download `gutenberg-catalog-cache.json.gz` and companion `gutenberg-catalog-cache.json.gz.sha256` (if published) from release `catalog-cache` (`gh release download catalog-cache` with `GH_TOKEN`).
  3. Run `node scripts/sync-gutenberg-catalog.js --cache-file=gutenberg-catalog-cache.json.gz --diff-output=quote-diff.json` (+ `--dry-run`, `--update-existing`, `--feed-source=HOST`, `--limit=N` per inputs), verifying snapshot `.sha256`, `Content-Length` completeness, non-zero `tar` fail-closed integrity, and RDF outage `copyright: true` preservation / new-volume deferral (`reconcileBatchWithoutRdfRights`).
  4. When `dry_run != 'true'`, `limit == ''`, `catalog_sync.outcome == 'success'`, and `gutenberg-catalog-cache.json.gz` exists: upload updated snapshot and `gutenberg-catalog-cache.json.gz.sha256` sidecar to `catalog-cache` release (`--clobber`, creating the release if absent) and advance `refs/tags/catalog-cache` in place. Executing this step *immediately after* `catalog_sync` ensures transient R2 failures never leave the release snapshot stale after Supabase upserts.
  5. **Run Cloudflare R2 Delta Asset Sync** (unless `skip_r2=true` or all 4 `R2_*` secrets are unset; `continue-on-error: true`): runs `node scripts/sync-r2-assets.js --source=rsync --rsync-host=auto --max-minutes=25 --purge-tags-file=r2-purge-tags.txt` (`aleph.gutenberg.org` primary $\rightarrow$ automatic retry failover to `rsync.ibiblio.org`, + `--cache-file=gutenberg-catalog-cache.json.gz`, `--dry-run`, `--limit=N`), uploading missing public-domain `.txt.gz`/`.jpg` files via bounded retries & parallel `PutObject` workers, safeguarding `_meta/r2-sync-state.json.gz` via read-fail preservation + remote union merge + `try ... finally` checkpoints, and writing conditional `covers`/`book-content` purge tags on deletes/`--force` overwrites.
  6. Run `node scripts/ingest-translations.js` (`continue-on-error: true`, + `--dry-run`, `--update-existing`, and `--limit=N` or `--all` when `limit` is blank) with `45,000ms` Wikidata socket timeout, strict FK pre-checks, and bisected batch upsert retries.
  7. Run `node scripts/sync-featured-quotes.js --source=auto --mirrors=pglaf,aleph,readingroo` (`continue-on-error: true`) with optional `R2_*` credentials (`books/<id>.txt.gz` read first at 0s mirror delay ahead of 3-mirror failover; + `--diff-file=quote-diff.json` if emitted, `--dry-run`, `--limit=N`).
  8. When `dry_run != 'true'` and `catalog_sync` / `trans_sync` / `quotes_sync` succeeded (`if: always()`): append any non-empty `r2-purge-tags.txt` tags to `catalog,quotes,translations` and run `node scripts/purge-vercel-cache.js --tags="$PURGE_TAGS"`.
  9. Run `Verify Downstream Step Outcomes` to exit `1` if `r2_sync`, `trans_sync`, or `quotes_sync` failed after retries so transient faults never pass silently even after Edge cache purging completes.
- **Local CLI Equivalents**:
  ```bash
  # Dry-run catalog diff + inspect options (pin a specific feed mirror if needed)
  npm run catalog:sync -- --dry-run --limit=100 --feed-source=gutenberg.pglaf.org
  node scripts/sync-gutenberg-catalog.js --help

  # Live full chain matching Sunday CI
  npm run catalog:sync -- --cache-file=gutenberg-catalog-cache.json.gz --diff-output=quote-diff.json
  npm run r2:sync -- --cache-file=gutenberg-catalog-cache.json.gz --source=auto --max-minutes=25 --purge-tags-file=r2-purge-tags.txt
  npm run translations:sync -- --all
  npm run quotes:sync -- --source=auto --mirrors=pglaf,aleph,readingroo --diff-file=quote-diff.json
  node scripts/purge-vercel-cache.js --tags=catalog,quotes,translations
  ```

---

### 3.2 `Featured Quotes Sync` ([`.github/workflows/quotes-sync.yml`](../.github/workflows/quotes-sync.yml))

On-demand multi-mirror + R2-first quote extractor maintaining Bookarium's **Two-Tier Bounded Quote Pool (`Top 500 Popular + Rolling 64 Most Recent`)** in `public.books.quotes` with Option-A `1-for-1` out-of-window surplus pruning (`<= 2,000` per run). Exposes a selectable `text_source` (`auto` | `r2` | `mirrors`) input and prints active `Text Source` telemetry in the pre-batch startup banner and `$GITHUB_STEP_SUMMARY`.

- **Triggers**: `workflow_dispatch` only *(automated Sunday runs are chained in `.github/workflows/catalog-sync.yml`)*
- **Concurrency & Permissions**: `concurrency: featured-quotes-sync` (`cancel-in-progress: false`), `permissions: contents: read`, `timeout-minutes: 30`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `text_source` | `choice` | **Yes** | `'auto'` | Retrieval engine: `'auto'` (`R2` first at 0s delay $\to$ checked fallback mirrors), `'r2'` (Cloudflare R2 only over AWS SigV4 HTTPS; fails fast if `R2_*` unset and records uncached items as non-sentinel `r2-miss` skips), or `'mirrors'` (bypass R2 and fetch from checked HTTPS mirrors only). |
| `limit` | `string` | No | `'50'` | Max volumes to quote in this batch (`40 Popular + 10 Recent` slot split). |
| `delay_range` | `string` | No | `'8-16'` | Randomized decimal delay range in seconds between Gutenberg mirror fallback requests *(Cloudflare R2 reads execute with `0s` delay)*. |
| `target_count` | `string` | No | `'14'` | Desired quotes extracted per volume (`10–16` bounded). |
| `ids` | `string` | No | `''` | Comma-separated Gutenberg IDs for targeted backfill (blank uses automatic priority pool scanning). |
| `mirror_pglaf` | `boolean` | No | `true` | Enable `gutenberg.pglaf.org` mirror (used in `auto` / `mirrors`). |
| `mirror_aleph` | `boolean` | No | `false` | Enable `aleph.gutenberg.org` mirror (used in `auto` / `mirrors`). |
| `mirror_readingroo` | `boolean` | No | `false` | Enable `gutenberg.readingroo.ms` mirror (used in `auto` / `mirrors`). *(At least 1 mirror must be checked when `text_source` is `'mirrors'`; `'r2'` passes `--mirrors=none`, and `'auto'` skips mirror fallback cleanly if all checkboxes are left unchecked.)* |
| `force_refresh` | `boolean` | No | `false` | Re-extract and overwrite quotes even for already-populated IDs (`--force`). |
| `dry_run` | `boolean` | No | `false` | Simulate extraction and generate SQL preview without writing Supabase or purging Vercel Edge cache. |

- **CI Execution Sequence**:
  1. Checkout repo, setup Node `22` with npm cache, `npm ci`.
  2. Validate `text_source` (`auto` / `r2` / `mirrors`), resolve checked mirrors (`--mirrors=...` or `--mirrors=none` when `text_source` is `'r2'` / `auto` with no mirrors checked, failing fast only when `'mirrors'` leaves zero mirrors enabled), and run `node scripts/sync-featured-quotes.js` with `--source`, `limit`, `delay_range`, `target_count`, optional `--ids=...`, `--force`, and `--dry-run`.
  3. When `dry_run != 'true'`: run `node scripts/purge-vercel-cache.js --tags=quotes`.
- **Local CLI Equivalents**:
  ```bash
  # Dry-run without DB mutation (inspect --help for all flags)
  npm run quotes:sync -- --dry-run
  node scripts/sync-featured-quotes.js --help

  # Strict R2-only backfill (0s delay, no sentinel written on R2 misses)
  npm run quotes:sync -- --source=r2 --limit=50

  # Sync specific classics or custom mirror/prune settings
  npm run quotes:sync -- --source=mirrors --mirrors=pglaf,aleph --ids=1342,84,2701 --force
  npm run quotes:sync -- --source=auto --limit=50 --delay-range=8-16 --mirrors=pglaf --max-prune=2000
  node scripts/purge-vercel-cache.js --tags=quotes
  ```

---

### 3.3 `Gutenberg Translations Sync` ([`.github/workflows/translations-sync.yml`](../.github/workflows/translations-sync.yml))

On-demand FRBR relational edition clusterer fetching Wikidata `P2034` / `P407` mappings (with offline cache fallback) and batch-upserting multilingual book links into `public.book_translations`.

- **Triggers**: `workflow_dispatch` only *(automated Sunday runs are chained in `.github/workflows/catalog-sync.yml`)*
- **Concurrency & Permissions**: `concurrency: gutenberg-translations-sync` (`cancel-in-progress: false`), `permissions: contents: read`, `timeout-minutes: 20`
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
- **Concurrency & Permissions**: `concurrency: cache-purge` (`cancel-in-progress: false`), `permissions: contents: read`, `timeout-minutes: 5`
- **Dependencies**: Zero `npm ci` / zero npm cache (uses Node `22` built-in `fetch` directly; completes in seconds).
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `purge_catalog` | `boolean` | No | `false` | Purge `catalog` Edge tag (`/api/books` catalog listings & book metadata). |
| `purge_quotes` | `boolean` | No | `false` | Purge `quotes` Edge tag (`/api/books?pool=quotes` & `has_quotes=true`). |
| `purge_translations` | `boolean` | No | `false` | Purge `translations` Edge tag (`/api/books/translations` FRBR editions). |
| `purge_covers` | `boolean` | No | `false` | Purge `covers` Edge tag (`/api/books/content?type=cover` private R2 JPEG proxy). |
| `purge_book_content` | `boolean` | No | `false` | Purge `book-content` Edge tag (`/api/books/content` plain-text delivery). |
| `target` | `choice` (`production`, `preview`) | **Yes** | `'production'` | Target Vercel environment (`production` or `preview`). |
| `dry_run` | `boolean` | No | `false` | Build target endpoint URL, log payload, and publish `$GITHUB_STEP_SUMMARY` without calling Vercel API. |

- **Fail-Fast Safety Guard**: All five tag checkboxes start **unchecked (`false`)** intentionally so operators never trigger accidental full purges; submitting with zero checkboxes checked immediately fails (`exit 1`) with an error notice in logs and Job Summary before contacting Vercel.
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
- **Concurrency & Permissions**: `concurrency: ci-${{ github.workflow }}-${{ github.ref }}` (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`), `permissions: contents: read`, `timeout-minutes: 25`
- **Required Secrets**: **None** (runs hermetically with MSW v2 network mocks and bundled test fixtures)
- **CI Execution Sequence**:
  1. Checkout repo (`actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`), setup Node `22` with npm cache (`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`), run `npm ci`.
  2. Execute `npm run verify:build` (Pass 0.5 secret/env/AST boundary scan $\to$ Pass 0.75 7-Pillar OWASP/SAST/License-SCA/Workflow/AST taint suite $\to$ Pass 1 TypeScript $\to$ Pass 2 & 3 Vitest with `95/95/92/85` V8 coverage $\to$ Pass 4 AST doc sync parity incl. `SECURITY.md` $\to$ Pass 5 ADR, 19 governance docs, circular `SECURITY.md` parity, 1:1 SQL$\leftrightarrow$TS parity, 1:1 workflow/cron parity & co-location $\to$ Pass 6 ESLint zero-warning + Knip $\to$ Pass 7 Next.js production build + compiled `.next/routes-manifest.json` & live `127.0.0.1` HTTP smoke probe).
  3. Execute `git diff --exit-code` across the deterministic AST/SemVer/contract living-documentation artifacts (`docs/ARCHITECTURE.md`, `7` modular specs under `docs/architecture/`, `docs/GUTENBERG_PARSER.md`, `docs/SYSTEM_CONTRACTS.md`, `docs/GITHUB_ACTIONS.md`, `CHANGELOG.md`, `ROADMAP.md`, `package.json`, `package-lock.json`, `SECURITY.md`, `.github/workflows/release.yml`, and `.github/ISSUE_TEMPLATE/bug_report.yml`) to reject PRs with unsynchronized generated outputs (deliberately excluding `docs/QUALITY_AUDIT_REPORT.md`, `docs/quality-audit-results.json`, `README.md`, and `next-env.d.ts` whose outputs embed dynamic V8 coverage floats or local Next typegen stubs).
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
  - `workflow_dispatch` with required `tag` string (default `'v2.9.73'`, automatically synchronized to `RELEASES[0].version` in [`.github/workflows/release.yml`](../.github/workflows/release.yml) by `scripts/generate-changelog.js` via `npm run docs:sync`)
- **Permissions & Timeout**: Top-level `contents: read`; job-level `contents: write`, `timeout-minutes: 25`
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

- **Run Title (`run-name`)**: `'CodeQL SAST (${{ github.event_name }} on ${{ github.ref_name }})'` (visually distinguishes CodeQL runs from commit-titled `CI Pipeline` runs in the Actions feed)
- **Triggers**:
  - `push` and `pull_request` on `main`, `master`, `dev`
  - Scheduled: `cron: 30 1 * * 1` (Every Monday at `01:30 UTC`, staggered away from Sunday `catalog-sync.yml`)
- **Permissions & Concurrency**: Top-level `contents: read`; job-level `actions: read`, `contents: read`, `security-events: write`; `concurrency: codeql-${{ github.ref }}` (`cancel-in-progress: true`)
- **Language Matrix**: `javascript-typescript`, `actions` (`fail-fast: false`, `timeout-minutes: 20`)
- **GitHub Repository Settings Note**: Because Bookarium configures CodeQL via `.github/workflows/codeql.yml` (Advanced Setup), keep GitHub UI **Settings $\to$ Code security $\to$ CodeQL analysis** *Default setup* disabled so the two modes never conflict.

---

### 3.8 `Dependency Review` ([`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml))

Automated pull-request supply-chain firewall backed by GitHub's Dependency Graph, blocking newly introduced `high` or `critical` vulnerabilities and incompatible copyleft (`GPL-2.0`, `GPL-3.0`, `AGPL-3.0`) transitive dependencies before merge.

- **Run Title (`run-name`)**: `'Dependency & License Review (PR #${{ github.event.pull_request.number }})'` (visually distinguishes dependency gates from commit-titled `CI Pipeline` runs on pull requests)
- **Triggers**: `pull_request` on `main`, `master`, `dev`
- **Permissions, Concurrency & Timeout**: `contents: read`, `concurrency: dependency-review-${{ github.ref }}` (`cancel-in-progress: true`), `timeout-minutes: 10`
- **Policy Configuration**: `fail-on-severity: high`, `deny-licenses: GPL-2.0, GPL-3.0, AGPL-3.0` (powered automatically on public repositories by GitHub Dependency Graph).

---

### 3.9 `Sync catalog-cache Tag` ([`.github/workflows/catalog-tag-sync.yml`](../.github/workflows/catalog-tag-sync.yml))

Lightweight zero-checkout automation keeping the `catalog-cache` Release's auto-generated `Source code (zip)` and `Source code (tar.gz)` aligned with `master` without altering `gutenberg-catalog-cache.json.gz` or `.sha256` snapshots or modifying [`ci.yml`](../.github/workflows/ci.yml)'s read-only permissions.

- **Run Title (`run-name`)**: `'Refresh catalog-cache Source Archives (${{ github.event_name }} on ${{ github.ref_name }})'` (visually distinguishes tag/archive refreshes from commit-titled `CI Pipeline` runs in the Actions feed)
- **Triggers**:
  - `push` on `master`
  - `workflow_dispatch`
- **Concurrency & Permissions**: `concurrency: catalog-cache-tag-sync` (`cancel-in-progress: true`), `permissions: contents: write`, `timeout-minutes: 5`
- **Dependencies**: Zero `npm ci`, zero `actions/checkout` (runs directly with GitHub's pre-installed `gh` CLI)
- **CI Execution Sequence**:
  1. Inspect whether the `catalog-cache` Release exists via `gh release view catalog-cache --repo "${GITHUB_REPOSITORY}"` with `GH_REPO: ${{ github.repository }}` (exiting `0` cleanly only when stderr reports `release not found` / `HTTP 404` on fresh forks, and failing loudly via `::error::` on unexpected CLI/API errors).
  2. Call `gh api --method PATCH "repos/${GITHUB_REPOSITORY}/git/refs/tags/catalog-cache" -f "sha=${GITHUB_SHA}" -F "force=true"` to advance the existing tag ref in place (never deleting the tag, preserving uploaded catalog assets).

---

### 3.10 `R2 Asset Delta & Backfill Sync` ([`.github/workflows/r2-sync.yml`](../.github/workflows/r2-sync.yml))

On-demand (`workflow_dispatch`) bulk backfill and ID repair workflow keeping private Cloudflare R2 storage (`books/<id>.txt.gz`, `covers/<id>.jpg`, `_meta/r2-sync-state.json.gz`) synchronized with active public-domain catalog books via fast targeted Ubuntu `rsync --files-from` (`aleph.gutenberg.org` $\leftrightarrow$ `rsync.ibiblio.org` multi-host failover with selectable primary host) or PGLAF HTTPS fallback without re-downloading `rdf-files.tar.bz2`, updating Supabase catalog tables, or re-running quotes/translations.

- **Triggers**: `workflow_dispatch` only *(weekly automated delta runs execute as Step 2 inside `.github/workflows/catalog-sync.yml`)*
- **Concurrency & Permissions**: `concurrency: r2-asset-sync` (`cancel-in-progress: false`), `permissions: contents: read`, `timeout-minutes: 90`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `string` | No | `''` *(blank)* | Max queued volumes to process (leave blank to run up to `max_minutes`, prioritizing 27 hero classics then `download_count DESC`). |
| `ids` | `string` | No | `''` | Comma-separated Gutenberg IDs for targeted repairs (blank scans active catalog vs live R2 inventory). |
| `catalog_source` | `choice` | No | `'auto'` | Catalog input source (`auto` snapshot-first with Supabase fallback, `snapshot` release asset only, or `supabase` live `public.books` PK scan). |
| `source` | `choice` | No | `'rsync'` | Transfer engine: `'rsync'` (`aleph.gutenberg.org` / `rsync.ibiblio.org` `::gutenberg-epub` / `::gutenberg`), `'https'` (PGLAF fallback), or `'auto'`. |
| `rsync_host` | `choice` | No | `'auto'` | Primary `rsync` host order: `'auto'` / `'aleph'` (`aleph.gutenberg.org` $\rightarrow$ `rsync.ibiblio.org` failover) or `'ibiblio'` (`rsync.ibiblio.org` $\rightarrow$ `aleph.gutenberg.org` failover for large backfills). |
| `sync_books` | `boolean` | No | `true` | Sync missing/targeted book plain texts as gzipped `.txt.gz` objects. |
| `sync_covers` | `boolean` | No | `true` | Sync missing/targeted JPEG cover artwork (`pg<id>.cover.medium.jpg` $\to$ `covers/<id>.jpg`). *(At least one of `sync_books` or `sync_covers` must be `true`.)* |
| `force` | `boolean` | No | `false` | Overwrite existing R2 objects in targeted scope (`--force`). |
| `recheck_missing` | `boolean` | No | `false` | Bypass the `90-day` confirmed-missing cooldown cached in `_meta/r2-sync-state.json.gz`. |
| `prune_withdrawn` | `boolean` | No | `true` | Delete copyrighted (`copyright === true`) and withdrawn PG keys (`>= 50,000` catalog floor). |
| `max_minutes` | `string` | No | `'75'` | Clean cutoff time budget in minutes before saving `_meta/r2-sync-state.json.gz` cleanly. |
| `dry_run` | `boolean` | No | `false` | Audit live R2 inventory and delta plan (`$GITHUB_STEP_SUMMARY`) without uploading or deleting R2 objects. |

- **CI Execution Sequence**:
  1. Checkout repo, setup Node `22` with npm cache, `npm ci`.
  2. When `catalog_source` is not `'supabase'`, attempt to restore `gutenberg-catalog-cache.json.gz` + `.sha256` from release `catalog-cache` via `gh release download` with `--repo "$GITHUB_REPOSITORY"` (falling back cleanly to paginated `books_pkey` Supabase queries in `'auto'` mode if absent).
  3. Exit `0` gracefully only when **all 4** `R2_*` GitHub Secrets are unset; otherwise execute `node scripts/sync-r2-assets.js` (`--catalog-source`, `--rsync-host`, `--purge-tags-file=r2-purge-tags.txt`, bounded parallel R2 PUT concurrency `8`, multi-host `aleph.gutenberg.org` $\leftrightarrow$ `rsync.ibiblio.org` retry failover & transport-error shielding, mid-batch budget checks, and `try ... finally` state checkpoints) and publish the **Bucket Coverage**, **Execution Telemetry**, and bounded **Changed Volumes** tables to `$GITHUB_STEP_SUMMARY`.
  4. When `dry_run != 'true'` and `r2-purge-tags.txt` is non-empty (`deleted > 0` or `--force` overwrites), invoke `node scripts/purge-vercel-cache.js --tags="$PURGE_TAGS"` for affected `covers`/`book-content` tags.
- **Local CLI Equivalents**:
  ```bash
  # Dry-run R2 coverage audit
  npm run r2:sync -- --dry-run --limit=100

  # Repair specific classics from live Supabase or run local Windows HTTPS / WSL rsync sync (or ibiblio primary backfill)
  npm run r2:sync -- --catalog-source=supabase --ids=1342,84 --force --source=https
  npm run r2:sync -- --cache-file=gutenberg-catalog-cache.json.gz --source=wsl-rsync --rsync-host=ibiblio --max-minutes=25
  ```

---

### 3.11 `R2 Content Integrity Scan` ([`.github/workflows/r2-content-scan.yml`](../.github/workflows/r2-content-scan.yml))

Manual-only (`workflow_dispatch`), zero-`npm ci` read-only audit scanning stored `books/<id>.txt.gz` objects in private Cloudflare R2 for unwanted or injected strings (`asiafilm` default) without consuming Vercel compute, Supabase queries, or Project Gutenberg mirror traffic.

- **Triggers**: `workflow_dispatch` only *(never runs on `push` or `cron`)*
- **Concurrency & Permissions**: `concurrency: r2-content-scan` (`cancel-in-progress: false`), `permissions: contents: read`, `timeout-minutes: 60`
- **Manual Inputs (`workflow_dispatch`)**:

| Input | Type | Required | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `terms` | `string` | Yes | `'asiafilm'` | Comma-separated literal search terms (`1–20` terms, matched via ReDoS-safe `indexOf`). |
| `prefix` | `choice` | No | `'books/'` | R2 key prefix allowlist (`'books/'`). |
| `ids` | `string` | No | `''` | Optional comma-separated Gutenberg IDs (blank = enumerate stored `books/*.txt.gz` keys). |
| `concurrency` | `string` | No | `'32'` | Parallel `GetObject` workers (`1–64`). |
| `limit` | `string` | No | `''` | Optional max number of stored books to scan. |
| `max_matches` | `string` | No | `'100'` | Max matched rows rendered in console and `$GITHUB_STEP_SUMMARY` (`1–500`). |
| `max_minutes` | `string` | No | `'45'` | Clean time-budget cutoff in minutes (`1–120`). |
| `case_sensitive` | `boolean` | No | `false` | Require exact letter casing when matching terms. |
| `fail_on_match` | `boolean` | No | `false` | Exit non-zero if any book matches a term. |
| `dry_run` | `boolean` | No | `false` | Enumerate keys via `ListObjectsV2` only (`0` `GetObject` Class B reads) and print projected inventory. |

- **CI Execution Sequence**:
  1. Checkout repo and setup Node `22` (no `npm ci`, zero third-party dependencies).
  2. Exit `0` gracefully when all 4 `R2_*` secrets are unset; otherwise validate `env:`-bound inputs cleanly and run `node scripts/scan-r2-content.js "${SCAN_ARGS[@]}"`.
  3. Streams throttled CI progress heartbeats (`10s` / `5%` intervals), live `[MATCH]` alerts, and capped inline read-error warnings while running, then reports matching book IDs, hit counts, and sanitized context snippets to `$GITHUB_STEP_SUMMARY` alongside Class A / Class B / MB downloaded telemetry.
- **Local CLI Equivalents**:
  ```bash
  # Dry-run key inventory only (0 Class B GetObject reads)
  npm run r2:scan -- --dry-run

  # Full bucket scan for 'asiafilm' or targeted check across specific book IDs
  npm run r2:scan
  npm run r2:scan -- --ids=1342,84 --terms=asiafilm,asiafilms
  ```

---

## 🛠️ 4. Related GitHub Automation & Marketplace Actions

<!-- BEGIN:actions-pins -->
| Component | Configuration / Pin | Scope & Schedule |
| :--- | :--- | :--- |
| **Dependabot** | [`.github/dependabot.yml`](../.github/dependabot.yml) | Automated `monthly` PRs targeting `master` for `npm` dependencies (`open-pull-requests-limit: 5`, `chore(deps)`) and `github-actions` commit-SHA updates (`open-pull-requests-limit: 3`, `chore(ci)`). |
| **Checkout Action** | `actions/checkout@11d5960a326750d5838078e36cf38b85af677262` (`v4.4.0`) | Used across `10` workflows (`fetch-depth: 0` in `release.yml` for tag/changelog extraction; omitted in `catalog-tag-sync.yml`). |
| **Node.js Setup** | `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (`v4.4.0`) | Pins `node-version: '22'` across 8 Node.js workflows (enables `cache: 'npm'` except `r2-content-scan.yml` and `cache-purge.yml`, which need zero npm dependencies). |
| **CodeQL Action (`init` / `analyze`)** | `github/codeql-action/*@33d7b85da1a04171e211befe2c739303b9a4c066` (`v4.39.3`) | Executes multi-target `javascript-typescript` and `actions` SARIF analysis inside `codeql.yml`. |
| **Dependency Review Action** | `actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48` (`v4.9.0`) | Enforces `high` CVE and `GPL`/`AGPL` license checks on PR dependency changes inside `dependency-review.yml`. |
| **Release Publisher** | `softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` (`v2.6.2`) | Publishes GitHub Releases from extracted `CHANGELOG.md` notes inside `release.yml`. |

> **Workflow Security Posture (Pass 0.75 Enforced)**: All 11 workflows declare explicit least-privilege `permissions:`, pin every external `uses:` step to a 40-character immutable commit SHA (`/@[0-9a-f]{40}$/`), forbid combining `pull_request_target` with `contents: write`, and bind inputs via `env:` instead of directly interpolating `${{ github.event.* }}` inside `run:` shell scripts.
<!-- END:actions-pins -->

---

## 🩺 5. Quick Operator Troubleshooting

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| `cache-purge.yml` fails immediately with *"At least one cache tag checkbox (`purge_catalog`, `purge_quotes`, `purge_translations`, `purge_covers`, or `purge_book_content`) must be checked."* | All 5 tag checkboxes left unchecked (`false`). | Re-run **Manual Cache Purge** with one or more of `purge_catalog`, `purge_quotes`, `purge_translations`, `purge_covers`, or `purge_book_content` checked. |
| `sync-r2-assets.js` fails with *"Partial Cloudflare R2 configuration detected"* or *"Invalid R2_ACCOUNT_ID / R2_BUCKET_NAME"* | Only some of the 4 `R2_*` secrets were configured, or `R2_BUCKET_NAME` contains uppercase characters. | Either provide all 4 valid `R2_*` secrets (with lowercase S3-compatible bucket naming) or leave all 4 unset to allow fork-safe `exit 0` skipping. |
| `r2_sync` / `quotes_sync` logs `::warning::` and fails via `Verify Downstream Step Outcomes` | An infrastructure outage caused zero successes (`updated === 0` / `succeeded === 0`) or `>= 50%` transfer failure ratio across `>= 5` attempts (`shouldFailR2SyncRun` / `shouldFailFeaturedQuotesRun`). | Upstream catalog snapshot and unaffected sibling steps still ran and purged Edge cache cleanly; inspect Step Summary logs and re-run `r2-sync.yml` or `quotes-sync.yml` individually once the upstream mirror/service recovers. |
| `quotes-sync.yml` fails before running script | `text_source` was set to `'mirrors'` with none of `mirror_pglaf`, `mirror_aleph`, or `mirror_readingroo` checked, or `'r2'` was chosen without `R2_*` secrets configured. | Enable at least one mirror checkbox for `'mirrors'` mode, add `R2_*` GitHub Secrets for `'r2'` mode, or use `'auto'` (default: `mirror_pglaf: true`). |
| Purge step exits `0` with skip notice in logs | `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` is unset in GitHub Secrets. | Expected safe default for forks; add both secrets under Repository Settings $\to$ Actions to enable live CDN purges. |
| Vercel purge returns `401` / `403` | Token expired or team scope mismatched. | Regenerate `VERCEL_API_TOKEN`, verify `VERCEL_PROJECT_ID` (`prj_...`), and set `VERCEL_TEAM_ID` (`team_...`) if the project belongs to a Vercel Team / personal team. |
| `gh release download catalog-cache` prints not-found warning | First-ever cold sync before `catalog-cache` release exists. | Safe to ignore on first full live run (`limit` blank, `dry_run: false`): the `Publish Updated Catalog Snapshot Cache` step creates the `catalog-cache` release automatically once active books exceed `50,000`. |
| `release.yml` changelog extraction is empty | Dispatched tag does not match an entry header in `CHANGELOG.md`. | Update `RELEASES[0]` in [`scripts/generate-changelog.js`](../scripts/generate-changelog.js) and run `npm run docs:sync` first so `CHANGELOG.md` and `release.yml` share the exact tag version. |
