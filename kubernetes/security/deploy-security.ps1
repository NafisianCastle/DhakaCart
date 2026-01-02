# Deploy comprehensive security configuration for DhakaCart
# This script applies all security policies, SSL/TLS configuration, and network policies

$ErrorActionPreference = "Stop"

Write-Host "🔐 Deploying comprehensive security configuration for DhakaCart..." -ForegroundColor Green

# Check if kubectl is available
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "❌ kubectl is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "🏗️  Ensuring namespace exists..." -ForegroundColor Yellow
kubectl apply -f ../namespace.yaml

Write-Host "🔑 Deploying secrets management..." -ForegroundColor Yellow
Set-Location ../external-secrets
./deploy.ps1
Set-Location ../security

Write-Host "👤 Deploying RBAC configuration..." -ForegroundColor Yellow
Set-Location ../rbac
./deploy-rbac.ps1
Set-Location ../security

Write-Host "🌐 Deploying ingress and SSL/TLS configuration..." -ForegroundColor Yellow
Set-Location ../ingress
./deploy-ingress.ps1
Set-Location ../security

Write-Host "🛡️  Applying additional SSL network policies..." -ForegroundColor Yellow
kubectl apply -f ../policies/ssl-network-policies.yaml

Write-Host "✅ Verifying security configuration..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Secrets:"
kubectl get secrets -n dhakacart | Select-String dhakacart

Write-Host ""
Write-Host "Service Accounts:"
kubectl get serviceaccounts -n dhakacart

Write-Host ""
Write-Host "Network Policies:"
kubectl get networkpolicies -n dhakacart

Write-Host ""
Write-Host "Ingress Resources:"
kubectl get ingress -n dhakacart

Write-Host ""
Write-Host "External Secrets:"
kubectl get externalsecrets -n dhakacart

Write-Host ""
Write-Host "🎉 Comprehensive security configuration deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Security checklist:" -ForegroundColor Cyan
Write-Host "✅ Secrets management with AWS Secrets Manager"
Write-Host "✅ RBAC policies and access controls"
Write-Host "✅ SSL/TLS termination at load balancer"
Write-Host "✅ Network policies for traffic segmentation"
Write-Host "✅ Pod security standards enforcement"
Write-Host "✅ WAF protection for web applications"
Write-Host ""
Write-Host "🔍 Security verification commands:" -ForegroundColor Cyan
Write-Host "- Test HTTPS redirect: curl -I http://dhakacart.com"
Write-Host "- Verify SSL certificate: openssl s_client -connect dhakacart.com:443 -servername dhakacart.com"
Write-Host "- Check network policy enforcement: kubectl exec -it <pod> -n dhakacart -- nc -zv <blocked-service> <port>"
Write-Host "- Verify RBAC: kubectl auth can-i <verb> <resource> --as=system:serviceaccount:dhakacart:<service-account>"
Write-Host "- Monitor WAF: Check AWS WAF console for blocked requests"