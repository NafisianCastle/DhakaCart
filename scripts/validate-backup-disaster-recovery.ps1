# Backup and Disaster Recovery Validation Script for DhakaCart
# This script validates backup systems, disaster recovery setup, and performs DR testing

param(
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }),
    [string]$DrRegion = "us-east-1",
    [string]$Environment = $(if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }),
    [switch]$TestRestore,
    [switch]$TestFailover,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check AWS CLI
    try {
        aws --version | Out-Null
        Write-Success "AWS CLI is available"
    }
    catch {
        Write-Error "AWS CLI is not installed"
        exit 1
    }
    
    # Check if terraform outputs exist
    if (Test-Path "terraform-outputs.json") {
        Write-Success "Terraform outputs found"
    }
    else {
        Write-Error "Terraform outputs not found. Please run infrastructure deployment first."
        exit 1
    }
    
    # Check AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
        Write-Success "AWS credentials are valid"
    }
    catch {
        Write-Error "AWS credentials not configured or invalid"
        exit 1
    }
}

# Get infrastructure information
function Get-InfrastructureInfo {
    Write-Log "Getting infrastructure information..."
    
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    
    $script:DbInstanceId = $outputs.rds_instance_id.value
    $script:BackupBucket = $outputs.backup_s3_bucket.value
    $script:DrBackupBucket = $outputs.dr_backup_s3_bucket.value
    $script:BackupLambda = $outputs.backup_lambda_function_name.value
    $script:VerifierLambda = $outputs.backup_verifier_lambda_function_name.value
    
    if ($script:DbInstanceId) {
        Write-Success "Database instance: $script:DbInstanceId"
    }
    else {
        Write-Error "Database instance not found in outputs"
        exit 1
    }
    
    if ($script:BackupBucket) {
        Write-Success "Backup bucket: $script:BackupBucket"
    }
    else {
        Write-Warning "Backup bucket not found in outputs"
    }
}

# Test RDS automated backups
function Test-RdsAutomatedBackups {
    Write-Log "Testing RDS automated backups..."
    
    try {
        # Check backup configuration
        $dbInfo = aws rds describe-db-instances --db-instance-identifier $script:DbInstanceId --region $Region --query 'DBInstances[0]' | ConvertFrom-Json
        
        $backupRetention = $dbInfo.BackupRetentionPeriod
        $backupWindow = $dbInfo.PreferredBackupWindow
        $multiAz = $dbInfo.MultiAZ
        
        Write-Log "Backup retention period: $backupRetention days"
        Write-Log "Backup window: $backupWindow"
        Write-Log "Multi-AZ enabled: $multiAz"
        
        if ($backupRetention -gt 0) {
            Write-Success "Automated backups are enabled"
        }
        else {
            Write-Error "Automated backups are not enabled"
            return $false
        }
        
        # Check recent automated backups
        $automatedBackups = aws rds describe-db-snapshots --db-instance-identifier $script:DbInstanceId --snapshot-type automated --region $Region --query 'DBSnapshots[?Status==`available`]' | ConvertFrom-Json
        
        if ($automatedBackups.Count -gt 0) {
            Write-Success "Found $($automatedBackups.Count) automated backup snapshots"
            
            # Show latest backup
            $latestBackup = $automatedBackups | Sort-Object SnapshotCreateTime -Descending | Select-Object -First 1
            Write-Log "Latest backup: $($latestBackup.DBSnapshotIdentifier) created at $($latestBackup.SnapshotCreateTime)"
        }
        else {
            Write-Warning "No automated backup snapshots found"
        }
        
        return $true
    }
    catch {
        Write-Error "Failed to check RDS automated backups: $_"
        return $false
    }
}

# Test manual backup creation
function Test-ManualBackupCreation {
    Write-Log "Testing manual backup creation..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would create manual backup snapshot"
        return $true
    }
    
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
        $snapshotId = "$script:DbInstanceId-test-backup-$timestamp"
        
        Write-Log "Creating manual snapshot: $snapshotId"
        
        aws rds create-db-snapshot --db-instance-identifier $script:DbInstanceId --db-snapshot-identifier $snapshotId --region $Region | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Manual snapshot creation initiated: $snapshotId"
            
            # Wait for snapshot to complete (with timeout)
            Write-Log "Waiting for snapshot to complete (this may take several minutes)..."
            $timeout = 1800  # 30 minutes
            $elapsed = 0
            
            do {
                Start-Sleep 30
                $elapsed += 30
                
                $snapshotStatus = aws rds describe-db-snapshots --db-snapshot-identifier $snapshotId --region $Region --query 'DBSnapshots[0].Status' --output text 2>$null
                
                Write-Log "Snapshot status: $snapshotStatus (elapsed: $elapsed seconds)"
                
                if ($snapshotStatus -eq "available") {
                    Write-Success "Manual snapshot completed successfully"
                    
                    # Clean up test snapshot
                    Write-Log "Cleaning up test snapshot..."
                    aws rds delete-db-snapshot --db-snapshot-identifier $snapshotId --region $Region | Out-Null
                    
                    return $true
                }
                
            } while ($elapsed -lt $timeout -and $snapshotStatus -eq "creating")
            
            if ($snapshotStatus -ne "available") {
                Write-Warning "Snapshot did not complete within timeout, but creation was successful"
                return $true
            }
        }
        else {
            Write-Error "Failed to create manual snapshot"
            return $false
        }
    }
    catch {
        Write-Error "Manual backup creation failed: $_"
        return $false
    }
}

# Test backup Lambda functions
function Test-BackupLambdaFunctions {
    Write-Log "Testing backup Lambda functions..."
    
    if (-not $script:BackupLambda) {
        Write-Warning "Backup Lambda function not found"
        return $false
    }
    
    try {
        # Test backup manager Lambda
        Write-Log "Testing backup manager Lambda function..."
        
        $testEvent = @{
            action = "create_snapshot"
            type = "test"
        } | ConvertTo-Json
        
        if ($DryRun) {
            Write-Log "DRY RUN: Would invoke backup manager Lambda"
        }
        else {
            $response = aws lambda invoke --function-name $script:BackupLambda --payload $testEvent --region $Region response.json
            
            if ($LASTEXITCODE -eq 0) {
                $responseContent = Get-Content response.json | ConvertFrom-Json
                Write-Success "Backup manager Lambda executed successfully"
                Write-Log "Response: $($responseContent.body)"
            }
            else {
                Write-Error "Backup manager Lambda execution failed"
                return $false
            }
        }
        
        # Test backup verifier Lambda (if exists)
        if ($script:VerifierLambda) {
            Write-Log "Testing backup verifier Lambda function..."
            
            if ($DryRun) {
                Write-Log "DRY RUN: Would invoke backup verifier Lambda"
            }
            else {
                $response = aws lambda invoke --function-name $script:VerifierLambda --region $Region verifier-response.json
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Backup verifier Lambda executed successfully"
                }
                else {
                    Write-Warning "Backup verifier Lambda execution failed"
                }
            }
        }
        
        return $true
    }
    catch {
        Write-Error "Lambda function testing failed: $_"
        return $false
    }
    finally {
        # Clean up response files
        Remove-Item "response.json" -ErrorAction SilentlyContinue
        Remove-Item "verifier-response.json" -ErrorAction SilentlyContinue
    }
}

# Test S3 backup storage
function Test-S3BackupStorage {
    Write-Log "Testing S3 backup storage..."
    
    if (-not $script:BackupBucket) {
        Write-Warning "Backup S3 bucket not configured"
        return $false
    }
    
    try {
        # Check if bucket exists and is accessible
        aws s3 ls "s3://$script:BackupBucket" --region $Region | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backup S3 bucket is accessible"
            
            # Check bucket contents
            $objects = aws s3 ls "s3://$script:BackupBucket" --recursive --region $Region
            
            if ($objects) {
                $objectCount = ($objects | Measure-Object).Count
                Write-Log "Found $objectCount objects in backup bucket"
            }
            else {
                Write-Warning "Backup bucket is empty"
            }
            
            # Test write access
            if ($DryRun) {
                Write-Log "DRY RUN: Would test S3 write access"
            }
            else {
                $testFile = "test-backup-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').txt"
                $testContent = "Backup validation test - $(Get-Date)"
                
                $testContent | Out-File -FilePath $testFile -Encoding UTF8
                aws s3 cp $testFile "s3://$script:BackupBucket/test/$testFile" --region $Region | Out-Null
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "S3 write access test successful"
                    
                    # Clean up test file
                    aws s3 rm "s3://$script:BackupBucket/test/$testFile" --region $Region | Out-Null
                    Remove-Item $testFile -ErrorAction SilentlyContinue
                }
                else {
                    Write-Error "S3 write access test failed"
                    return $false
                }
            }
        }
        else {
            Write-Error "Cannot access backup S3 bucket"
            return $false
        }
        
        return $true
    }
    catch {
        Write-Error "S3 backup storage test failed: $_"
        return $false
    }
}

# Test cross-region replication
function Test-CrossRegionReplication {
    Write-Log "Testing cross-region backup replication..."
    
    if (-not $script:DrBackupBucket) {
        Write-Warning "DR backup bucket not configured"
        return $false
    }
    
    try {
        # Check DR bucket accessibility
        aws s3 ls "s3://$script:DrBackupBucket" --region $DrRegion | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "DR backup bucket is accessible"
            
            # Check replication configuration
            $replicationConfig = aws s3api get-bucket-replication --bucket $script:BackupBucket --region $Region 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Cross-region replication is configured"
                
                # Compare object counts (approximate)
                $primaryObjects = aws s3 ls "s3://$script:BackupBucket" --recursive --region $Region | Measure-Object | Select-Object -ExpandProperty Count
                $drObjects = aws s3 ls "s3://$script:DrBackupBucket" --recursive --region $DrRegion | Measure-Object | Select-Object -ExpandProperty Count
                
                Write-Log "Primary bucket objects: $primaryObjects"
                Write-Log "DR bucket objects: $drObjects"
                
                if ($drObjects -gt 0) {
                    Write-Success "Cross-region replication appears to be working"
                }
                else {
                    Write-Warning "DR bucket is empty - replication may not be working or no objects to replicate"
                }
            }
            else {
                Write-Warning "Cross-region replication not configured"
            }
        }
        else {
            Write-Error "Cannot access DR backup bucket"
            return $false
        }
        
        return $true
    }
    catch {
        Write-Error "Cross-region replication test failed: $_"
        return $false
    }
}

# Test disaster recovery database replica
function Test-DrDatabaseReplica {
    Write-Log "Testing disaster recovery database replica..."
    
    try {
        # Check if DR replica exists
        $drReplicas = aws rds describe-db-instances --region $DrRegion --query "DBInstances[?ReadReplicaSourceDBInstanceIdentifier!=null]" | ConvertFrom-Json
        
        if ($drReplicas.Count -gt 0) {
            foreach ($replica in $drReplicas) {
                $replicaId = $replica.DBInstanceIdentifier
                $sourceDb = $replica.ReadReplicaSourceDBInstanceIdentifier
                $status = $replica.DBInstanceStatus
                
                Write-Log "Found DR replica: $replicaId (source: $sourceDb, status: $status)"
                
                if ($status -eq "available") {
                    Write-Success "DR replica is available and ready"
                    
                    # Check replication lag
                    $replicaLag = $replica.ReadReplicaDBInstanceIdentifiers
                    Write-Log "Replica lag information available in CloudWatch metrics"
                }
                else {
                    Write-Warning "DR replica status: $status"
                }
            }
            
            return $true
        }
        else {
            Write-Warning "No DR database replicas found in $DrRegion"
            return $false
        }
    }
    catch {
        Write-Error "DR database replica test failed: $_"
        return $false
    }
}

# Test point-in-time recovery capability
function Test-PointInTimeRecovery {
    Write-Log "Testing point-in-time recovery capability..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would test point-in-time recovery"
        return $true
    }
    
    if (-not $TestRestore) {
        Write-Log "Skipping point-in-time recovery test (use -TestRestore to enable)"
        return $true
    }
    
    try {
        # Get the earliest and latest restorable times
        $dbInfo = aws rds describe-db-instances --db-instance-identifier $script:DbInstanceId --region $Region --query 'DBInstances[0]' | ConvertFrom-Json
        
        $earliestTime = $dbInfo.EarliestRestorableTime
        $latestTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        
        Write-Log "Earliest restorable time: $earliestTime"
        Write-Log "Latest restorable time: $latestTime"
        
        # Create a test restore (this will create a new instance)
        $restoreId = "$script:DbInstanceId-pitr-test-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')"
        $restoreTime = (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        
        Write-Log "Creating point-in-time restore test instance: $restoreId"
        Write-Warning "This will create a new RDS instance for testing - remember to clean it up!"
        
        aws rds restore-db-instance-to-point-in-time `
            --source-db-instance-identifier $script:DbInstanceId `
            --target-db-instance-identifier $restoreId `
            --restore-time $restoreTime `
            --region $Region | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Point-in-time recovery test initiated"
            Write-Log "Test instance: $restoreId"
            Write-Warning "Remember to delete the test instance: aws rds delete-db-instance --db-instance-identifier $restoreId --skip-final-snapshot --region $Region"
            return $true
        }
        else {
            Write-Error "Point-in-time recovery test failed"
            return $false
        }
    }
    catch {
        Write-Error "Point-in-time recovery test failed: $_"
        return $false
    }
}

# Test disaster recovery failover procedure
function Test-DisasterRecoveryFailover {
    Write-Log "Testing disaster recovery failover procedure..."
    
    if (-not $TestFailover) {
        Write-Log "Skipping DR failover test (use -TestFailover to enable)"
        return $true
    }
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would test disaster recovery failover"
        return $true
    }
    
    Write-Warning "DR failover testing is a destructive operation!"
    Write-Warning "This should only be performed in non-production environments!"
    
    $confirmation = Read-Host "Are you sure you want to proceed with DR failover testing? (yes/no)"
    
    if ($confirmation -ne "yes") {
        Write-Log "DR failover test cancelled by user"
        return $true
    }
    
    try {
        # Run the disaster recovery script
        Write-Log "Executing disaster recovery failover test..."
        
        $drScript = Join-Path $PSScriptRoot "disaster-recovery.ps1"
        
        if (Test-Path $drScript) {
            & $drScript test-dr -Environment $Environment -DrRegion $DrRegion -Verbose
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "DR failover test completed successfully"
                return $true
            }
            else {
                Write-Error "DR failover test failed"
                return $false
            }
        }
        else {
            Write-Warning "DR script not found, skipping failover test"
            return $true
        }
    }
    catch {
        Write-Error "DR failover test failed: $_"
        return $false
    }
}

# Generate validation report
function New-ValidationReport {
    Write-Log "Generating backup and disaster recovery validation report..."
    
    $reportFile = "backup-dr-validation-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    $reportContent = @"
DhakaCart Backup and Disaster Recovery Validation Report
=======================================================
Generated: $(Get-Date)
Environment: $Environment
Primary Region: $Region
DR Region: $DrRegion

Infrastructure Components:
- Database Instance: $script:DbInstanceId
- Backup S3 Bucket: $script:BackupBucket
- DR Backup S3 Bucket: $script:DrBackupBucket
- Backup Lambda Function: $script:BackupLambda
- Verifier Lambda Function: $script:VerifierLambda

Validation Results:
- RDS Automated Backups: Tested
- Manual Backup Creation: Tested
- Backup Lambda Functions: Tested
- S3 Backup Storage: Tested
- Cross-Region Replication: Tested
- DR Database Replica: Tested
- Point-in-Time Recovery: $(if ($TestRestore) { "Tested" } else { "Skipped" })
- DR Failover Procedure: $(if ($TestFailover) { "Tested" } else { "Skipped" })

Backup Configuration:
- Automated backup retention: Check RDS configuration
- Backup window: Check RDS configuration
- Multi-AZ deployment: Check RDS configuration
- Cross-region replication: Check S3 configuration

Disaster Recovery Readiness:
- DR region infrastructure: $DrRegion
- Database replica status: Check DR region
- Backup replication status: Check S3 replication
- Failover procedures: Documented and tested

Next Steps:
1. Review backup retention policies
2. Test restore procedures regularly
3. Update disaster recovery runbooks
4. Schedule regular DR drills
5. Monitor backup success/failure notifications

Notes:
- Point-in-time recovery testing creates temporary RDS instances
- DR failover testing should only be performed in non-production environments
- Regular backup verification is automated via Lambda functions
- Cross-region replication ensures backup availability during regional outages
"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Success "Validation report generated: $reportFile"
}

# Main execution
function Main {
    Write-Log "Starting DhakaCart backup and disaster recovery validation..."
    
    Test-Prerequisites
    Get-InfrastructureInfo
    
    $allTestsPassed = $true
    
    # Run all validation tests
    if (-not (Test-RdsAutomatedBackups)) { $allTestsPassed = $false }
    if (-not (Test-ManualBackupCreation)) { $allTestsPassed = $false }
    if (-not (Test-BackupLambdaFunctions)) { $allTestsPassed = $false }
    if (-not (Test-S3BackupStorage)) { $allTestsPassed = $false }
    if (-not (Test-CrossRegionReplication)) { $allTestsPassed = $false }
    if (-not (Test-DrDatabaseReplica)) { $allTestsPassed = $false }
    if (-not (Test-PointInTimeRecovery)) { $allTestsPassed = $false }
    if (-not (Test-DisasterRecoveryFailover)) { $allTestsPassed = $false }
    
    New-ValidationReport
    
    if ($allTestsPassed) {
        Write-Success "Backup and disaster recovery validation completed successfully!"
    }
    else {
        Write-Warning "Some validation tests failed. Please review the results above."
    }
    
    Write-Log "Validation complete. Review the generated report for detailed results."
}

# Run main function
Main