# Bookarium — 100% Legal Public Domain Library & Reader

> **Pure Literature. Zero Paywalls. Zero API Keys.**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.8-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.19-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1.11-729B1B?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Code Coverage](https://img.shields.io/badge/Coverage-92.34%25-brightgreen?style=flat-square)](docs/QUALITY_AUDIT_REPORT.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

An ultra-refined, high-performance web application for discovering, reading, and downloading 100% legal, public domain books (Zero-Copyright / CC0 / Gutenberg Public Domain). Built with **Next.js 16 App Router**, **TanStack React Query**, **Zustand offline persistence**, **Framer Motion**, and verified by a deterministic **7-Gateway Quality Engine**.

---

## 🎨 Design Inspiration & Aesthetic Philosophy

Bookarium's visual identity and tactile layout are deeply inspired by classical editorial typography, archival letterpress printing, and modern Figma bookstore design systems:

* **Figma Editorial Concept**: Inspired by the minimalist elegance of curated bookstore layouts (such as the *Booksaw / Classic Editorial Bookstore* design concepts on the Figma Community).
* **Open-Book Skeuomorphic Details**: Custom open-book card spreads with subtle center spine creases (`.book-center-crease`), realistic paper texture shadows (`shadow-booksaw`), and page depth elevation.
* **Warm Editorial Palettes**:
  * **Day / Standard**: Clean cream-paper tones (`#f9f8f6`, `#f5f3ec`) with rich obsidian ink typography.
  * **Sepia Reading**: Warm amber parchment tones (`#f4ebd9`, `#ede2cc`) for eye comfort during long reading sessions.
  * **Dark Mode**: High-contrast slate obsidian canvas (`#0c0e12`, `#0e1117`) preserving focus in low-light settings.
* **Refined Typography**: Pairings of classic literary serifs, clean sans-serifs, and monospace archival metadata accents.

---

## 🌐 Data Sources & API References

Bookarium runs on an open, decentralized architecture requiring **Zero Third-Party Developer Keys**:

| Service / Source | Endpoint / Provider | Description & Usage |
|---|---|---|
| **Gutendex REST API** | [`https://gutendex.com/`](https://gutendex.com/) | Open-source JSON Web API indexing over 70,000+ Project Gutenberg public domain titles. Provides search, topic filters, author timelines, download metrics, and metadata with strict `copyright=false` filtering. |
| **Project Gutenberg CDN** | [`https://www.gutenberg.org/`](https://www.gutenberg.org/) | Direct content delivery network providing unabridged plain text (`.txt`), official EPUB packages (`.epub.images`, `.epub.noimages`), Kindle/MOBI formats, and web-ready HTML. |
| **Public Domain Archive Proxy** | `/api/books` & `/api/books/content` | Next.js server-side route proxies providing caching, CORS handling, and guaranteed public domain integrity before client delivery. |

---

## 🎯 Key Features & Capabilities

* **Zero API Key Requirement**: Works instantly out of the box with zero third-party developer keys, sign-ups, or credit card walls.
* **Strict Public Domain Integrity**: All queries programmatically enforce `copyright=false` through Gutendex and Project Gutenberg.
* **Interactive Studio Bookshelf Mode**:
  * **Skeuomorphic Wooden Ledge**: Tactile shelf presentation with physical depth shadows, spine ledges, and linen backdrops.
  * **Embossed Vertical Spines**: Distinct palette-styled book spines with dynamic heights, gold/silver embossed lettering, bookmark ribbons, and glowing progress pips.
  * **Hover Action Cards**: Floating preview cards elevated above the shelf with instant `Read`, `Download`, and `Bookmark` actions.
* **Dedicated In-Browser Focus Reader (`/read/[id]`)**:
  * **Intelligent Gutenberg Chapter Engine**: Detects true prose chapters while filtering front-matter index clusters and preserving prefaces and extracts.
  * **True Book-Wide Global Pagination**: Calculates virtual pages across the entire volume (e.g. 901 pages for *Moby Dick*, 503 pages for *Pride and Prejudice*) with keyboard (`←`/`→`) and input page jumping.
  * **Sticky Thin Editorial Footer**: Docked pagination bar with zero vertical jumping or layout shift.
  * **Zero Cumulative Layout Shift (0 CLS)**: `scrollbar-gutter: stable` and standardized scrollbar tokens prevent horizontal reflows.
  * **Table of Contents Drawer**: Instant chapter navigation with live starting page number badges (`p. 18`, `p. 28`, `p. 34`) and estimated read times.
  * **Font Scaler & Dynamic Line Height Controls**: Real-time font sizing (12px–32px), dynamic line height (1.2–2.4), Serif / Sans / Mono families, and compact/comfortable reading widths.
* **Dynamic Literary Passages & Quotes**: Rotating showcase of iconic classic quotes linking straight to unabridged volumes with an interactive shuffle trigger.
* **Direct Download Hub**: Multi-format downloads including direct EPUB, clean plain text, mobile-friendly HTML, and Kindle formats.
* **Offline Personal Bookshelf**: Curated collections, reading queue, reading history, and liked titles stored locally via Zustand.

---

## 🏛️ System Architecture Diagrams

### 1. End-to-End System Context & Data Flow

```mermaid
flowchart TD
    User["👤 Reader / Literature Enthusiast"]
    
    subgraph ClientApp ["Bookarium Next.js 16 SPA (src/app/page.tsx)"]
        Nav["Navigation & Bookshelf Toggle (Navbar.tsx)"]
        Hero["Hero Search & Subject Chips (HeroSearch.tsx)"]
        Grid["Interactive Book Grid & Filtering (BookGrid.tsx)"]
        Card["Book Card Component (BookCard.tsx)"]
        Quotes["Dynamic Literary Quotes (LiteraryQuotes.tsx)"]
        Reader["Dedicated In-Browser Reader (src/app/read/[id]/page.tsx)"]
        Drawer["Multi-Format Download Drawer (DownloadDrawer.tsx)"]
        FooterComp["Site Footer & Stats (Footer.tsx)"]
        
        StoreShelf[("⚡ Bookshelf Store\n• savedBooks: []\n• queue: []\n• history: []\n• likedBookIds: []")]
        StoreReader[("📖 Reader Store\n• activeBookId\n• theme (light/dark/sepia)\n• fontSize (12-36px)\n• fontFamily (serif/sans/mono)\n• progress: {}")]
        
        QueryBooks["🔄 useBooks(query, topic, page)"]
        QueryContent["🔄 useBookContent(textUrl, bookId)"]
        
        Nav -->|View Bookshelf| StoreShelf
        Hero -->|Filter Query| QueryBooks
        QueryBooks --> Grid
        Grid --> Card
        Card -->|Open Reader Route| Reader
        Card -->|Open Downloads| Drawer
        Card -->|Bookmark / Like| StoreShelf
        Quotes -->|Read Volume| Reader
        Reader --> StoreReader
        Reader --> QueryContent
        FooterComp --> Nav
    end

    subgraph APILayer ["Server Route & Public Domain API"]
        ProxyRoute["GET /api/books\n(Enforces copyright=false)"]
        ContentProxy["GET /api/books/content\n(Unabridged Text Stream)"]
        GutendexAPI["🌐 Gutendex API\n(70,000+ Gutenberg Titles)"]
        GutenbergContent["🌐 Project Gutenberg Content CDN\n(text/plain & EPUB)"]
        
        QueryBooks --> ProxyRoute
        ProxyRoute --> GutendexAPI
        QueryContent --> ContentProxy
        ContentProxy --> GutenbergContent
    end

    subgraph QualityGateEngine ["7-Gateway Verification Engine"]
        VerifyScript["scripts/verify-build.js"]
        ASTParser["scripts/lib/ast-parser.js"]
        LivingArch["ARCHITECTURE.md"]
        QualityReport["docs/QUALITY_AUDIT_REPORT.md"]
        Changelog["CHANGELOG.md"]
        
        VerifyScript --> ASTParser
        ASTParser --> LivingArch
        VerifyScript --> QualityReport
        VerifyScript --> Changelog
    end

    User <-->|Search, Read, Download| ClientApp
    ClientApp -.->|Validated by| VerifyScript
```

---

### 2. Focus Reader State & Typography Engine

```mermaid
flowchart LR
    subgraph ReaderState ["Zustand Reader Store (useReaderStore)"]
        ActiveBook["Active Book Metadata"]
        FontSize["Font Size (12px - 32px)"]
        FontFamily["Font Family: Serif | Sans | Mono"]
        LineHeight["Line Height: 1.2 - 2.4"]
        Theme["Theme: Light | Dark | Sepia"]
        Progress["Global Page & Book Progress %"]
    end

    subgraph ReaderView ["Dedicated Focus Reader (src/app/read/[id]/page.tsx)"]
        Toolbar["Top Editorial Reader Bar"]
        ContentArea["Book Page Rendering Area"]
        ProgressBar["Top Reading Progress Indicator"]
        FooterBar["Sticky Bottom Pagination Bar"]
        TOC["Table of Contents Slide-Over Drawer"]
    end

    subgraph Persistence ["Browser LocalStorage"]
        LSState[("bookarium-reader-preferences")]
        LSProgress[("bookarium-progress-map")]
    end

    Toolbar -->|Adjust Size / Family / Theme| ReaderState
    ReaderState --> ContentArea
    ReaderState --> ProgressBar
    FooterBar -->|Page Flip / Jump| ReaderState
    TOC -->|"Select Chapter [p. X]"| ReaderState
    ReaderState <--> LSState
    ReaderState <--> LSProgress
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: `>= 20.0.0` (Node 22 LTS recommended)
- **npm**: `>= 10.0.0`

### Installation & Local Development

```bash
# 1. Clone the repository and install dependencies
npm install

# 2. Start local development server (automatically launches browser)
npm run dev:open

# 3. Or launch full development environment with background test watcher
npm run dev:all
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

---

## 🛠️ CLI Command Matrix

| Command | Action / Description |
|---|---|
| `npm run dev` | Starts Next.js development server at `http://localhost:3000` |
| `npm run dev:open` | Starts dev server and opens your default browser concurrently |
| `npm run dev:all` | Starts dev server, Vitest test watcher, and browser concurrently |
| `npm run verify` | **Runs the full 7-Gateway Quality Engine** before commits |
| `npm test` | Runs the full Vitest suite with V8 code coverage report |
| `npm run test:ui` | Launches Vitest interactive visual testing UI |
| `npm run test:watch` | Runs Vitest in reactive watch mode for TDD |
| `npm run typecheck` | Validates TypeScript types across all `.ts`/`.tsx` files |
| `npm run lint` | Runs ESLint 9 rules and Core Web Vitals checks |
| `npm run knip` | Audits repository for unused exports and dead dependencies |
| `npm run docs:sync` | Auto-generates `ARCHITECTURE.md` and `CHANGELOG.md` from AST |
| `npm run adr:new -- "Title"` | Creates a new Architecture Decision Record in `docs/DECISIONS.md` |
| `npm run build` | Compiles optimized Next.js 16 production bundle |

---

## 🛡️ The 7-Gateway Quality Engine

The repository enforces a closed-loop quality verification engine before any release or commit:

```
+-----------------------------------------------------------------------------+
|                     7-GATEWAY CLOSED-LOOP VERIFICATION                      |
+-----------------------------------------------------------------------------+
| Pass 0.5 | Secret Scanner       | Checks repository files for exposed keys  |
| Pass 1   | TypeScript Engine    | Strict typecheck with 0 compile errors    |
| Pass 2   | Vitest Server Mocks  | Validates MSW v2 handlers and query hooks |
| Pass 3   | Vitest Client UI     | Unit & integration tests (>= 80% coverage)|
| Pass 4   | Living Docs Sync     | Auto-updates ARCHITECTURE, AUDIT, & CHANGE|
| Pass 5   | ADR Validation       | Validates DECISIONS.md sequential schema  |
| Pass 6   | Quality & Dead Code  | ESLint check and Knip unused code audit   |
| Pass 7   | Production Build     | Compiles Next.js production bundle        |
+-----------------------------------------------------------------------------+
```

🔒 **Pre-Commit Enforcement**: Any failure in Passes 0.5 through 7 immediately halts execution, outputs exact error telemetry, and automatically blocks the commit from being created.

---

## 📚 Living Documentation Registry

- **Living System Architecture (C4 Level 1-3)**: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Quality & Coverage Audit Report**: [`docs/QUALITY_AUDIT_REPORT.md`](docs/QUALITY_AUDIT_REPORT.md)
- **Machine-Readable Audit Telemetry**: [`docs/quality-audit-results.json`](docs/quality-audit-results.json)
- **Architecture Decision Records (ADRs)**: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- **Master Governance Protocol**: [`.agents/AGENTS.md`](.agents/AGENTS.md)
- **CI/CD Pipeline Guide**: [`docs/PIPELINE_GUIDE.md`](docs/PIPELINE_GUIDE.md)
- **Developer Maintenance Hub**: [`DEVELOPMENT.md`](DEVELOPMENT.md)
- **Semantic Release Changelog**: [`CHANGELOG.md`](CHANGELOG.md)

---

## ⚖️ License & Public Domain Notice

Licensed under the **MIT License**. All queried literature and book texts originate from **Project Gutenberg** and are in the **Public Domain** (Zero Copyright / CC0) in accordance with international public domain statutes.
