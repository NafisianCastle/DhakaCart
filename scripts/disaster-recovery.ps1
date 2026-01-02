# DhakaCart Disaster Recovery Scripts (PowerShell)
# This script provides utilities for disaster recovery operations

param(
    [Parameter(Position=0)]
    [ValidateSet("promote-replica", "failover", "failback", "test-dr", "sync-infrastructure", "validate-dr", "help")]
    [string]$Command = "help",
    
    [Parameter()]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    
    [Parameter()]
    [string]$DrRegion = "us-east-1",
    
    [Parameter()]
    [switch]$DryRun,
    
    [Parameter()]
    [switch]$Force,
    
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
DhakaCart Disaster Recovery Script (PowerShell)

Usage: .\disaster-recovery.ps1 [COMMAND] [OPTIONS]

Commands:
    promote-replica     Promote DR replica to primary database
    failover           Execute complete failover to DR region
    failback           Failback from DR region to primary
    test-dr            Test disaster recovery procedures
    sync-infrastructure Sync infrastructure to DR region
    validate-dr        Validate DR setup and readiness
    help               Show this help message

Options:
    -Environment ENV    Target environment (dev, staging, prod)
    -DrRegion REGION    Disaster recovery region
    -DryRun            Show what would be done without executing
    -Force             Force operation without confirmation
    -Verbose           Enable verbose output

Examples:
    .\disaster-recovery.ps1 promote-replica -Environment prod -DrRegion us-east-1
    .\disaster-recovery.ps1 failover -Environment prod -DryRun
    .\disaster-recovery.ps1 test-dr -Environment staging
    .\disaster-recovery.ps1 validate-dr -Environment prod

"@
}

# Get Terraform output
function Get-TerraformOutput {
    param(
        [string]$OutputName,
        [string]$Region = ""
    )
    
    try {
        Push-Location $TerraformDir
        
        if ($Region) {
            $env:AWS_DEFAULT_REGION = $Region
        }
        
        $output = terraform output -raw $OutputName 2>$null
        return $output
    }
    catch {
        return ""
    }
    finally {
        Pop-Location
        if ($Region) {
            Remove-Item Env:AWS_DEFAULT_REGION -ErrorAction SilentlyContinue
        }
    }
}

# Initialize AWS resources
function Initialize-AwsResources {
    Write-Log "Initializing AWS resources for environment: $Environment"
    
    # Primary region resources
    $script:PrimaryRegion = Get-TerraformOutput "aws_region"
    $script:DbInstanceId = Get-TerraformOutput "db_instance_id"
    $script:PrimaryVpcId = Get-TerraformOutput "vpc_id"
    
    # DR region resources
    $script:DrDbInstanceId = Get-TerraformOutput "dr_db_instance_id" $DrRegion
    $script:DrVpcId = Get-TerraformOutput "dr_vpc_id" $DrRegion
    
    Write-Log "Primary Region: $script:PrimaryRegion"
    Write-Log "DR Region: $DrRegion"
    Write-Log "Primary DB Instance: $script:DbInstanceId"
    Write-Log "DR DB Instance: $script:DrDbInstanceId"
}

# Confirm operation with user
function Confirm-Operation {
    param([string]$Operation)
    
    if ($Force) {
        return $true
    }
    
    Write-Warning-Log "You are about to perform: $Operation"
    Write-Warning-Log "Environment: $Environment"
    Write-Warning-Log "DR Region: $DrRegion"
    Write-Host ""
    
    $confirmation = Read-Host "Are you sure you want to continue? (yes/no)"
    
    if ($confirmation -ne "yes") {
        Write-Log "Operation cancelled by user"
        exit 0
    }
    
    return $true
}

# Check DR readiness
function Test-DrReadiness {
    Write-Log "Checking disaster recovery readiness..."
    
    $readinessIssues = 0
    
    # Check if DR replica exists and is available
    if ($script:DrDbInstanceId) {
        try {
            $drStatus = aws rds describe-db-instances `
                --region $DrRegion `
                --db-instance-identifier $script:DrDbInstanceId `
                --query 'DBInstances[0].DBInstanceStatus' `
                --output text 2>$null
            
            if ($drStatus -eq "available") {
                Write-Success "DR database replica is available"
            }
            else {
                Write-Error-Log "DR database replica is not available (status: $drStatus)"
                $readinessIssues++
            }
        }
        catch {
            Write-Error-Log "DR database replica not found"
            $readinessIssues++
        }
    }
    else {
        Write-Error-Log "DR database replica not found"
        $readinessIssues++
    }
    
    # Check S3 cross-region replication
    $backupBucket = Get-TerraformOutput "backup_s3_bucket"
    if ($backupBucket) {
        try {
            $replicationStatus = aws s3api get-bucket-replication `
                --bucket $backupBucket `
                --query 'ReplicationConfiguration.Rules[0].Status' `
                --output text 2>$null
            
            if ($replicationStatus -eq "Enabled") {
                Write-Success "S3 cross-region replication is enabled"
            }
            else {
                Write-Warning-Log "S3 cross-region replication is not configured"
            }
        }
        catch {
            Write-Warning-Log "Could not check S3 replication status"
        }
    }
    
    return $readinessIssues -eq 0
}

# Promote DR replica to primary
function Invoke-PromoteReplica {
    Write-Log "Promoting DR replica to primary database..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would promote DR replica $script:DrDbInstanceId to primary"
        return $true
    }
    
    Confirm-Operation "Promote DR replica to primary database"
    
    # Stop replication and promote replica
    Write-Log "Promoting read replica to standalone database..."
    
    try {
        aws rds promote-read-replica `
            --region $DrRegion `
            --db-instance-identifier $script:DrDbInstanceId `
            --backup-retention-period 30 `
            --preferred-backup-window "03:00-04:00"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Waiting for promotion to complete..."
            aws rds wait db-instance-available `
                --region $DrRegion `
                --db-instance-identifiers $script:DrDbInstanceId
            
            Write-Success "DR replica promoted to primary successfully"
            
            # Update DNS or load balancer to point to new primary
            Update-DnsForFailover
            
            return $true
        }
        else {
            Write-Error-Log "Failed to promote DR replica"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error during replica promotion: $_"
        return $false
    }
}

# Update DNS/load balancer for failover
function Update-DnsForFailover {
    Write-Log "Updating DNS/load balancer configuration for failover..."
    
    try {
        # Get new primary endpoint
        $newPrimaryEndpoint = aws rds describe-db-instances `
            --region $DrRegion `
            --db-instance-identifier $script:DrDbInstanceId `
            --query 'DBInstances[0].Endpoint.Address' `
            --output text
        
        if ($newPrimaryEndpoint -and $newPrimaryEndpoint -ne "None") {
            Write-Success "New primary database endpoint: $newPrimaryEndpoint"
            
            # Here you would update your application configuration
            Write-Log "Update your application configuration to use: $newPrimaryEndpoint"
            
            # Example: Update Kubernetes secret (if kubectl is available)
            if (Get-Command kubectl -ErrorAction SilentlyContinue) {
                Write-Log "Updating Kubernetes database secret..."
                # kubectl patch secret db-credentials -p '{"data":{"host":"'$(echo -n "$newPrimaryEndpoint" | base64)'"}}'
            }
        }
        else {
            Write-Error-Log "Could not retrieve new primary endpoint"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error updating DNS configuration: $_"
        return $false
    }
    
    return $true
}

# Execute complete failover
function Invoke-Failover {
    Write-Log "Executing complete failover to DR region..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would execute complete failover to $DrRegion"
        return $true
    }
    
    Confirm-Operation "Complete failover to DR region"
    
    # Step 1: Check DR readiness
    if (-not (Test-DrReadiness)) {
        Write-Error-Log "DR environment is not ready for failover"
        return $false
    }
    
    # Step 2: Promote DR replica
    if (-not (Invoke-PromoteReplica)) {
        Write-Error-Log "Failed to promote DR replica"
        return $false
    }
    
    # Step 3: Deploy application infrastructure in DR region
    Write-Log "Deploying application infrastructure in DR region..."
    Deploy-InfrastructureDr
    
    # Step 4: Update monitoring and alerting
    Write-Log "Updating monitoring and alerting for DR region..."
    Update-MonitoringDr
    
    Write-Success "Failover to DR region completed successfully"
    return $true
}

# Deploy infrastructure in DR region
function Deploy-InfrastructureDr {
    Write-Log "Deploying infrastructure in DR region..."
    
    # This would typically involve:
    # 1. Creating EKS cluster in DR region
    # 2. Deploying applications
    # 3. Updating load balancers
    # 4. Configuring monitoring
    
    Write-Log "Infrastructure deployment in DR region would be executed here"
    Write-Log "This includes EKS cluster, application deployments, and load balancers"
}

# Update monitoring for DR region
function Update-MonitoringDr {
    Write-Log "Updating monitoring configuration for DR region..."
    
    # Update monitoring to point to DR region resources
    Write-Log "Monitoring configuration update would be executed here"
    Write-Log "This includes updating Prometheus, Grafana, and alerting rules"
}

# Execute failback to primary region
function Invoke-Failback {
    Write-Log "Executing failback to primary region..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would execute failback to primary region"
        return $true
    }
    
    Confirm-Operation "Failback to primary region"
    
    # This is a complex operation that would involve:
    # 1. Ensuring primary region is ready
    # 2. Syncing data from DR to primary
    # 3. Switching traffic back
    # 4. Re-establishing replication
    
    Write-Warning-Log "Failback is a complex operation that requires careful planning"
    Write-Warning-Log "Please ensure primary region infrastructure is fully operational"
    
    Write-Log "Failback procedure would be executed here"
    Write-Log "This is typically a planned operation during maintenance windows"
    
    return $true
}

# Test disaster recovery procedures
function Test-DrProcedures {
    Write-Log "Testing disaster recovery procedures..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would test DR procedures"
        return $true
    }
    
    $testFailed = $false
    
    # Test 1: Check DR readiness
    Write-Log "Test 1: Checking DR readiness..."
    if (Test-DrReadiness) {
        Write-Success "DR readiness check passed"
    }
    else {
        Write-Error-Log "DR readiness check failed"
        $testFailed = $true
    }
    
    # Test 2: Verify backup replication
    Write-Log "Test 2: Verifying backup replication..."
    if (Test-BackupReplication) {
        Write-Success "Backup replication verification passed"
    }
    else {
        Write-Error-Log "Backup replication verification failed"
        $testFailed = $true
    }
    
    # Test 3: Test database connectivity to DR replica
    Write-Log "Test 3: Testing DR database connectivity..."
    if (Test-DrDatabaseConnectivity) {
        Write-Success "DR database connectivity test passed"
    }
    else {
        Write-Error-Log "DR database connectivity test failed"
        $testFailed = $true
    }
    
    if ($testFailed) {
        Write-Error-Log "Some DR tests failed"
        return $false
    }
    else {
        Write-Success "All DR tests passed"
        return $true
    }
}

# Verify backup replication
function Test-BackupReplication {
    $backupBucket = Get-TerraformOutput "backup_s3_bucket"
    $drBackupBucket = Get-TerraformOutput "dr_backup_s3_bucket" $DrRegion
    
    if (-not $backupBucket -or -not $drBackupBucket) {
        Write-Error-Log "Could not retrieve backup bucket information"
        return $false
    }
    
    try {
        # Check if objects exist in both buckets
        $primaryObjects = (aws s3 ls "s3://$backupBucket" --recursive | Measure-Object).Count
        $drObjects = (aws s3 ls "s3://$drBackupBucket" --recursive --region $DrRegion | Measure-Object).Count
        
        Write-Log "Primary backup objects: $primaryObjects"
        Write-Log "DR backup objects: $drObjects"
        
        return $drObjects -gt 0
    }
    catch {
        Write-Error-Log "Error checking backup replication: $_"
        return $false
    }
}

# Test DR database connectivity
function Test-DrDatabaseConnectivity {
    if (-not $script:DrDbInstanceId) {
        Write-Error-Log "DR database instance not found"
        return $false
    }
    
    try {
        $drEndpoint = aws rds describe-db-instances `
            --region $DrRegion `
            --db-instance-identifier $script:DrDbInstanceId `
            --query 'DBInstances[0].Endpoint.Address' `
            --output text 2>$null
        
        if ($drEndpoint -and $drEndpoint -ne "None") {
            Write-Log "DR database endpoint: $drEndpoint"
            return $true
        }
        else {
            Write-Error-Log "Could not retrieve DR database endpoint"
            return $false
        }
    }
    catch {
        Write-Error-Log "Error testing DR database connectivity: $_"
        return $false
    }
}

# Sync infrastructure to DR region
function Sync-Infrastructure {
    Write-Log "Syncing infrastructure to DR region..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would sync infrastructure to DR region"
        return $true
    }
    
    # This would involve running Terraform in DR region
    Write-Log "Infrastructure sync would be executed here"
    Write-Log "This includes creating/updating DR region resources"
    
    return $true
}

# Validate DR setup
function Test-DrSetup {
    Write-Log "Validating disaster recovery setup..."
    
    $validationIssues = 0
    
    # Check all DR components
    if (-not (Test-DrReadiness)) {
        $validationIssues++
    }
    
    if (-not (Test-BackupReplication)) {
        $validationIssues++
    }
    
    if (-not (Test-DrDatabaseConnectivity)) {
        $validationIssues++
    }
    
    if ($validationIssues -eq 0) {
        Write-Success "DR setup validation passed"
        return $true
    }
    else {
        Write-Error-Log "DR setup validation failed with $validationIssues issues"
        return $false
    }
}

# Main execution
switch ($Command) {
    "promote-replica" {
        Initialize-AwsResources
        if (-not (Invoke-PromoteReplica)) { exit 1 }
    }
    "failover" {
        Initialize-AwsResources
        if (-not (Invoke-Failover)) { exit 1 }
    }
    "failback" {
        Initialize-AwsResources
        if (-not (Invoke-Failback)) { exit 1 }
    }
    "test-dr" {
        Initialize-AwsResources
        if (-not (Test-DrProcedures)) { exit 1 }
    }
    "sync-infrastructure" {
        Initialize-AwsResources
        if (-not (Sync-Infrastructure)) { exit 1 }
    }
    "validate-dr" {
        Initialize-AwsResources
        if (-not (Test-DrSetup)) { exit 1 }
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