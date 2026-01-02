#!/bin/bash

# Deploy comprehensive security configuration for DhakaCart
# This script applies all security policies, SSL/TLS configuration, and network policies

set -e

echo "🔐 Deploying comprehensive security configuration for DhakaCart..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

echo "🏗️  Ensuring namespace exists..."
kubectl apply -f ../namespace.yaml

echo "🔑 Deploying secrets management..."
cd ../external-secrets
./deploy.sh
cd ../security

echo "👤 Deploying RBAC configuration..."
cd ../rbac
./deploy-rbac.sh
cd ../security

echo "🌐 Deploying ingress and SSL/TLS configuration..."
cd ../ingress
./deploy-ingress.sh
cd ../security

echo "🛡️  Applying additional SSL network policies..."
kubectl apply -f ../policies/ssl-network-policies.yaml

echo "✅ Verifying security configuration..."
echo ""
echo "Secrets:"
kubectl get secrets -n dhakacart | grep dhakacart

echo ""
echo "Service Accounts:"
kubectl get serviceaccounts -n dhakacart

echo ""
echo "Network Policies:"
kubectl get networkpolicies -n dhakacart

echo ""
echo "Ingress Resources:"
kubectl get ingress -n dhakacart

echo ""
echo "External Secrets:"
kubectl get externalsecrets -n dhakacart

echo ""
echo "🎉 Comprehensive security configuration deployment completed successfully!"
echo ""
echo "📋 Security checklist:"
echo "✅ Secrets management with AWS Secrets Manager"
echo "✅ RBAC policies and access controls"
echo "✅ SSL/TLS termination at load balancer"
echo "✅ Network policies for traffic segmentation"
echo "✅ Pod security standards enforcement"
echo "✅ WAF protection for web applications"
echo ""
echo "🔍 Security verification commands:"
echo "- Test HTTPS redirect: curl -I http://dhakacart.com"
echo "- Verify SSL certificate: openssl s_client -connect dhakacart.com:443 -servername dhakacart.com"
echo "- Check network policy enforcement: kubectl exec -it <pod> -n dhakacart -- nc -zv <blocked-service> <port>"
echo "- Verify RBAC: kubectl auth can-i <verb> <resource> --as=system:serviceaccount:dhakacart:<service-account>"
echo "- Monitor WAF: Check AWS WAF console for blocked requests"