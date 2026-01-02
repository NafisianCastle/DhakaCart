#!/bin/bash

# Deploy RBAC configuration for DhakaCart
# This script applies all RBAC policies and security configurations

set -e

echo "🔐 Deploying RBAC and Security Policies for DhakaCart..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Variables
NAMESPACE="dhakacart"

echo "🏗️  Ensuring namespace exists..."
kubectl apply -f ../namespace.yaml

echo "👤 Creating service accounts..."
kubectl apply -f service-accounts.yaml

echo "🔑 Creating roles..."
kubectl apply -f roles.yaml

echo "🔗 Creating role bindings..."
kubectl apply -f role-bindings.yaml

echo "🛡️  Applying pod security policies..."
kubectl apply -f ../policies/pod-security-policy.yaml

echo "🌐 Applying network policies..."
kubectl apply -f ../policies/network-policies.yaml

echo "✅ Verifying RBAC configuration..."
echo ""
echo "Service Accounts:"
kubectl get serviceaccounts -n $NAMESPACE

echo ""
echo "Roles:"
kubectl get roles -n $NAMESPACE

echo ""
echo "Role Bindings:"
kubectl get rolebindings -n $NAMESPACE

echo ""
echo "Network Policies:"
kubectl get networkpolicies -n $NAMESPACE

echo ""
echo "🎉 RBAC and Security Policies deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your application deployments to use the appropriate service accounts"
echo "2. Test network connectivity between components"
echo "3. Verify that pod security policies are enforced"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check pod security policy violations: kubectl get events -n $NAMESPACE --field-selector reason=FailedCreate"
echo "- Test network policies: kubectl exec -it <pod-name> -n $NAMESPACE -- nc -zv <target-service> <port>"
echo "- Verify RBAC permissions: kubectl auth can-i <verb> <resource> --as=system:serviceaccount:$NAMESPACE:<service-account>"