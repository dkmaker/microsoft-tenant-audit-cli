# 🛡️ Office 365 Security Audit Framework

A comprehensive security audit tool for Microsoft 365 tenants. Checks identity, data protection, access control, and threat protection configurations against CIS benchmarks and security best practices.

## Features

- **15+ security checks** across Entra ID, Exchange Online, SharePoint, and Teams
- **HTML dashboard** with Chart.js charts — severity breakdown, service/category views, expandable findings
- **JSON reports** for tooling integration
- **Drift detection** — compare runs to identify new and resolved findings
- **Remediation guidance** — description, documentation links, and PowerShell scripts per finding
- **CIS M365 benchmark** mapping with framework references
- **Color-coded CLI** with progress indicators and exit codes

## Prerequisites

- Node.js 22+
- pnpm
- A Microsoft Entra ID (Azure AD) **App Registration** with the following **Application** (not Delegated) API permissions:
  - `Directory.Read.All`
  - `Policy.Read.All`
  - `User.Read.All`
  - `UserAuthenticationMethod.Read.All`
  - `Sites.Read.All`
  - `MailboxSettings.Read`
  - `TeamSettings.ReadWrite.All`

## Setup

```bash
# Clone and install
git clone <repo-url>
cd office365-audit-framework
pnpm install

# Configure credentials
cp .env.example .env
# Edit .env with your Entra ID app registration details

# Build
pnpm build
```

## Usage

```bash
# Run full audit
pnpm start audit

# Filter by category
pnpm start audit --categories identity data-protection

# Filter by service
pnpm start audit --services "Entra ID" Teams

# Verbose output (show individual findings)
pnpm start audit --verbose

# Custom output directory and retention
pnpm start audit --output-dir ./reports --keep-runs 20
```

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--output-dir <dir>` | Output directory for reports | `./output` |
| `--categories <cats...>` | Filter: `identity`, `data-protection`, `access-control`, `threat-protection` | all |
| `--services <svcs...>` | Filter: `"Entra ID"`, `"Exchange Online"`, `SharePoint`, `Teams` | all |
| `--verbose` | Show detailed per-finding output | `false` |
| `--keep-runs <n>` | Number of past runs to retain | `10` |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No critical or high severity findings |
| `1` | Critical or high severity findings detected |
| `2` | Execution error (auth failure, network, etc.) |

## Output

Each run creates a timestamped directory:

```
output/
  2026-03-12T14-30-00/
    report.json       # Machine-readable findings
    report.html       # Interactive HTML dashboard
  latest.json         # Pointer to most recent run
```

### HTML Dashboard

Open `report.html` in any browser to see:

- **Executive summary** — finding counts by severity
- **Severity breakdown** — doughnut chart
- **Findings by service/category** — bar charts
- **Check details table** — status, severity, finding count, framework refs
- **Expandable findings** — affected resources with remediation guidance
- **Drift section** — new/resolved findings vs. previous run (when available)

### Drift Detection

On subsequent runs, the tool automatically compares against the previous run:

- 🆕 **New findings** — issues that appeared since last run
- ✅ **Resolved findings** — issues that were fixed
- The drift summary appears in both CLI output and the HTML dashboard

## Security Checks

| Category | Service | Checks |
|----------|---------|--------|
| Identity | Entra ID | MFA enforcement, conditional access, guest users, app registrations, privileged roles |
| Data Protection | Exchange/SharePoint | Inbox forwarding rules, SharePoint sharing, site permissions |
| Access Control | Teams | Guest access, app policies, app catalog, meeting policies |
| Threat Protection | Exchange | Anti-spam/phish policies, transport rules |

## Development

```bash
# Build
pnpm build

# Type check only
pnpm exec tsc --noEmit

# Run report integration test
node dist/report/test-reports.js
```

## License

ISC
