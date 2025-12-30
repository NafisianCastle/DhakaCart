# DhakaCart Kubernetes Deployment Script (PowerShell)
# This script deploys the complete DhakaCart application to Kubernetes

param(
    [switch]$SkipSecrets,
    [string]$IngressType = "alb"
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if kubectl is available
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Error "kubectl is not installed or not in PATH"
    exit 1
}

# Check if we can connect to the cluster
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Error "Cannot connect to Kubernetes cluster"
    exit 1
}

Write-Status "Starting DhakaCart deployment to Kubernetes..."

# Create namespace first
Write-Status "Creating namespace..."
kubectl apply -f namespace.yaml

# Apply ConfigMap
Write-Status "Applying ConfigMap..."
kubectl apply -f configmap.yaml

if (-not $SkipSecrets) {
    Write-Warning "Please ensure secrets are created before proceeding:"
    Write-Warning "kubectl create secret generic dhakacart-secrets --namespace=dhakacart \"
    Write-Warning "  --from-literal=db-host=<RDS_ENDPOINT> \"
    Write-Warning "  --from-literal=db-port=5432 \"
    Write-Warning "  --from-literal=db-name=dhakacartdb \"
    Write-Warning "  --from-literal=db-user=<DB_USER> \"
    Write-Warning "  --from-literal=db-password=<DB_PASSWORD> \"
    Write-Warning "  --from-literal=redis-host=<REDIS_ENDPOINT> \"
    Write-Warning "  --from-literal=redis-port=6379"
    
    $continue = Read-Host "Have you created the secrets? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Error "Please create secrets first and run the script again with -SkipSecrets"
        exit 1
    }
}

# Deploy applications
Write-Status "Deploying backend application..."
kubectl apply -f deployments/backend-deployment.yaml

Write-Status "Deploying frontend application..."
kubectl apply -f deployments/frontend-deployment.yaml

# Create services
Write-Status "Creating services..."
kubectl apply -f services/backend-service.yaml
kubectl apply -f services/frontend-service.yaml

# Apply Pod Disruption Budgets
Write-Status "Applying Pod Disruption Budgets..."
kubectl apply -f policies/pod-disruption-budgets.yaml

# Deploy autoscaling configurations
Write-Status "Setting up autoscaling..."
kubectl apply -f autoscaling/backend-hpa.yaml
kubectl apply -f autoscaling/frontend-hpa.yaml

Write-Warning "VPA requires the Vertical Pod Autoscaler to be installed in the cluster"
Write-Warning "Cluster Autoscaler requires proper IAM roles and node group tags"

# Deploy ingress based on type
Write-Status "Setting up ingress ($IngressType)..."
switch ($IngressType.ToLower()) {
    "alb" {
        Write-Status "Deploying AWS Load Balancer Controller ingress..."
        kubectl apply -f ingress/dhakacart-ingress.yaml
    }
    "nginx" {
        Write-Status "Deploying Nginx ingress with rate limiting..."
        kubectl apply -f ingress/rate-limiting-config.yaml
    }
    default {
        Write-Warning "Unknown ingress type: $IngressType"
        Write-Warning "Available options: alb, nginx"
    }
}

# Wait for deployments to be ready
Write-Status "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/dhakacart-backend -n dhakacart
kubectl wait --for=condition=available --timeout=300s deployment/dhakacart-frontend -n dhakacart

# Check deployment status
Write-Status "Checking deployment status..."
kubectl get pods -n dhakacart
kubectl get services -n dhakacart
kubectl get ingress -n dhakacart

Write-Status "DhakaCart deployment completed successfully!"
Write-Status "Use 'kubectl get all -n dhakacart' to see all resources"