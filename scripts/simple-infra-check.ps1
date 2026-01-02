# Simple Infrastructure Status Check
Write-Host "Checking DhakaCart infrastructure status..." -ForegroundColor Blue

# Check if terraform outputs exist
if (Test-Path "terraform-outputs.json") {
    Write-Host "✓ Terraform outputs found" -ForegroundColor Green
    
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    
    # Check EKS cluster
    $clusterName = $outputs.eks_cluster_id.value
    if ($clusterName -and $clusterName -ne "null") {
        Write-Host "✓ EKS cluster found: $clusterName" -ForegroundColor Green
    } else {
        Write-Host "✗ EKS cluster not found" -ForegroundColor Red
    }
    
    # Check RDS instance
    $rdsInstanceId = $outputs.rds_instance_id.value
    if ($rdsInstanceId -and $rdsInstanceId -ne "null") {
        Write-Host "✓ RDS instance found: $rdsInstanceId" -ForegroundColor Green
    } else {
        Write-Host "✗ RDS instance not found" -ForegroundColor Red
    }
    
    # Check Redis cluster
    $redisGroupId = $outputs.redis_replication_group_id.value
    if ($redisGroupId -and $redisGroupId -ne "null") {
        Write-Host "✓ Redis cluster found: $redisGroupId" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis cluster not found" -ForegroundColor Red
    }
    
} elseif (Test-Path "terraform/terraform.tfstate") {
    Write-Host "⚠ Terraform state found but no outputs. Generating outputs..." -ForegroundColor Yellow
    Push-Location "terraform"
    terraform output -json | Out-File -FilePath "../terraform-outputs.json" -Encoding UTF8
    Pop-Location
    Write-Host "✓ Terraform outputs generated" -ForegroundColor Green
} else {
    Write-Host "✗ No Terraform state or outputs found. Infrastructure not deployed." -ForegroundColor Red
    Write-Host "Please run terraform apply first." -ForegroundColor Yellow
}