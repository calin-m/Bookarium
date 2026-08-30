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
# Run unit tests with code coverage
npm test

# Run interactive Vitest UI
npm run test:ui

# Run tests in watch mode
npm run test:watch
```

### Automated Governance & Quality Checks
```bash
# Full 7-Gateway Quality Engine
npm run verify

# Sync Living Documentation (AST Matrix + Changelog)
npm run docs:sync

# Quality audit report
npm run report

# Add a new Architecture Decision Record
npm run adr:new -- "Decision Title"
```
