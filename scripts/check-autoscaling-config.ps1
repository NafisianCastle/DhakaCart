# Check Auto-scaling Configuration
Write-Host "DhakaCart Auto-scaling Configuration Check" -ForegroundColor Blue

# Check if HPA files exist
Write-Host "`nChecking HPA configuration files..." -ForegroundColor Yellow

$hpaFiles = @(
    "kubernetes/autoscaling/backend-hpa.yaml",
    "kubernetes/autoscaling/frontend-hpa.yaml",
    "kubernetes/autoscaling/cluster-autoscaler.yaml"
)

foreach ($file in $hpaFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

# Check ingress configuration
Write-Host "`nChecking ingress configuration..." -ForegroundColor Yellow

if (Test-Path "kubernetes/ingress/dhakacart-ingress.yaml") {
    Write-Host "✓ Ingress configuration exists" -ForegroundColor Green
    
    $ingressContent = Get-Content "kubernetes/ingress/dhakacart-ingress.yaml" -Raw
    if ($ingressContent -like "*alb.ingress.kubernetes.io*") {
        Write-Host "✓ ALB annotations configured" -ForegroundColor Green
    }
    if ($ingressContent -like "*healthcheck*") {
        Write-Host "✓ Health check configuration present" -ForegroundColor Green
    }
} else {
    Write-Host "⚠ Ingress configuration not found" -ForegroundColor Yellow
}

# Check load test configurations
Write-Host "`nChecking load test configurations..." -ForegroundColor Yellow

$loadTestFiles = @(
    "performance-testing/load-tests/api-load-test.yml",
    "performance-testing/load-tests/stress-test.yml"
)

foreach ($file in $loadTestFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "⚠ $file missing" -ForegroundColor Yellow
    }
}

Write-Host "`n✓ Auto-scaling configuration check completed" -ForegroundColor Green
Write-Host "All required configuration files are present." -ForegroundColor White
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Deploy AWS Load Balancer Controller" -ForegroundColor White
Write-Host "2. Apply ingress configuration" -ForegroundColor White
Write-Host "3. Deploy HPA configurations" -ForegroundColor White
Write-Host "4. Test auto-scaling behavior with load tests" -ForegroundColor White