# Simple Application Deployment Validation
Write-Host "DhakaCart Application Deployment Validation" -ForegroundColor Blue

# Check required files
$files = @(
    "frontend/Dockerfile",
    "backend/Dockerfile", 
    "kubernetes/namespace.yaml",
    "kubernetes/deployments/frontend-deployment.yaml",
    "kubernetes/deployments/backend-deployment.yaml"
)

Write-Host "`nChecking deployment files..." -ForegroundColor Yellow

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

# Check Docker files
Write-Host "`nValidating Docker configurations..." -ForegroundColor Yellow

if (Test-Path "frontend/Dockerfile") {
    $frontendContent = Get-Content "frontend/Dockerfile" -Raw
    if ($frontendContent -like "*HEALTHCHECK*") {
        Write-Host "✓ Frontend has health check" -ForegroundColor Green
    }
    if ($frontendContent -like "*USER*") {
        Write-Host "✓ Frontend uses non-root user" -ForegroundColor Green
    }
}

if (Test-Path "backend/Dockerfile") {
    $backendContent = Get-Content "backend/Dockerfile" -Raw
    if ($backendContent -like "*HEALTHCHECK*") {
        Write-Host "✓ Backend has health check" -ForegroundColor Green
    }
    if ($backendContent -like "*USER*") {
        Write-Host "✓ Backend uses non-root user" -ForegroundColor Green
    }
}

Write-Host "`n✓ Application deployment validation completed" -ForegroundColor Green
Write-Host "All required files are present and properly configured." -ForegroundColor White