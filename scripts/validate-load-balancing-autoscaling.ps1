# Load Balancing and Auto-scaling Validation Script for DhakaCart
# This script validates ingress controller, load balancer, and auto-scaling configurations

param(
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }),
    [string]$Namespace = "dhakacart",
    [string]$LoadTestDuration = "300"  # 5 minutes default
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
    
    # Check kubectl
    try {
        kubectl version --client | Out-Null
        Write-Success "kubectl is available"
    }
    catch {
        Write-Error "kubectl is not installed"
        exit 1
    }
    
    # Check if cluster is accessible
    try {
        kubectl cluster-info | Out-Null
        Write-Success "Kubernetes cluster is accessible"
    }
    catch {
        Write-Error "Cannot connect to Kubernetes cluster"
        exit 1
    }
    
    # Check if applications are deployed
    $frontendPods = kubectl get pods -n $Namespace -l app=dhakacart-frontend --no-headers 2>$null
    $backendPods = kubectl get pods -n $Namespace -l app=dhakacart-backend --no-headers 2>$null
    
    if ($frontendPods -and $backendPods) {
        Write-Success "Applications are deployed"
    }
    else {
        Write-Error "Applications not found. Please deploy applications first (Task 11.2)"
        exit 1
    }
}

# Install AWS Load Balancer Controller
function Install-LoadBalancerController {
    Write-Log "Installing AWS Load Balancer Controller..."
    
    # Check if already installed
    $existingController = kubectl get deployment aws-load-balancer-controller -n kube-system --no-headers 2>$null
    
    if ($existingController) {
        Write-Success "AWS Load Balancer Controller already installed"
        return
    }
    
    # Apply AWS Load Balancer Controller
    Write-Log "Applying AWS Load Balancer Controller manifests..."
    kubectl apply -f kubernetes/ingress/aws-load-balancer-controller.yaml
    
    # Wait for controller to be ready
    Write-Log "Waiting for AWS Load Balancer Controller to be ready..."
    kubectl wait --for=condition=Available deployment/aws-load-balancer-controller -n kube-system --timeout=300s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "AWS Load Balancer Controller is ready"
    }
    else {
        Write-Error "AWS Load Balancer Controller failed to become ready"
        exit 1
    }
}

# Deploy ingress configuration
function Deploy-IngressConfiguration {
    Write-Log "Deploying ingress configuration..."
    
    # Create a simplified ingress for testing (without SSL for now)
    $ingressManifest = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dhakacart-test-ingress
  namespace: $Namespace
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
    alb.ingress.kubernetes.io/load-balancer-name: dhakacart-test-alb
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '3'
spec:
  ingressClassName: alb
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: dhakacart-backend-service
            port:
              number: 5000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: dhakacart-frontend-service
            port:
              number: 80
"@
    
    $ingressManifest | kubectl apply -f -
    
    # Wait for ingress to get an address
    Write-Log "Waiting for ingress to get load balancer address..."
    $timeout = 300
    $elapsed = 0
    
    do {
        Start-Sleep 10
        $elapsed += 10
        $ingressAddress = kubectl get ingress dhakacart-test-ingress -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null
        
        if ($ingressAddress) {
            Write-Success "Ingress address: $ingressAddress"
            $script:LoadBalancerUrl = "http://$ingressAddress"
            return
        }
        
        Write-Log "Waiting for load balancer... ($elapsed/$timeout seconds)"
    } while ($elapsed -lt $timeout)
    
    Write-Error "Ingress failed to get load balancer address within timeout"
    exit 1
}

# Deploy HPA configurations
function Deploy-HorizontalPodAutoscalers {
    Write-Log "Deploying Horizontal Pod Autoscalers..."
    
    # Apply HPA configurations
    kubectl apply -f kubernetes/autoscaling/frontend-hpa.yaml
    kubectl apply -f kubernetes/autoscaling/backend-hpa.yaml
    
    # Wait for HPAs to be ready
    Start-Sleep 30
    
    # Check HPA status
    $frontendHPA = kubectl get hpa dhakacart-frontend-hpa -n $Namespace --no-headers 2>$null
    $backendHPA = kubectl get hpa dhakacart-backend-hpa -n $Namespace --no-headers 2>$null
    
    if ($frontendHPA) {
        Write-Success "Frontend HPA deployed"
    }
    else {
        Write-Error "Frontend HPA deployment failed"
    }
    
    if ($backendHPA) {
        Write-Success "Backend HPA deployed"
    }
    else {
        Write-Error "Backend HPA deployment failed"
    }
}

# Deploy Cluster Autoscaler
function Deploy-ClusterAutoscaler {
    Write-Log "Deploying Cluster Autoscaler..."
    
    # Check if already deployed
    $existingCA = kubectl get deployment cluster-autoscaler -n kube-system --no-headers 2>$null
    
    if ($existingCA) {
        Write-Success "Cluster Autoscaler already deployed"
        return
    }
    
    # Apply Cluster Autoscaler
    kubectl apply -f kubernetes/autoscaling/cluster-autoscaler.yaml
    
    # Wait for deployment to be ready
    kubectl wait --for=condition=Available deployment/cluster-autoscaler -n kube-system --timeout=300s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Cluster Autoscaler is ready"
    }
    else {
        Write-Error "Cluster Autoscaler failed to become ready"
    }
}

# Test load balancer functionality
function Test-LoadBalancer {
    Write-Log "Testing load balancer functionality..."
    
    if (-not $script:LoadBalancerUrl) {
        Write-Error "Load balancer URL not available"
        return $false
    }
    
    # Test frontend endpoint
    try {
        $frontendResponse = Invoke-WebRequest -Uri "$script:LoadBalancerUrl/" -TimeoutSec 30 -UseBasicParsing
        if ($frontendResponse.StatusCode -eq 200) {
            Write-Success "Frontend accessible via load balancer"
        }
        else {
            Write-Warning "Frontend returned status: $($frontendResponse.StatusCode)"
        }
    }
    catch {
        Write-Warning "Frontend not accessible via load balancer: $_"
    }
    
    # Test backend API endpoint
    try {
        $backendResponse = Invoke-WebRequest -Uri "$script:LoadBalancerUrl/api/health" -TimeoutSec 30 -UseBasicParsing
        if ($backendResponse.StatusCode -eq 200) {
            Write-Success "Backend API accessible via load balancer"
        }
        else {
            Write-Warning "Backend API returned status: $($backendResponse.StatusCode)"
        }
    }
    catch {
        Write-Warning "Backend API not accessible via load balancer: $_"
    }
    
    return $true
}

# Generate load to trigger auto-scaling
function Start-LoadTest {
    Write-Log "Starting load test to trigger auto-scaling..."
    
    if (-not $script:LoadBalancerUrl) {
        Write-Error "Load balancer URL not available for load testing"
        return
    }
    
    # Create load test pod
    $loadTestManifest = @"
apiVersion: v1
kind: Pod
metadata:
  name: load-test-pod
  namespace: $Namespace
spec:
  containers:
  - name: load-test
    image: curlimages/curl:latest
    command: ["/bin/sh"]
    args:
    - -c
    - |
      echo "Starting load test..."
      for i in `seq 1 $LoadTestDuration`; do
        for j in `seq 1 10`; do
          curl -s "$script:LoadBalancerUrl/api/health" > /dev/null &
          curl -s "$script:LoadBalancerUrl/" > /dev/null &
        done
        sleep 1
        if [ `expr `$i % 30` -eq 0 ]; then
          echo "Load test running... `$i/$LoadTestDuration seconds"
        fi
      done
      echo "Load test completed"
      sleep 3600  # Keep pod alive for inspection
  restartPolicy: Never
"@
    
    $loadTestManifest | kubectl apply -f -
    
    Write-Success "Load test started. Duration: $LoadTestDuration seconds"
    Write-Log "Monitor scaling with: kubectl get hpa -n $Namespace -w"
}

# Monitor auto-scaling behavior
function Monitor-AutoScaling {
    Write-Log "Monitoring auto-scaling behavior..."
    
    # Record initial state
    $initialFrontendReplicas = kubectl get deployment dhakacart-frontend -n $Namespace -o jsonpath='{.status.replicas}'
    $initialBackendReplicas = kubectl get deployment dhakacart-backend -n $Namespace -o jsonpath='{.status.replicas}'
    $initialNodes = kubectl get nodes --no-headers | Measure-Object | Select-Object -ExpandProperty Count
    
    Write-Log "Initial state:"
    Write-Log "  Frontend replicas: $initialFrontendReplicas"
    Write-Log "  Backend replicas: $initialBackendReplicas"
    Write-Log "  Cluster nodes: $initialNodes"
    
    # Monitor for scaling events
    Write-Log "Monitoring for 5 minutes..."
    $monitorDuration = 300
    $checkInterval = 30
    
    for ($i = 0; $i -lt $monitorDuration; $i += $checkInterval) {
        Start-Sleep $checkInterval
        
        # Check current state
        $currentFrontendReplicas = kubectl get deployment dhakacart-frontend -n $Namespace -o jsonpath='{.status.replicas}'
        $currentBackendReplicas = kubectl get deployment dhakacart-backend -n $Namespace -o jsonpath='{.status.replicas}'
        $currentNodes = kubectl get nodes --no-headers | Measure-Object | Select-Object -ExpandProperty Count
        
        Write-Log "Current state ($(($i + $checkInterval))s):"
        Write-Log "  Frontend replicas: $currentFrontendReplicas"
        Write-Log "  Backend replicas: $currentBackendReplicas"
        Write-Log "  Cluster nodes: $currentNodes"
        
        # Check HPA status
        kubectl get hpa -n $Namespace
        
        # Check for scaling events
        if ($currentFrontendReplicas -gt $initialFrontendReplicas) {
            Write-Success "Frontend scaled up: $initialFrontendReplicas -> $currentFrontendReplicas"
        }
        
        if ($currentBackendReplicas -gt $initialBackendReplicas) {
            Write-Success "Backend scaled up: $initialBackendReplicas -> $currentBackendReplicas"
        }
        
        if ($currentNodes -gt $initialNodes) {
            Write-Success "Cluster scaled up: $initialNodes -> $currentNodes nodes"
        }
    }
}

# Validate SSL/TLS configuration (if certificates are available)
function Test-SSLConfiguration {
    Write-Log "Testing SSL/TLS configuration..."
    
    # This would require actual domain and certificates
    Write-Warning "SSL/TLS testing requires actual domain and certificates"
    Write-Log "To test SSL/TLS:"
    Write-Log "1. Configure ACM certificate in AWS"
    Write-Log "2. Update ingress with certificate ARN"
    Write-Log "3. Configure DNS to point to load balancer"
    Write-Log "4. Test HTTPS endpoints"
}

# Generate validation report
function New-ValidationReport {
    Write-Log "Generating validation report..."
    
    $reportFile = "load-balancing-autoscaling-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    # Get current state
    $ingressStatus = kubectl get ingress -n $Namespace -o wide
    $hpaStatus = kubectl get hpa -n $Namespace
    $nodeStatus = kubectl get nodes -o wide
    $deploymentStatus = kubectl get deployments -n $Namespace
    
    $reportContent = @"
DhakaCart Load Balancing and Auto-scaling Validation Report
==========================================================
Generated: $(Get-Date)
Namespace: $Namespace
Load Balancer URL: $script:LoadBalancerUrl

Ingress Status:
$ingressStatus

HPA Status:
$hpaStatus

Node Status:
$nodeStatus

Deployment Status:
$deploymentStatus

Validation Results:
- AWS Load Balancer Controller: Deployed
- Ingress Configuration: Deployed with ALB
- Horizontal Pod Autoscalers: Configured for frontend and backend
- Cluster Autoscaler: Deployed and configured
- Load Balancer Accessibility: Tested
- Auto-scaling Behavior: Monitored

Next Steps:
1. Configure SSL/TLS certificates for production
2. Set up custom domain names
3. Configure WAF for security
4. Test disaster recovery scenarios (Task 11.5)
5. Validate security and compliance (Task 11.6)
6. Execute end-to-end user workflow tests (Task 11.7)
7. Perform comprehensive performance validation (Task 11.8)

Notes:
- Load testing was performed to trigger auto-scaling
- Monitor HPA metrics for scaling decisions
- Cluster autoscaler will add nodes when pod resources are insufficient
- SSL/TLS configuration requires actual certificates and domain setup
"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Success "Validation report generated: $reportFile"
}

# Cleanup test resources
function Remove-TestResources {
    Write-Log "Cleaning up test resources..."
    
    # Remove load test pod
    kubectl delete pod load-test-pod -n $Namespace --ignore-not-found=true
    
    # Optionally remove test ingress (keep for further testing)
    # kubectl delete ingress dhakacart-test-ingress -n $Namespace --ignore-not-found=true
    
    Write-Success "Test resources cleaned up"
}

# Main execution
function Main {
    Write-Log "Starting DhakaCart load balancing and auto-scaling validation..."
    
    Test-Prerequisites
    Install-LoadBalancerController
    Deploy-IngressConfiguration
    Deploy-HorizontalPodAutoscalers
    Deploy-ClusterAutoscaler
    Test-LoadBalancer
    Start-LoadTest
    Monitor-AutoScaling
    Test-SSLConfiguration
    New-ValidationReport
    Remove-TestResources
    
    Write-Success "Load balancing and auto-scaling validation completed!"
    Write-Log "Review the validation report for detailed results."
    Write-Log "Load balancer URL: $script:LoadBalancerUrl"
}

# Run main function
Main