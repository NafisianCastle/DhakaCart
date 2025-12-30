# Deploy Prometheus Monitoring Stack for DhakaCart
# This script installs the kube-prometheus-stack using Helm

param(
    [switch]$DryRun = $false
)

Write-Host "🚀 Deploying Prometheus Monitoring Stack for DhakaCart..." -ForegroundColor Green

# Check if Helm is installed
try {
    helm version | Out-Null
} catch {
    Write-Host "❌ Helm is not installed. Please install Helm first." -ForegroundColor Red
    exit 1
}

# Check if kubectl is configured
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Host "❌ kubectl is not configured or cluster is not accessible." -ForegroundColor Red
    exit 1
}

if ($DryRun) {
    Write-Host "🔍 Running in dry-run mode..." -ForegroundColor Yellow
}

# Create monitoring namespace
Write-Host "📦 Creating monitoring namespace..." -ForegroundColor Cyan
if ($DryRun) {
    kubectl create namespace monitoring --dry-run=client -o yaml
} else {
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
}

# Create dhakacart namespace if it doesn't exist
Write-Host "📦 Creating dhakacart namespace..." -ForegroundColor Cyan
if ($DryRun) {
    kubectl create namespace dhakacart --dry-run=client -o yaml
} else {
    kubectl create namespace dhakacart --dry-run=client -o yaml | kubectl apply -f -
}

# Add Prometheus community Helm repository
Write-Host "📚 Adding Prometheus community Helm repository..." -ForegroundColor Cyan
if (-not $DryRun) {
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
}

# Install or upgrade kube-prometheus-stack
Write-Host "⚙️  Installing/Upgrading kube-prometheus-stack..." -ForegroundColor Cyan
$helmArgs = @(
    "upgrade", "--install", "prometheus-stack", "prometheus-community/kube-prometheus-stack",
    "--namespace", "monitoring",
    "--values", "values.yaml",
    "--wait",
    "--timeout", "10m"
)

if ($DryRun) {
    $helmArgs += "--dry-run"
}

& helm $helmArgs

if (-not $DryRun) {
    # Wait for Prometheus operator to be ready
    Write-Host "⏳ Waiting for Prometheus operator to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus-operator --namespace monitoring --timeout=300s

    # Apply ServiceMonitors
    Write-Host "📊 Applying ServiceMonitors..." -ForegroundColor Cyan
    kubectl apply -f servicemonitors/ -n dhakacart

    # Apply PrometheusRules
    Write-Host "🚨 Applying PrometheusRules..." -ForegroundColor Cyan
    kubectl apply -f rules/ -n dhakacart

    # Wait for Prometheus to be ready
    Write-Host "⏳ Waiting for Prometheus to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus --namespace monitoring --timeout=300s

    # Wait for Grafana to be ready
    Write-Host "⏳ Waiting for Grafana to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana --namespace monitoring --timeout=300s

    # Get Grafana service information
    Write-Host "📊 Getting Grafana service information..." -ForegroundColor Cyan
    $grafanaService = kubectl get svc -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}'
    $grafanaType = kubectl get svc -n monitoring $grafanaService -o jsonpath='{.spec.type}'

    if ($grafanaType -eq "LoadBalancer") {
        Write-Host "⏳ Waiting for LoadBalancer to get external IP..." -ForegroundColor Yellow
        kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' svc/$grafanaService -n monitoring --timeout=300s
        $grafanaUrl = kubectl get svc -n monitoring $grafanaService -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
        if (-not $grafanaUrl) {
            $grafanaUrl = kubectl get svc -n monitoring $grafanaService -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
        }
        Write-Host "🎉 Grafana is accessible at: http://$grafanaUrl" -ForegroundColor Green
    } else {
        $grafanaPort = kubectl get svc -n monitoring $grafanaService -o jsonpath='{.spec.ports[0].nodePort}'
        Write-Host "🎉 Grafana is accessible via NodePort: $grafanaPort" -ForegroundColor Green
        Write-Host "   Use: kubectl port-forward -n monitoring svc/$grafanaService 3000:80" -ForegroundColor Cyan
    }

    # Get Prometheus service information
    $prometheusService = kubectl get svc -n monitoring -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}'
    Write-Host "🔍 Prometheus is accessible via: kubectl port-forward -n monitoring svc/$prometheusService 9090:9090" -ForegroundColor Cyan

    # Get AlertManager service information
    $alertmanagerService = kubectl get svc -n monitoring -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}'
    Write-Host "🚨 AlertManager is accessible via: kubectl port-forward -n monitoring svc/$alertmanagerService 9093:9093" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "✅ Prometheus monitoring stack deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Configure your applications to expose metrics on /metrics endpoint"
    Write-Host "2. Update ServiceMonitors if needed"
    Write-Host "3. Configure AlertManager notification channels"
    Write-Host "4. Import additional Grafana dashboards as needed"
    Write-Host ""
    Write-Host "🔐 Default Grafana credentials:" -ForegroundColor Yellow
    Write-Host "   Username: admin"
    Write-Host "   Password: admin123"
    Write-Host "   (Change this in production!)" -ForegroundColor Red
}