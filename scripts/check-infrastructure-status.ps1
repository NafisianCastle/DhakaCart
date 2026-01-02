# Infrastructure Status Check Script for DhakaCart
# This script checks the status of existing infrastructure without deploying

param(
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }),
    [string]$Environment = $(if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }),
    [string]$ProjectName = $(if ($env:PROJECT_NAME) { $env:PROJECT_NAME } else { "dhakacart" })
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

# Check if Terraform outputs exist
function Test-TerraformOutputs {
    if (Test-Path "terraform-outputs.json") {
        Write-Success "Terraform outputs file found"
        return $true
    }
    
    # Try to generate outputs from Terraform state
    if (Test-Path "terraform/terraform.tfstate") {
        Write-Log "Generating Terraform outputs from state..."
        Push-Location "terraform"
        try {
            terraform output -json | Out-File -FilePath "../terraform-outputs.json" -Encoding UTF8
            Write-Success "Terraform outputs generated from state"
            return $true
        }
        catch {
            Write-Error "Failed to generate Terraform outputs: $_"
            return $false
        }
        finally {
            Pop-Location
        }
    }
    
    Write-Error "No Terraform outputs found. Please run terraform apply first."
    return $false
}

# Quick infrastructure status check
function Test-InfrastructureStatus {
    Write-Log "Checking infrastructure status..."
    
    if (-not (Test-TerraformOutputs)) {
        return $false
    }
    
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $allHealthy = $true
    
    # Check EKS cluster
    $clusterName = $outputs.eks_cluster_id.value
    if ($clusterName -and $clusterName -ne "null") {
        try {
            $clusterStatus = aws eks describe-cluster --name $clusterName --region $Region --query 'cluster.status' --output text
            if ($clusterStatus -eq "ACTIVE") {
                Write-Success "EKS cluster $clusterName is ACTIVE"
            }
            else {
                Write-Error "EKS cluster $clusterName status: $clusterStatus"
                $allHealthy = $false
            }
        }
        catch {
            Write-Error "Failed to check EKS cluster status"
            $allHealthy = $false
        }
    }
    else {
        Write-Warning "EKS cluster not found in outputs"
        $allHealthy = $false
    }
    
    # Check RDS instance
    $rdsInstanceId = $outputs.rds_instance_id.value
    if ($rdsInstanceId -and $rdsInstanceId -ne "null") {
        try {
            $rdsStatus = aws rds describe-db-instances --db-instance-identifier $rdsInstanceId --region $Region --query 'DBInstances[0].DBInstanceStatus' --output text
            if ($rdsStatus -eq "available") {
                Write-Success "RDS instance $rdsInstanceId is available"
            }
            else {
                Write-Error "RDS instance $rdsInstanceId status: $rdsStatus"
                $allHealthy = $false
            }
        }
        catch {
            Write-Error "Failed to check RDS instance status"
            $allHealthy = $false
        }
    }
    else {
        Write-Warning "RDS instance not found in outputs"
        $allHealthy = $false
    }
    
    # Check Redis cluster
    $redisGroupId = $outputs.redis_replication_group_id.value
    if ($redisGroupId -and $redisGroupId -ne "null") {
        try {
            $redisStatus = aws elasticache describe-replication-groups --replication-group-id $redisGroupId --region $Region --query 'ReplicationGroups[0].Status' --output text
            if ($redisStatus -eq "available") {
                Write-Success "Redis cluster $redisGroupId is available"
            }
            else {
                Write-Error "Redis cluster $redisGroupId status: $redisStatus"
                $allHealthy = $false
            }
        }
        catch {
            Write-Error "Failed to check Redis cluster status"
            $allHealthy = $false
        }
    }
    else {
        Write-Warning "Redis cluster not found in outputs"
        $allHealthy = $false
    }
    
    return $allHealthy
}

# Main execution
Write-Log "Checking DhakaCart infrastructure status..."

if (Test-InfrastructureStatus) {
    Write-Success "All infrastructure components are healthy and ready!"
    Write-Log "Infrastructure is ready for application deployment (Task 11.2)"
}
else {
    Write-Error "Infrastructure is not ready. Please check the issues above."
    Write-Log "You may need to run the full infrastructure deployment script first."
    exit 1
}