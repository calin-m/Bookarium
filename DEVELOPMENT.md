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
# Run unit tests with code coverage (enforcing >= 85% floor)
npm test

# Run tests quickly without coverage overhead
npm run test:fast

# Run security test suite
npm run test:security

# Run interactive Vitest UI
npm run test:ui

# Run tests in watch mode
npm run test:watch
```

### Automated Governance & Quality Checks
```bash
# Full 7-Gateway Quality Engine (Passes 0.5 - 7)
npm run verify

# Pass 0.75: Dependency security vulnerability audit
npm run security:audit

# Sync Living Documentation (AST Matrix, Gutenberg Parser docs, Quality Report, Roadmap, and Changelog)
npm run docs:sync

# Quality audit report (Pass 4 engine audit)
npm run report

# Add a new Architecture Decision Record (ADR)
npm run adr:new -- "Decision Title"

# Public Domain Catalog Ingestion & Translation Pipelines
npm run catalog:ingest
npm run catalog:reconcile
npm run translations:fetch
```
