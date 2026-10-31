# Development Guide - Bookarium

## Getting Started

### Prerequisites
- Node.js 20+ (Node 22+ recommended)
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

# Public Domain Catalog Ingestion & Translation Pipelines
npm run catalog:sync
npm run catalog:ingest
npm run translations:sync
```
