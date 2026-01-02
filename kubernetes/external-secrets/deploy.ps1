# Deploy External Secrets Operator for DhakaCart
# This script installs and configures External Secrets Operator to sync secrets from AWS Secrets Manager

$ErrorActionPreference = "Stop"

Write-Host "🔐 Deploying External Secrets Operator for DhakaCart..." -ForegroundColor Green

# Check if kubectl is available
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "❌ kubectl is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if helm is available
if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ helm is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Variables
$NAMESPACE = "external-secrets"
$CHART_VERSION = "0.9.11"
$RELEASE_NAME = "external-secrets"

Write-Host "📦 Adding External Secrets Helm repository..." -ForegroundColor Yellow
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

Write-Host "🏗️  Creating namespace..." -ForegroundColor Yellow
kubectl apply -f namespace.yaml

Write-Host "👤 Creating service account..." -ForegroundColor Yellow
kubectl apply -f service-account.yaml

Write-Host "📊 Installing External Secrets Operator..." -ForegroundColor Yellow
helm upgrade --install $RELEASE_NAME external-secrets/external-secrets `
    --namespace $NAMESPACE `
    --version $CHART_VERSION `
    --values helm-values.yaml `
    --wait `
    --timeout 300s

Write-Host "⏳ Waiting for External Secrets Operator to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=300s deployment/external-secrets -n $NAMESPACE
kubectl wait --for=condition=available --timeout=300s deployment/external-secrets-webhook -n $NAMESPACE
kubectl wait --for=condition=available --timeout=300s deployment/external-secrets-cert-controller -n $NAMESPACE

Write-Host "🔗 Creating ClusterSecretStore..." -ForegroundColor Yellow
kubectl apply -f cluster-secret-store.yaml

Write-Host "🔑 Creating External Secrets..." -ForegroundColor Yellow
kubectl apply -f database-secret.yaml
kubectl apply -f redis-secret.yaml
kubectl apply -f app-secrets.yaml

Write-Host "✅ Verifying External Secrets status..." -ForegroundColor Yellow
kubectl get externalsecrets -n dhakacart
kubectl get secrets -n dhakacart | Select-String dhakacart

Write-Host "🎉 External Secrets Operator deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify that secrets are synced: kubectl get secrets -n dhakacart"
Write-Host "2. Check External Secret status: kubectl describe externalsecret dhakacart-db-credentials -n dhakacart"
Write-Host "3. Update your application deployments to use the synced secrets"
Write-Host ""
Write-Host "🔍 Troubleshooting:" -ForegroundColor Cyan
Write-Host "- Check External Secrets Operator logs: kubectl logs -l app.kubernetes.io/name=external-secrets -n external-secrets"
Write-Host "- Verify IAM role permissions for External Secrets service account"
Write-Host "- Ensure AWS Secrets Manager secrets exist and are accessible"