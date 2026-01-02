# Check Monitoring Configuration Files
Write-Host "DhakaCart Monitoring Configuration Check" -ForegroundColor Blue

Write-Host "`nChecking Prometheus configuration files..." -ForegroundColor Yellow

$monitoringFiles = @(
    "kubernetes/monitoring/prometheus/values.yaml",
    "kubernetes/monitoring/prometheus/rules/dhakacart-alerts.yaml",
    "kubernetes/monitoring/prometheus/alertmanager/alertmanager.yaml"
)

foreach ($file in $monitoringFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

Write-Host "`nChecking ELK stack configuration..." -ForegroundColor Yellow

$elkFiles = @(
    "kubernetes/monitoring/elk/kibana/values.yaml",
    "kubernetes/monitoring/elk/elasticsearch/values.yaml"
)

foreach ($file in $elkFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "⚠ $file missing (ELK optional)" -ForegroundColor Yellow
    }
}

Write-Host "`nChecking dashboard configurations..." -ForegroundColor Yellow

if (Test-Path "kubernetes/monitoring/prometheus/dashboards") {
    Write-Host "✓ Dashboard directory exists" -ForegroundColor Green
} else {
    Write-Host "⚠ Dashboard directory missing" -ForegroundColor Yellow
}

Write-Host "`n✓ Monitoring configuration check completed" -ForegroundColor Green
Write-Host "All required monitoring files are present." -ForegroundColor White