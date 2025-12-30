#!/bin/bash

# Deploy Prometheus Monitoring Stack for DhakaCart
# This script installs the kube-prometheus-stack using Helm

set -e

echo "🚀 Deploying Prometheus Monitoring Stack for DhakaCart..."

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Helm is not installed. Please install Helm first."
    exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not configured or cluster is not accessible."
    exit 1
fi

# Create monitoring namespace
echo "📦 Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Create dhakacart namespace if it doesn't exist
echo "📦 Creating dhakacart namespace..."
kubectl create namespace dhakacart --dry-run=client -o yaml | kubectl apply -f -

# Add Prometheus community Helm repository
echo "📚 Adding Prometheus community Helm repository..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install or upgrade kube-prometheus-stack
echo "⚙️  Installing/Upgrading kube-prometheus-stack..."
helm upgrade --install prometheus-stack prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --values values.yaml \
    --wait \
    --timeout 10m

# Wait for Prometheus operator to be ready
echo "⏳ Waiting for Prometheus operator to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus-operator --namespace monitoring --timeout=300s

# Apply ServiceMonitors
echo "📊 Applying ServiceMonitors..."
kubectl apply -f servicemonitors/ -n dhakacart

# Apply PrometheusRules
echo "🚨 Applying PrometheusRules..."
kubectl apply -f rules/ -n dhakacart

# Wait for Prometheus to be ready
echo "⏳ Waiting for Prometheus to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus --namespace monitoring --timeout=300s

# Wait for Grafana to be ready
echo "⏳ Waiting for Grafana to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana --namespace monitoring --timeout=300s

# Get Grafana service information
echo "📊 Getting Grafana service information..."
GRAFANA_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}')
GRAFANA_TYPE=$(kubectl get svc -n monitoring $GRAFANA_SERVICE -o jsonpath='{.spec.type}')

if [ "$GRAFANA_TYPE" = "LoadBalancer" ]; then
    echo "⏳ Waiting for LoadBalancer to get external IP..."
    kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' svc/$GRAFANA_SERVICE -n monitoring --timeout=300s
    GRAFANA_URL=$(kubectl get svc -n monitoring $GRAFANA_SERVICE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    if [ -z "$GRAFANA_URL" ]; then
        GRAFANA_URL=$(kubectl get svc -n monitoring $GRAFANA_SERVICE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    fi
    echo "🎉 Grafana is accessible at: http://$GRAFANA_URL"
else
    GRAFANA_PORT=$(kubectl get svc -n monitoring $GRAFANA_SERVICE -o jsonpath='{.spec.ports[0].nodePort}')
    echo "🎉 Grafana is accessible via NodePort: $GRAFANA_PORT"
    echo "   Use: kubectl port-forward -n monitoring svc/$GRAFANA_SERVICE 3000:80"
fi

# Get Prometheus service information
PROMETHEUS_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}')
echo "🔍 Prometheus is accessible via: kubectl port-forward -n monitoring svc/$PROMETHEUS_SERVICE 9090:9090"

# Get AlertManager service information
ALERTMANAGER_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}')
echo "🚨 AlertManager is accessible via: kubectl port-forward -n monitoring svc/$ALERTMANAGER_SERVICE 9093:9093"

echo ""
echo "✅ Prometheus monitoring stack deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your applications to expose metrics on /metrics endpoint"
echo "2. Update ServiceMonitors if needed"
echo "3. Configure AlertManager notification channels"
echo "4. Import additional Grafana dashboards as needed"
echo ""
echo "🔐 Default Grafana credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo "   (Change this in production!)"