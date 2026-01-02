# Deploy AWS Load Balancer Controller and Ingress configuration for DhakaCart
# This script sets up SSL/TLS termination and ingress routing

$ErrorActionPreference = "Stop"

Write-Host "🌐 Deploying AWS Load Balancer Controller and Ingress for DhakaCart..." -ForegroundColor Green

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
$NAMESPACE = "kube-system"
$CHART_VERSION = "1.7.2"
$RELEASE_NAME = "aws-load-balancer-controller"

Write-Host "📦 Adding EKS Helm repository..." -ForegroundColor Yellow
helm repo add eks https://aws.github.io/eks-charts
helm repo update

Write-Host "🏗️  Creating ingress controller resources..." -ForegroundColor Yellow
kubectl apply -f ingress-controller.yaml

Write-Host "⏳ Waiting for service account to be created..." -ForegroundColor Yellow
kubectl wait --for=condition=Ready serviceaccount/aws-load-balancer-controller -n $NAMESPACE --timeout=60s

Write-Host "📊 Installing AWS Load Balancer Controller..." -ForegroundColor Yellow
helm upgrade --install $RELEASE_NAME eks/aws-load-balancer-controller `
    --namespace $NAMESPACE `
    --version $CHART_VERSION `
    --values alb-controller-values.yaml `
    --wait `
    --timeout 300s

Write-Host "⏳ Waiting for AWS Load Balancer Controller to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=300s deployment/aws-load-balancer-controller -n $NAMESPACE

Write-Host "🔗 Creating DhakaCart ingress resources..." -ForegroundColor Yellow
kubectl apply -f dhakacart-ingress.yaml

Write-Host "✅ Verifying ingress configuration..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Ingress Controller Status:"
kubectl get deployment aws-load-balancer-controller -n $NAMESPACE

Write-Host ""
Write-Host "Ingress Resources:"
kubectl get ingress -n dhakacart

Write-Host ""
Write-Host "Load Balancers:"
kubectl get svc -n dhakacart

Write-Host ""
Write-Host "🎉 AWS Load Balancer Controller and Ingress deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Update DNS records to point to the ALB endpoint"
Write-Host "2. Verify SSL certificate is properly configured"
Write-Host "3. Test HTTPS redirects and SSL termination"
Write-Host "4. Configure WAF rules if needed"
Write-Host ""
Write-Host "🔍 Troubleshooting:" -ForegroundColor Cyan
Write-Host "- Check ALB controller logs: kubectl logs -l app.kubernetes.io/name=aws-load-balancer-controller -n $NAMESPACE"
Write-Host "- Verify ingress events: kubectl describe ingress dhakacart-ingress -n dhakacart"
Write-Host "- Check ALB in AWS console for health check status"
Write-Host "- Verify certificate ARN in ingress annotations"