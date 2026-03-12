# 🛡️ Office 365 Security Audit Framework

A command-line security audit tool for Microsoft 365 tenants. Scans Entra ID, Exchange Online, SharePoint, and Teams configurations against CIS benchmarks and security best practices.

## Features

- **15+ security checks** across identity, data protection, access control, and threat protection
- **HTML dashboard** with severity breakdown charts, expandable findings, and remediation guidance
- **JSON reports** for automation and tooling integration
- **Drift detection** — compare runs to spot new and resolved findings
- **CIS M365 benchmark** mapping with framework references

## Prerequisites

- **Node.js 22+** — [download](https://nodejs.org/)
- **pnpm** — install with `npm install -g pnpm`
- **Microsoft Entra ID App Registration** with the following **Application** (not Delegated) API permissions:

| Permission | Purpose |
|------------|---------|
| `Directory.Read.All` | Read users, roles, groups |
| `Policy.Read.All` | Read conditional access policies |
| `User.Read.All` | Read user profiles |
| `UserAuthenticationMethod.Read.All` | Check MFA status |
| `Sites.Read.All` | Read SharePoint site settings |
| `MailboxSettings.Read` | Read inbox rules |
| `TeamSettings.ReadWrite.All` | Read Teams configuration |

> 💡 See Microsoft's guide on [registering an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) and [granting admin consent](https://learn.microsoft.com/en-us/entra/identity-platform/v2-permissions-and-consent).

### Automated Setup (PowerShell 7)

The included `setup.ps1` script creates the app registration, assigns all permissions, grants admin consent, and outputs your `.env` credentials — all in one step:

```powershell
# Requires PowerShell 7+ and Global Admin rights
./setup.ps1
```

The script will:
1. Install the `Microsoft.Graph` module if missing
2. Prompt you to sign in as a Global Administrator
3. Create the app registration with all 15 required permissions
4. Grant admin consent
5. Generate a client secret (1 year expiry)
6. Print `TENANT_ID`, `CLIENT_ID`, and `CLIENT_SECRET` for your `.env` file

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd office365-audit-framework

# Install dependencies and build
pnpm install
pnpm build

# Link the CLI globally (makes 'o365-audit' available everywhere)
npm link
```

After linking, you can run `o365-audit` from any directory.

## Configuration

Copy the example environment file and fill in your Entra ID app registration credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```ini
TENANT_ID=your-tenant-id
CLIENT_ID=your-app-client-id
CLIENT_SECRET=your-app-client-secret
```

> ⚠️ The `.env` file must be in the directory where you run `o365-audit`, or in the project root.

## Usage

```bash
# Run a full security audit
o365-audit audit

# Audit specific categories only
o365-audit audit --categories identity data-protection

# Audit specific services only
o365-audit audit --services "Entra ID" Teams

# Verbose output (show individual findings)
o365-audit audit --verbose

# Custom output directory and retention
o365-audit audit --output-dir ./reports --keep-runs 20
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
- **Drift section** — new/resolved findings vs. previous run

### Drift Detection

On subsequent runs, the tool automatically compares against the previous run:

- 🆕 **New findings** — issues that appeared since last run
- ✅ **Resolved findings** — issues that were fixed

The drift summary appears in both CLI output and the HTML dashboard.

## Security Checks

| Category | Service | Checks |
|----------|---------|--------|
| Identity | Entra ID | MFA enforcement, conditional access, guest users, app registrations, privileged roles |
| Data Protection | Exchange / SharePoint | Inbox forwarding rules, SharePoint sharing, site permissions |
| Access Control | Teams | Guest access, app policies, app catalog, meeting policies |
| Threat Protection | Exchange | Anti-spam/phish policies, transport rules |

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for build instructions, project structure, and how to add new checks.

## License

ISC
