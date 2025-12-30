#!/bin/bash

# DhakaCart Kubernetes Deployment Script
# This script deploys the complete DhakaCart application to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "Starting DhakaCart deployment to Kubernetes..."

# Create namespace first
print_status "Creating namespace..."
kubectl apply -f namespace.yaml

# Apply ConfigMap and Secrets (secrets should be created separately)
print_status "Applying ConfigMap..."
kubectl apply -f configmap.yaml

print_warning "Please ensure secrets are created before proceeding:"
print_warning "kubectl create secret generic dhakacart-secrets --namespace=dhakacart \\"
print_warning "  --from-literal=db-host=<RDS_ENDPOINT> \\"
print_warning "  --from-literal=db-port=5432 \\"
print_warning "  --from-literal=db-name=dhakacartdb \\"
print_warning "  --from-literal=db-user=<DB_USER> \\"
print_warning "  --from-literal=db-password=<DB_PASSWORD> \\"
print_warning "  --from-literal=redis-host=<REDIS_ENDPOINT> \\"
print_warning "  --from-literal=redis-port=6379"

# Deploy applications
print_status "Deploying backend application..."
kubectl apply -f deployments/backend-deployment.yaml

print_status "Deploying frontend application..."
kubectl apply -f deployments/frontend-deployment.yaml

# Create services
print_status "Creating services..."
kubectl apply -f services/backend-service.yaml
kubectl apply -f services/frontend-service.yaml

# Apply Pod Disruption Budgets
print_status "Applying Pod Disruption Budgets..."
kubectl apply -f policies/pod-disruption-budgets.yaml

# Deploy autoscaling configurations
print_status "Setting up autoscaling..."
kubectl apply -f autoscaling/backend-hpa.yaml
kubectl apply -f autoscaling/frontend-hpa.yaml

# Note: VPA and Cluster Autoscaler require additional setup
print_warning "VPA requires the Vertical Pod Autoscaler to be installed in the cluster"
print_warning "Cluster Autoscaler requires proper IAM roles and node group tags"

# Deploy ingress (choose one based on your setup)
print_status "Setting up ingress..."
print_warning "Choose your ingress controller:"
print_warning "For AWS ALB: kubectl apply -f ingress/aws-load-balancer-controller.yaml"
print_warning "For AWS ALB: kubectl apply -f ingress/dhakacart-ingress.yaml"
print_warning "For Nginx: kubectl apply -f ingress/rate-limiting-config.yaml"

# Wait for deployments to be ready
print_status "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/dhakacart-backend -n dhakacart
kubectl wait --for=condition=available --timeout=300s deployment/dhakacart-frontend -n dhakacart

# Check deployment status
print_status "Checking deployment status..."
kubectl get pods -n dhakacart
kubectl get services -n dhakacart
kubectl get ingress -n dhakacart

print_status "DhakaCart deployment completed successfully!"
print_status "Use 'kubectl get all -n dhakacart' to see all resources"