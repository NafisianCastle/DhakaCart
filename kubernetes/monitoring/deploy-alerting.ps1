# Deploy Alerting and Notification System for DhakaCart
# This script configures AlertManager with notification channels

param(
    [switch]$DryRun = $false
)

Write-Host "🚨 Deploying Alerting and Notification System for DhakaCart..." -ForegroundColor Green

# Check if kubectl is configured
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Host "❌ kubectl is not configured or cluster is not accessible." -ForegroundColor Red
    exit 1
}

# Check if monitoring namespace exists
try {
    kubectl get namespace monitoring | Out-Null
} catch {
    Write-Host "❌ Monitoring namespace not found. Please deploy Prometheus stack first." -ForegroundColor Red
    exit 1
}

if ($DryRun) {
    Write-Host "🔍 Running in dry-run mode..." -ForegroundColor Yellow
}

# Create alertmanager configuration secret
Write-Host "📧 Creating AlertManager configuration..." -ForegroundColor Cyan
$secretArgs = @(
    "create", "secret", "generic", "alertmanager-config",
    "--from-file=alertmanager.yml=alertmanager/alertmanager.yaml",
    "--from-file=email.tmpl=alertmanager/templates/email.tmpl",
    "--namespace", "monitoring",
    "--dry-run=client", "-o", "yaml"
)

if ($DryRun) {
    & kubectl $secretArgs
} else {
    & kubectl $secretArgs | kubectl apply -f -
}

# Update Prometheus stack with AlertManager configuration
Write-Host "⚙️  Updating Prometheus stack with AlertManager configuration..." -ForegroundColor Cyan
if (-not $DryRun) {
    helm upgrade prometheus-stack prometheus-community/kube-prometheus-stack `
        --namespace monitoring `
        --reuse-values `
        --set alertmanager.config.global.smtp_smarthost="smtp.gmail.com:587" `
        --set alertmanager.config.global.smtp_from="alerts@dhakacart.com" `
        --set alertmanager.configFileName="alertmanager.yml" `
        --wait
}

# Apply PrometheusRules for DhakaCart
Write-Host "📊 Applying DhakaCart alerting rules..." -ForegroundColor Cyan
if ($DryRun) {
    kubectl apply -f prometheus/rules/dhakacart-alerts.yaml -n dhakacart --dry-run=client
} else {
    kubectl apply -f prometheus/rules/dhakacart-alerts.yaml -n dhakacart
}

if (-not $DryRun) {
    # Wait for AlertManager to be ready
    Write-Host "⏳ Waiting for AlertManager to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=alertmanager --namespace monitoring --timeout=300s

    # Create runbooks configmap
    Write-Host "📚 Creating runbooks configmap..." -ForegroundColor Cyan
    kubectl create configmap dhakacart-runbooks `
        --from-file=runbooks/ `
        --namespace dhakacart `
        --dry-run=client -o yaml | kubectl apply -f -

    # Create notification test script
    Write-Host "🧪 Creating notification test script..." -ForegroundColor Cyan
    $testScript = @'
# Test AlertManager notifications
$ALERTMANAGER_URL = "http://localhost:9093"

Write-Host "Testing AlertManager notifications..."

# Test critical alert
$criticalAlert = @{
    labels = @{
        alertname = "TestCriticalAlert"
        severity = "critical"
        service = "dhakacart-backend"
        instance = "test-instance"
    }
    annotations = @{
        summary = "Test critical alert for notification system"
        description = "This is a test alert to verify critical notification channels are working"
        runbook_url = "https://runbooks.dhakacart.com/test-alert"
    }
    startsAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    endsAt = (Get-Date).AddMinutes(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "$ALERTMANAGER_URL/api/v1/alerts" -Method Post -Body "[$criticalAlert]" -ContentType "application/json"
Write-Host "Critical test alert sent!" -ForegroundColor Green

# Test warning alert
$warningAlert = @{
    labels = @{
        alertname = "TestWarningAlert"
        severity = "warning"
        service = "dhakacart-backend"
        instance = "test-instance"
    }
    annotations = @{
        summary = "Test warning alert for notification system"
        description = "This is a test alert to verify warning notification channels are working"
        runbook_url = "https://runbooks.dhakacart.com/test-alert"
    }
    startsAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    endsAt = (Get-Date).AddMinutes(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "$ALERTMANAGER_URL/api/v1/alerts" -Method Post -Body "[$warningAlert]" -ContentType "application/json"
Write-Host "Warning test alert sent!" -ForegroundColor Green
'@

    $testScript | Out-File -FilePath "test-alerts.ps1" -Encoding UTF8

    # Get AlertManager service information
    $alertmanagerService = kubectl get svc -n monitoring -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}'

    Write-Host ""
    Write-Host "✅ Alerting and notification system deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Configuration Summary:" -ForegroundColor Yellow
    Write-Host "  - AlertManager configured with email and Slack notifications"
    Write-Host "  - Notification templates created for better formatting"
    Write-Host "  - DhakaCart-specific alerting rules applied"
    Write-Host "  - Runbooks created for common scenarios"
    Write-Host ""
    Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Update AlertManager configuration with your actual:"
    Write-Host "   - SMTP credentials (Gmail app password)"
    Write-Host "   - Slack webhook URLs"
    Write-Host "   - Email addresses for different teams"
    Write-Host ""
    Write-Host "2. Test notifications:" -ForegroundColor Cyan
    Write-Host "   kubectl port-forward -n monitoring svc/$alertmanagerService 9093:9093"
    Write-Host "   Then run: .\test-alerts.ps1"
    Write-Host ""
    Write-Host "3. Access AlertManager UI:" -ForegroundColor Cyan
    Write-Host "   kubectl port-forward -n monitoring svc/$alertmanagerService 9093:9093"
    Write-Host "   Open: http://localhost:9093"
    Write-Host ""
    Write-Host "📧 Email Configuration Required:" -ForegroundColor Yellow
    Write-Host "  - Update alertmanager/alertmanager.yaml with your SMTP settings"
    Write-Host "  - For Gmail: Use app-specific password, not regular password"
    Write-Host "  - Enable 2FA and generate app password at: https://myaccount.google.com/apppasswords"
    Write-Host ""
    Write-Host "💬 Slack Configuration Required:" -ForegroundColor Yellow
    Write-Host "  - Create Slack app and webhook URLs"
    Write-Host "  - Update webhook URLs in alertmanager/alertmanager.yaml"
    Write-Host "  - Create channels: #alerts-critical, #alerts-warning, #business-alerts, #infrastructure-alerts"
    Write-Host ""
    Write-Host "📚 Runbooks Available:" -ForegroundColor Cyan
    Write-Host "  - High Error Rate: kubectl get configmap dhakacart-runbooks -n dhakacart -o jsonpath='{.data.high-error-rate\.md}'"
    Write-Host "  - High Response Time: kubectl get configmap dhakacart-runbooks -n dhakacart -o jsonpath='{.data.high-response-time\.md}'"
    Write-Host "  - Pod Crash Loop: kubectl get configmap dhakacart-runbooks -n dhakacart -o jsonpath='{.data.pod-crash-loop\.md}'"
    Write-Host ""
    Write-Host "🔍 Useful Commands:" -ForegroundColor Cyan
    Write-Host "  - View active alerts: Invoke-RestMethod http://localhost:9093/api/v1/alerts"
    Write-Host "  - Check AlertManager config: kubectl get secret alertmanager-config -n monitoring -o yaml"
    Write-Host "  - View alerting rules: kubectl get prometheusrules -n dhakacart"
    Write-Host "  - Test alert routing: kubectl logs -n monitoring alertmanager-prometheus-stack-kube-prom-alertmanager-0"
}