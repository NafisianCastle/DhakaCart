#!/bin/bash

# Deploy AWS Load Balancer Controller and Ingress configuration for DhakaCart
# This script sets up SSL/TLS termination and ingress routing

set -e

echo "🌐 Deploying AWS Load Balancer Controller and Ingress for DhakaCart..."

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
NAMESPACE="kube-system"
CHART_VERSION="1.7.2"
RELEASE_NAME="aws-load-balancer-controller"

echo "📦 Adding EKS Helm repository..."
helm repo add eks https://aws.github.io/eks-charts
helm repo update

echo "🏗️  Creating ingress controller resources..."
kubectl apply -f ingress-controller.yaml

echo "⏳ Waiting for service account to be created..."
kubectl wait --for=condition=Ready serviceaccount/aws-load-balancer-controller -n $NAMESPACE --timeout=60s

echo "📊 Installing AWS Load Balancer Controller..."
helm upgrade --install $RELEASE_NAME eks/aws-load-balancer-controller \
    --namespace $NAMESPACE \
    --version $CHART_VERSION \
    --values alb-controller-values.yaml \
    --wait \
    --timeout 300s

echo "⏳ Waiting for AWS Load Balancer Controller to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/aws-load-balancer-controller -n $NAMESPACE

echo "🔗 Creating DhakaCart ingress resources..."
kubectl apply -f dhakacart-ingress.yaml

echo "✅ Verifying ingress configuration..."
echo ""
echo "Ingress Controller Status:"
kubectl get deployment aws-load-balancer-controller -n $NAMESPACE

echo ""
echo "Ingress Resources:"
kubectl get ingress -n dhakacart

echo ""
echo "Load Balancers:"
kubectl get svc -n dhakacart

echo ""
echo "🎉 AWS Load Balancer Controller and Ingress deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update DNS records to point to the ALB endpoint"
echo "2. Verify SSL certificate is properly configured"
echo "3. Test HTTPS redirects and SSL termination"
echo "4. Configure WAF rules if needed"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check ALB controller logs: kubectl logs -l app.kubernetes.io/name=aws-load-balancer-controller -n $NAMESPACE"
echo "- Verify ingress events: kubectl describe ingress dhakacart-ingress -n dhakacart"
echo "- Check ALB in AWS console for health check status"
echo "- Verify certificate ARN in ingress annotations"