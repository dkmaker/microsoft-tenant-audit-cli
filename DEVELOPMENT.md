# Development Guide

## Prerequisites

- Node.js 22+
- pnpm (`npm install -g pnpm`)
- TypeScript knowledge

## Setup

```bash
git clone <repo-url>
cd office365-audit-framework
pnpm install
```

## Build

```bash
# Full build
pnpm build

# Type check only (no emit)
pnpm exec tsc --noEmit
```

## Project Structure

```
src/
  index.ts          # CLI entry point (Commander.js)
  config.ts         # .env config loading
  graph/            # Microsoft Graph API client
  checks/           # Security check modules (auto-discovered)
    identity/       # Entra ID checks (MFA, roles, guests, etc.)
    data-protection/# Exchange & SharePoint checks
    access-control/ # Teams checks
    threat-protection/ # Anti-spam, transport rules
  engine/           # Check runner and type definitions
  report/           # JSON and HTML report generation
  cache/            # Local result cache for drift detection
dist/               # Compiled output (git-ignored)
output/             # Audit reports (git-ignored)
```

## Adding a New Check

1. Create a `.ts` file in the appropriate `src/checks/<category>/` folder
2. Export a default object implementing the `SecurityCheck` interface (see `src/engine/types.ts`)
3. The check is auto-discovered at runtime — no registration needed

## Running Tests

```bash
# Generate test reports with sample data
node dist/report/test-reports.js
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the CLI (`node dist/index.js`) |
