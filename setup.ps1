#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates the Entra ID app registration for Office 365 Security Audit Framework.

.DESCRIPTION
    This script creates an app registration with all required Microsoft Graph
    application permissions, grants admin consent, and outputs the credentials
    for your .env file.

    Requires PowerShell 7+ and the Microsoft.Graph module.
    Must be run by a Global Administrator or Application Administrator.

.EXAMPLE
    ./setup.ps1
#>

#Requires -Version 7.0

$ErrorActionPreference = 'Stop'

# ── Check / install Microsoft.Graph module ──────────────────────────────────
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Applications)) {
    Write-Host "📦 Installing Microsoft.Graph module (this may take a minute)..." -ForegroundColor Yellow
    Install-Module Microsoft.Graph -Scope CurrentUser -Force -AllowClobber
}

# ── Connect to Microsoft Graph ──────────────────────────────────────────────
Write-Host "`n🔐 Connecting to Microsoft Graph (sign in as Global Admin)..." -ForegroundColor Cyan
Connect-MgGraph -Scopes "Application.ReadWrite.All", "AppRoleAssignment.ReadWrite.All" -NoWelcome

$context = Get-MgContext
$tenantId = $context.TenantId
Write-Host "✅ Connected to tenant: $tenantId" -ForegroundColor Green

# ── Create the app registration ─────────────────────────────────────────────
$appName = "M365 Audit Framework (Read-Only)"

Write-Host "`n📝 Creating app registration: $appName" -ForegroundColor Cyan

# Define all 15 required Graph application permissions
$graphAppId = "00000003-0000-0000-c000-000000000000"
$permissions = @(
    @{ Id = "df021288-bdef-4463-88db-98f22de89214"; Type = "Role" }  # User.Read.All
    @{ Id = "483bed4a-2ad3-4361-a73b-c83ccdbdc53c"; Type = "Role" }  # RoleManagement.Read.Directory
    @{ Id = "246dd0d5-5bd0-4def-940b-0421030a5b68"; Type = "Role" }  # Policy.Read.All
    @{ Id = "38d9df27-64da-44fd-b7c5-a6fbac20248f"; Type = "Role" }  # UserAuthenticationMethod.Read.All
    @{ Id = "9a5d68dd-52b0-4cc2-bd40-abcf44ac3a30"; Type = "Role" }  # Application.Read.All
    @{ Id = "40f97065-369a-49f4-947c-6a255697ae91"; Type = "Role" }  # MailboxSettings.Read
    @{ Id = "810c84a8-4a9e-49e6-bf7d-12d183f40d01"; Type = "Role" }  # Mail.Read
    @{ Id = "83d4163d-a2d8-4d3b-9695-4ae3ca98f888"; Type = "Role" }  # SharePointTenantSettings.Read.All
    @{ Id = "332a536c-c7ef-4017-ab91-336970924f0d"; Type = "Role" }  # Sites.Read.All
    @{ Id = "a82116e5-55eb-4c41-a434-62fe8a61c773"; Type = "Role" }  # Sites.FullControl.All
    @{ Id = "01d4889c-1287-42c6-ac1f-5d1e02578ef6"; Type = "Role" }  # Files.Read.All
    @{ Id = "2280dda6-0bfd-44ee-a2f4-cb867cfc4c1e"; Type = "Role" }  # Team.ReadBasic.All
    @{ Id = "660b7406-55f1-41ca-a0ed-0b035e182f3e"; Type = "Role" }  # TeamMember.Read.All
    @{ Id = "c1684f21-1984-47fa-9d61-2dc8c296bb70"; Type = "Role" }  # OnlineMeetings.Read.All
    @{ Id = "e12dae10-5a57-4817-b79d-dfbec5348930"; Type = "Role" }  # AppCatalog.Read.All
)

$resourceAccess = @{
    ResourceAppId  = $graphAppId
    ResourceAccess = $permissions
}

$app = New-MgApplication `
    -DisplayName $appName `
    -SignInAudience "AzureADMyOrg" `
    -RequiredResourceAccess @($resourceAccess)

$appId = $app.AppId
$appObjectId = $app.Id
Write-Host "✅ App created — Client ID: $appId" -ForegroundColor Green

# ── Create service principal ────────────────────────────────────────────────
Write-Host "`n🔧 Creating service principal..." -ForegroundColor Cyan
$sp = New-MgServicePrincipal -AppId $appId
$spId = $sp.Id
Write-Host "✅ Service principal created — Object ID: $spId" -ForegroundColor Green

# ── Grant admin consent ─────────────────────────────────────────────────────
Write-Host "`n🔑 Granting admin consent for all permissions..." -ForegroundColor Cyan

# Get the Microsoft Graph service principal
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$graphAppId'" -Top 1

$permissionNames = @(
    "User.Read.All", "RoleManagement.Read.Directory", "Policy.Read.All",
    "UserAuthenticationMethod.Read.All", "Application.Read.All",
    "MailboxSettings.Read", "Mail.Read", "SharePointTenantSettings.Read.All",
    "Sites.Read.All", "Sites.FullControl.All", "Files.Read.All",
    "Team.ReadBasic.All", "TeamMember.Read.All", "OnlineMeetings.Read.All",
    "AppCatalog.Read.All"
)

for ($i = 0; $i -lt $permissions.Count; $i++) {
    $roleId = $permissions[$i].Id
    $name = $permissionNames[$i]
    try {
        New-MgServicePrincipalAppRoleAssignment `
            -ServicePrincipalId $spId `
            -PrincipalId $spId `
            -ResourceId $graphSp.Id `
            -AppRoleId $roleId | Out-Null
        Write-Host "  ✅ $name" -ForegroundColor Green
    }
    catch {
        Write-Host "  ⚠️  $name — $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ── Create client secret ────────────────────────────────────────────────────
Write-Host "`n🔐 Creating client secret (1 year expiry)..." -ForegroundColor Cyan

$secret = Add-MgApplicationPassword -ApplicationId $appObjectId -PasswordCredential @{
    DisplayName = "o365-audit-cli"
    EndDateTime = (Get-Date).AddYears(1)
}

$clientSecret = $secret.SecretText

# ── Output credentials ──────────────────────────────────────────────────────
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "  🎉 Setup complete! Add these to your .env file:" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "TENANT_ID=$tenantId"
Write-Host "CLIENT_ID=$appId"
Write-Host "CLIENT_SECRET=$clientSecret"
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "⚠️  Save the CLIENT_SECRET now — it cannot be retrieved later!" -ForegroundColor Yellow
Write-Host ""

# ── Disconnect ──────────────────────────────────────────────────────────────
Disconnect-MgGraph | Out-Null
Write-Host "🔌 Disconnected from Microsoft Graph." -ForegroundColor Gray
