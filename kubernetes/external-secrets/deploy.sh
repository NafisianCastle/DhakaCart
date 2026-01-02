#!/bin/bash

# Deploy External Secrets Operator for DhakaCart
# This script installs and configures External Secrets Operator to sync secrets from AWS Secrets Manager

set -e

echo "🔐 Deploying External Secrets Operator for DhakaCart..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo "❌ helm is not installed or not in PATH"
    exit 1
fi

# Variables
NAMESPACE="external-secrets"
CHART_VERSION="0.9.11"
RELEASE_NAME="external-secrets"

echo "📦 Adding External Secrets Helm repository..."
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

echo "🏗️  Creating namespace..."
kubectl apply -f namespace.yaml

echo "👤 Creating service account..."
kubectl apply -f service-account.yaml

echo "📊 Installing External Secrets Operator..."
helm upgrade --install $RELEASE_NAME external-secrets/external-secrets \
    --namespace $NAMESPACE \
    --version $CHART_VERSION \
    --values helm-values.yaml \
    --wait \
    --timeout 300s

echo "⏳ Waiting for External Secrets Operator to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/external-secrets -n $NAMESPACE
kubectl wait --for=condition=available --timeout=300s deployment/external-secrets-webhook -n $NAMESPACE
kubectl wait --for=condition=available --timeout=300s deployment/external-secrets-cert-controller -n $NAMESPACE

echo "🔗 Creating ClusterSecretStore..."
kubectl apply -f cluster-secret-store.yaml

echo "🔑 Creating External Secrets..."
kubectl apply -f database-secret.yaml
kubectl apply -f redis-secret.yaml
kubectl apply -f app-secrets.yaml

echo "✅ Verifying External Secrets status..."
kubectl get externalsecrets -n dhakacart
kubectl get secrets -n dhakacart | grep dhakacart

echo "🎉 External Secrets Operator deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Verify that secrets are synced: kubectl get secrets -n dhakacart"
echo "2. Check External Secret status: kubectl describe externalsecret dhakacart-db-credentials -n dhakacart"
echo "3. Update your application deployments to use the synced secrets"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check External Secrets Operator logs: kubectl logs -l app.kubernetes.io/name=external-secrets -n external-secrets"
echo "- Verify IAM role permissions for External Secrets service account"
echo "- Ensure AWS Secrets Manager secrets exist and are accessible"