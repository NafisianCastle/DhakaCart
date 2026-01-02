# Deploy RBAC configuration for DhakaCart
# This script applies all RBAC policies and security configurations

$ErrorActionPreference = "Stop"

Write-Host "🔐 Deploying RBAC and Security Policies for DhakaCart..." -ForegroundColor Green

# Check if kubectl is available
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "❌ kubectl is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Variables
$NAMESPACE = "dhakacart"

Write-Host "🏗️  Ensuring namespace exists..." -ForegroundColor Yellow
kubectl apply -f ../namespace.yaml

Write-Host "👤 Creating service accounts..." -ForegroundColor Yellow
kubectl apply -f service-accounts.yaml

Write-Host "🔑 Creating roles..." -ForegroundColor Yellow
kubectl apply -f roles.yaml

Write-Host "🔗 Creating role bindings..." -ForegroundColor Yellow
kubectl apply -f role-bindings.yaml

Write-Host "🛡️  Applying pod security policies..." -ForegroundColor Yellow
kubectl apply -f ../policies/pod-security-policy.yaml

Write-Host "🌐 Applying network policies..." -ForegroundColor Yellow
kubectl apply -f ../policies/network-policies.yaml

Write-Host "✅ Verifying RBAC configuration..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Service Accounts:"
kubectl get serviceaccounts -n $NAMESPACE

Write-Host ""
Write-Host "Roles:"
kubectl get roles -n $NAMESPACE

Write-Host ""
Write-Host "Role Bindings:"
kubectl get rolebindings -n $NAMESPACE

Write-Host ""
Write-Host "Network Policies:"
kubectl get networkpolicies -n $NAMESPACE

Write-Host ""
Write-Host "🎉 RBAC and Security Policies deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Update your application deployments to use the appropriate service accounts"
Write-Host "2. Test network connectivity between components"
Write-Host "3. Verify that pod security policies are enforced"
Write-Host ""
Write-Host "🔍 Troubleshooting:" -ForegroundColor Cyan
Write-Host "- Check pod security policy violations: kubectl get events -n $NAMESPACE --field-selector reason=FailedCreate"
Write-Host "- Test network policies: kubectl exec -it <pod-name> -n $NAMESPACE -- nc -zv <target-service> <port>"
Write-Host "- Verify RBAC permissions: kubectl auth can-i <verb> <resource> --as=system:serviceaccount:$NAMESPACE:<service-account>"