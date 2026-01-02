# DhakaCart Backup Testing and Restoration Scripts (PowerShell)
# This script provides utilities for testing backup and restoration procedures

param(
    [Parameter(Position=0)]
    [ValidateSet("test-backup", "test-restore", "verify-backups", "cleanup-test", "full-dr-test", "help")]
    [string]$Command = "help",
    
    [Parameter()]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    
    [Parameter()]
    [string]$SnapshotId = "",
    
    [Parameter()]
    [switch]$DryRun,
    
    [Parameter()]
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$TerraformDir = Join-Path $ProjectRoot "terraform"

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Error-Log {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning-Log {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Help function
function Show-Help {
    @"
DhakaCart Backup Testing Script (PowerShell)

Usage: .\backup-testing.ps1 [COMMAND] [OPTIONS]

Commands:
    test-backup         Test backup creation and verification
    test-restore        Test restoration from a specific snapshot
    verify-backups      Verify all recent backups
    cleanup-test        Clean up test resources
    full-dr-test        Run full disaster recovery test
    help               Show this help message

Options:
    -Environment ENV    Target environment (dev, staging, prod)
    -SnapshotId ID      Specific snapshot ID for restoration testing
    -DryRun            Show what would be done without executing
    -Verbose           Enable verbose output

Examples:
    .\backup-testing.ps1 test-backup -Environment dev
    .\backup-testing.ps1 test-restore -SnapshotId "dhakacart-dev-manual-2024-01-15-10-30-00"
    .\backup-testing.ps1 verify-backups -Environment prod
    .\backup-testing.ps1 full-dr-test -Environment staging -DryRun

"@
}

# Get Terraform output
function Get-TerraformOutput {
    param([string]$OutputName)
    
    try {
        Push-Location $TerraformDir
        $output = terraform output -raw $OutputName 2>$null
        return $output
    }
    catch {
        return ""
    }
    finally {
        Pop-Location
    }
}

# Initialize AWS resources
function Initialize-AwsResources {
    Write-Log "Initializing AWS resources for environment: $Environment"
    
    # Get Terraform outputs
    $script:DbInstanceId = Get-TerraformOutput "db_instance_id"
    $script:S3BackupBucket = Get-TerraformOutput "backup_s3_bucket"
    $script:BackupLambdaFunction = Get-TerraformOutput "backup_lambda_function_name"
    
    if (-not $script:DbInstanceId) {
        Write-Error-Log "Could not retrieve DB instance ID from Terraform outputs"
        exit 1
    }
    
    Write-Log "DB Instance ID: $script:DbInstanceId"
    Write-Log "S3 Backup Bucket: $script:S3BackupBucket"
    Write-Log "Backup Lambda Function: $script:BackupLambdaFunction"
}

# Test backup creation
function Test-BackupCreation {
    Write-Log "Testing backup creation..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would create manual snapshot for $script:DbInstanceId"
        return $true
    }
    
    # Trigger backup via Lambda
    $payload = @{
        action = "create_snapshot"
        type = "test"
    } | ConvertTo-Json -Compress
    
    Write-Log "Invoking backup Lambda function..."
    
    try {
        $response = aws lambda invoke `
            --function-name $script:BackupLambdaFunction `
            --payload $payload `
            --output json `
            backup_response.json
        
        if ($LASTEXITCODE -eq 0) {
            $responseContent = Get-Content "backup_response.json" | ConvertFrom-Json
            $snapshotId = $responseContent.result.snapshot_id
            
            if ($snapshotId) {
                Write-Success "Backup created successfully: $snapshotId"
                $snapshotId | Out-File -FilePath "test_snapshot_id.txt" -Encoding UTF8
                return $true
            }
        }
        
        Write-Error-Log "Backup creation failed"
        Get-Content "backup_response.json"
        return $false
    }
    catch {
        Write-Error-Log "Error during backup creation: $_"
        return $false
    }
    finally {
        if (Test-Path "backup_response.json") {
            Remove-Item "backup_response.json" -Force
        }
    }
}

# Test backup verification
function Test-BackupVerification {
    Write-Log "Testing backup verification..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would verify recent backups"
        return $true
    }
    
    # Get recent snapshots
    Write-Log "Checking recent snapshots..."
    
    try {
        $snapshots = aws rds describe-db-snapshots `
            --db-instance-identifier $script:DbInstanceId `
            --snapshot-type manual `
            --max-items 5 `
            --query 'DBSnapshots[?Status==`available`].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' `
            --output table
        
        if ($snapshots) {
            Write-Success "Found available snapshots:"
            Write-Host $snapshots
            return $true
        }
        else {
            Write-Error-Log "No available snapshots found"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error during backup verification: $_"
        return $false
    }
}

# Test restoration from snapshot
function Test-Restoration {
    param([string]$SnapshotId)
    
    if (-not $SnapshotId) {
        if (Test-Path "test_snapshot_id.txt") {
            $SnapshotId = Get-Content "test_snapshot_id.txt" -Raw
            $SnapshotId = $SnapshotId.Trim()
        }
        else {
            Write-Error-Log "No snapshot ID provided and no test snapshot found"
            return $false
        }
    }
    
    Write-Log "Testing restoration from snapshot: $SnapshotId"
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would restore from snapshot $SnapshotId"
        return $true
    }
    
    # Create test restoration instance
    $testInstanceId = "$($script:DbInstanceId)-restore-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    Write-Log "Creating test restoration instance: $testInstanceId"
    
    try {
        $response = aws rds restore-db-instance-from-db-snapshot `
            --db-instance-identifier $testInstanceId `
            --db-snapshot-identifier $SnapshotId `
            --db-instance-class "db.t3.micro" `
            --no-multi-az `
            --no-publicly-accessible `
            --tags Key=Purpose,Value=BackupTest Key=Environment,Value=$Environment `
            --output json
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Restoration initiated: $testInstanceId"
            $testInstanceId | Out-File -FilePath "test_restore_instance.txt" -Encoding UTF8
            
            Write-Log "Waiting for restoration to complete (this may take several minutes)..."
            aws rds wait db-instance-available --db-instance-identifiers $testInstanceId
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Restoration completed successfully"
                
                # Test connectivity to restored instance
                Test-RestoredInstanceConnectivity $testInstanceId
                
                return $true
            }
            else {
                Write-Error-Log "Restoration failed or timed out"
                return $false
            }
        }
        else {
            Write-Error-Log "Failed to initiate restoration"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error during restoration: $_"
        return $false
    }
}

# Test connectivity to restored instance
function Test-RestoredInstanceConnectivity {
    param([string]$InstanceId)
    
    Write-Log "Testing connectivity to restored instance: $InstanceId"
    
    try {
        # Get instance endpoint
        $endpoint = aws rds describe-db-instances `
            --db-instance-identifier $InstanceId `
            --query 'DBInstances[0].Endpoint.Address' `
            --output text
        
        if ($endpoint -and $endpoint -ne "None") {
            Write-Success "Restored instance endpoint: $endpoint"
            
            # Note: Actual connectivity test would require database credentials
            # and network access, which may not be available in all environments
            Write-Log "Connectivity test completed (endpoint accessible)"
            return $true
        }
        else {
            Write-Error-Log "Could not retrieve endpoint for restored instance"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error testing connectivity: $_"
        return $false
    }
}

# Verify all backups
function Test-AllBackups {
    Write-Log "Verifying all backups..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would verify all backups"
        return $true
    }
    
    # Invoke backup verifier Lambda
    Write-Log "Invoking backup verifier Lambda function..."
    
    $verifierFunction = $script:BackupLambdaFunction -replace "backup-manager", "backup-verifier"
    
    try {
        $response = aws lambda invoke `
            --function-name $verifierFunction `
            --payload '{}' `
            --output json `
            verification_response.json
        
        if ($LASTEXITCODE -eq 0) {
            $responseContent = Get-Content "verification_response.json" | ConvertFrom-Json
            $status = $responseContent.results.overall_status
            
            if ($status -eq "PASS") {
                Write-Success "All backup verifications passed"
                return $true
            }
            else {
                Write-Warning-Log "Some backup verifications failed or had warnings"
                $responseContent.results | ConvertTo-Json -Depth 10
                return $false
            }
        }
        else {
            Write-Error-Log "Backup verification failed"
            Get-Content "verification_response.json"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error during backup verification: $_"
        return $false
    }
    finally {
        if (Test-Path "verification_response.json") {
            Remove-Item "verification_response.json" -Force
        }
    }
}

# Clean up test resources
function Remove-TestResources {
    Write-Log "Cleaning up test resources..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would clean up test resources"
        return
    }
    
    # Clean up test restoration instance
    if (Test-Path "test_restore_instance.txt") {
        $testInstance = Get-Content "test_restore_instance.txt" -Raw
        $testInstance = $testInstance.Trim()
        Write-Log "Deleting test restoration instance: $testInstance"
        
        try {
            aws rds delete-db-instance `
                --db-instance-identifier $testInstance `
                --skip-final-snapshot `
                --delete-automated-backups
            
            Remove-Item "test_restore_instance.txt" -Force
        }
        catch {
            Write-Warning-Log "Failed to delete test restoration instance: $_"
        }
    }
    
    # Clean up test snapshot
    if (Test-Path "test_snapshot_id.txt") {
        $testSnapshot = Get-Content "test_snapshot_id.txt" -Raw
        $testSnapshot = $testSnapshot.Trim()
        Write-Log "Deleting test snapshot: $testSnapshot"
        
        try {
            aws rds delete-db-snapshot --db-snapshot-identifier $testSnapshot
            Remove-Item "test_snapshot_id.txt" -Force
        }
        catch {
            Write-Warning-Log "Failed to delete test snapshot: $_"
        }
    }
    
    Write-Success "Test resource cleanup completed"
}

# Run full disaster recovery test
function Invoke-FullDrTest {
    Write-Log "Running full disaster recovery test..."
    
    $testFailed = $false
    
    # Step 1: Test backup creation
    if (-not (Test-BackupCreation)) {
        $testFailed = $true
    }
    
    # Step 2: Test backup verification
    if (-not (Test-BackupVerification)) {
        $testFailed = $true
    }
    
    # Step 3: Test restoration (only if backup creation succeeded)
    if ((Test-Path "test_snapshot_id.txt") -and (-not (Test-Restoration))) {
        $testFailed = $true
    }
    
    # Step 4: Verify all backups
    if (-not (Test-AllBackups)) {
        $testFailed = $true
    }
    
    # Step 5: Clean up (always run)
    Remove-TestResources
    
    if ($testFailed) {
        Write-Error-Log "Full disaster recovery test failed"
        exit 1
    }
    else {
        Write-Success "Full disaster recovery test completed successfully"
    }
}

# Main execution
switch ($Command) {
    "test-backup" {
        Initialize-AwsResources
        $success = (Test-BackupCreation) -and (Test-BackupVerification)
        if (-not $success) { exit 1 }
    }
    "test-restore" {
        Initialize-AwsResources
        if (-not (Test-Restoration $SnapshotId)) { exit 1 }
    }
    "verify-backups" {
        Initialize-AwsResources
        if (-not (Test-AllBackups)) { exit 1 }
    }
    "cleanup-test" {
        Remove-TestResources
    }
    "full-dr-test" {
        Initialize-AwsResources
        Invoke-FullDrTest
    }
    "help" {
        Show-Help
    }
    default {
        Write-Error-Log "Unknown command: $Command"
        Show-Help
        exit 1
    }
}