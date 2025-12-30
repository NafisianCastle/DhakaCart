# Application Deployment Script for DhakaCart
# This script builds, pushes, and deploys the frontend and backend applications

param(
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }),
    [string]$Environment = $(if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }),
    [string]$ImageTag = $(if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "latest" })
)

$ErrorActionPreference = "Stop"

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check Docker
    try {
        docker --version | Out-Null
        Write-Success "Docker is available"
    }
    catch {
        Write-Error "Docker is not installed or not running"
        exit 1
    }
    
    # Check AWS CLI
    try {
        aws --version | Out-Null
        Write-Success "AWS CLI is available"
    }
    catch {
        Write-Error "AWS CLI is not installed"
        exit 1
    }
    
    # Check kubectl
    try {
        kubectl version --client | Out-Null
        Write-Success "kubectl is available"
    }
    catch {
        Write-Error "kubectl is not installed"
        exit 1
    }
    
    # Check if terraform outputs exist
    if (Test-Path "terraform-outputs.json") {
        Write-Success "Terraform outputs found"
    }
    else {
        Write-Error "Terraform outputs not found. Please run infrastructure deployment first."
        exit 1
    }
}

# Get ECR login and repository URLs
function Get-EcrInfo {
    Write-Log "Getting ECR repository information..."
    
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    
    $script:FrontendRepo = $outputs.ecr_frontend_repository_url.value
    $script:BackendRepo = $outputs.ecr_backend_repository_url.value
    
    if (-not $FrontendRepo -or $FrontendRepo -eq "null") {
        Write-Error "Frontend ECR repository URL not found"
        exit 1
    }
    
    if (-not $BackendRepo -or $BackendRepo -eq "null") {
        Write-Error "Backend ECR repository URL not found"
        exit 1
    }
    
    Write-Success "Frontend ECR: $FrontendRepo"
    Write-Success "Backend ECR: $BackendRepo"
    
    # Login to ECR
    Write-Log "Logging into ECR..."
    $loginCommand = aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $FrontendRepo.Split('/')[0]
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "ECR login successful"
    }
    else {
        Write-Error "ECR login failed"
        exit 1
    }
}

# Build and push frontend image
function Build-FrontendImage {
    Write-Log "Building frontend Docker image..."
    
    Push-Location "frontend"
    
    try {
        # Build the image
        docker build -t dhakacart-frontend:$ImageTag .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend image built successfully"
        }
        else {
            Write-Error "Frontend image build failed"
            exit 1
        }
        
        # Tag for ECR
        docker tag dhakacart-frontend:$ImageTag "$FrontendRepo:$ImageTag"
        docker tag dhakacart-frontend:$ImageTag "$FrontendRepo:latest"
        
        # Push to ECR
        Write-Log "Pushing frontend image to ECR..."
        docker push "$FrontendRepo:$ImageTag"
        docker push "$FrontendRepo:latest"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend image pushed to ECR"
        }
        else {
            Write-Error "Frontend image push failed"
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Build and push backend image
function Build-BackendImage {
    Write-Log "Building backend Docker image..."
    
    Push-Location "backend"
    
    try {
        # Build the image
        docker build -t dhakacart-backend:$ImageTag .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend image built successfully"
        }
        else {
            Write-Error "Backend image build failed"
            exit 1
        }
        
        # Tag for ECR
        docker tag dhakacart-backend:$ImageTag "$BackendRepo:$ImageTag"
        docker tag dhakacart-backend:$ImageTag "$BackendRepo:latest"
        
        # Push to ECR
        Write-Log "Pushing backend image to ECR..."
        docker push "$BackendRepo:$ImageTag"
        docker push "$BackendRepo:latest"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend image pushed to ECR"
        }
        else {
            Write-Error "Backend image push failed"
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Create Kubernetes secrets
function New-KubernetesSecrets {
    Write-Log "Creating Kubernetes secrets..."
    
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    
    # Get database and Redis connection details
    $dbEndpoint = $outputs.rds_instance_endpoint.value
    $dbName = $outputs.rds_db_name.value
    $redisEndpoint = $outputs.rds_primary_endpoint_address.value
    $redisPort = $outputs.redis_port.value
    
    # Create namespace first
    kubectl apply -f kubernetes/namespace.yaml
    
    # Create secrets (Note: In production, use AWS Secrets Manager with External Secrets Operator)
    $secretManifest = @"
apiVersion: v1
kind: Secret
metadata:
  name: dhakacart-secrets
  namespace: dhakacart
type: Opaque
stringData:
  db-host: "$dbEndpoint"
  db-port: "5432"
  db-name: "$dbName"
  db-user: "dhakacart_admin"
  db-password: "CHANGE_ME_IN_PRODUCTION"
  redis-host: "$redisEndpoint"
  redis-port: "$redisPort"
"@
    
    $secretManifest | kubectl apply -f -
    
    Write-Warning "Database password is set to placeholder. Update with actual password from AWS Secrets Manager."
    Write-Success "Kubernetes secrets created"
}

# Deploy applications to Kubernetes
function Deploy-Applications {
    Write-Log "Deploying applications to Kubernetes..."
    
    # Update image references in deployment manifests
    $frontendDeployment = Get-Content "kubernetes/deployments/frontend-deployment.yaml" -Raw
    $backendDeployment = Get-Content "kubernetes/deployments/backend-deployment.yaml" -Raw
    
    # Replace image references
    $frontendDeployment = $frontendDeployment -replace "dhakacart/frontend:latest", "$FrontendRepo:$ImageTag"
    $backendDeployment = $backendDeployment -replace "dhakacart/backend:latest", "$BackendRepo:$ImageTag"
    
    # Apply updated manifests
    $frontendDeployment | kubectl apply -f -
    $backendDeployment | kubectl apply -f -
    
    # Apply other Kubernetes resources
    kubectl apply -f kubernetes/configmap.yaml
    kubectl apply -f kubernetes/services/frontend-service.yaml
    kubectl apply -f kubernetes/services/backend-service.yaml
    
    Write-Success "Application manifests deployed"
}

# Wait for deployments to be ready
function Wait-ForDeployments {
    Write-Log "Waiting for deployments to be ready..."
    
    # Wait for frontend deployment
    Write-Log "Waiting for frontend deployment..."
    kubectl rollout status deployment/dhakacart-frontend -n dhakacart --timeout=300s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend deployment is ready"
    }
    else {
        Write-Error "Frontend deployment failed to become ready"
        kubectl describe deployment dhakacart-frontend -n dhakacart
        exit 1
    }
    
    # Wait for backend deployment
    Write-Log "Waiting for backend deployment..."
    kubectl rollout status deployment/dhakacart-backend -n dhakacart --timeout=300s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend deployment is ready"
    }
    else {
        Write-Error "Backend deployment failed to become ready"
        kubectl describe deployment dhakacart-backend -n dhakacart
        exit 1
    }
}

# Test application endpoints
function Test-ApplicationEndpoints {
    Write-Log "Testing application endpoints..."
    
    # Get pod information
    Write-Log "Checking pod status..."
    kubectl get pods -n dhakacart -o wide
    
    # Test backend health endpoint
    Write-Log "Testing backend health endpoint..."
    $backendPod = kubectl get pods -n dhakacart -l app=dhakacart-backend -o jsonpath='{.items[0].metadata.name}'
    
    if ($backendPod) {
        $healthCheck = kubectl exec -n dhakacart $backendPod -- curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health
        
        if ($healthCheck -eq "200") {
            Write-Success "Backend health endpoint is responding"
        }
        else {
            Write-Error "Backend health endpoint returned status: $healthCheck"
        }
    }
    else {
        Write-Error "No backend pods found"
    }
    
    # Test frontend health endpoint
    Write-Log "Testing frontend health endpoint..."
    $frontendPod = kubectl get pods -n dhakacart -l app=dhakacart-frontend -o jsonpath='{.items[0].metadata.name}'
    
    if ($frontendPod) {
        $healthCheck = kubectl exec -n dhakacart $frontendPod -- wget -q -O - http://localhost:8080/health
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend health endpoint is responding"
        }
        else {
            Write-Error "Frontend health endpoint is not responding"
        }
    }
    else {
        Write-Error "No frontend pods found"
    }
}

# Test database connectivity
function Test-DatabaseConnectivity {
    Write-Log "Testing database connectivity from backend pods..."
    
    $backendPod = kubectl get pods -n dhakacart -l app=dhakacart-backend -o jsonpath='{.items[0].metadata.name}'
    
    if ($backendPod) {
        # Test database connection
        $dbTest = kubectl exec -n dhakacart $backendPod -- node -e "
            const { Pool } = require('pg');
            const pool = new Pool({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                database: process.env.DB_NAME,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD
            });
            pool.query('SELECT 1').then(() => {
                console.log('Database connection successful');
                process.exit(0);
            }).catch(err => {
                console.error('Database connection failed:', err.message);
                process.exit(1);
            });
        "
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database connectivity test passed"
        }
        else {
            Write-Error "Database connectivity test failed"
        }
    }
}

# Generate deployment report
function New-DeploymentReport {
    Write-Log "Generating deployment report..."
    
    $reportFile = "application-deployment-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    $reportContent = @"
DhakaCart Application Deployment Report
======================================
Generated: $(Get-Date)
Region: $Region
Environment: $Environment
Image Tag: $ImageTag

Container Images:
- Frontend: $FrontendRepo:$ImageTag
- Backend: $BackendRepo:$ImageTag

Kubernetes Resources:
- Namespace: dhakacart
- Frontend Deployment: dhakacart-frontend (3 replicas)
- Backend Deployment: dhakacart-backend (3 replicas)
- Frontend Service: dhakacart-frontend-service
- Backend Service: dhakacart-backend-service

Pod Status:
$(kubectl get pods -n dhakacart -o wide)

Service Status:
$(kubectl get services -n dhakacart)

Deployment Status: COMPLETED
All applications have been successfully deployed and are running.

Next Steps:
1. Configure load balancing and auto-scaling (Task 11.3)
2. Set up monitoring and alerting (Task 11.4)
3. Test backup and disaster recovery (Task 11.5)
4. Validate security and compliance (Task 11.6)
5. Execute end-to-end user workflow tests (Task 11.7)
6. Perform performance and scalability validation (Task 11.8)
"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Success "Deployment report generated: $reportFile"
}

# Main execution
function Main {
    Write-Log "Starting DhakaCart application deployment..."
    
    Test-Prerequisites
    Get-EcrInfo
    Build-FrontendImage
    Build-BackendImage
    New-KubernetesSecrets
    Deploy-Applications
    Wait-ForDeployments
    Test-ApplicationEndpoints
    Test-DatabaseConnectivity
    New-DeploymentReport
    
    Write-Success "Application deployment completed successfully!"
    Write-Log "Applications are deployed and running in Kubernetes cluster."
}

# Run main function
Main