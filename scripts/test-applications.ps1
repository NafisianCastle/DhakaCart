# Application Testing Script for DhakaCart
# This script tests deployed applications without rebuilding

param(
    [string]$Namespace = "dhakacart"
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

# Test Kubernetes cluster connectivity
function Test-KubernetesConnectivity {
    Write-Log "Testing Kubernetes cluster connectivity..."
    
    try {
        kubectl cluster-info | Out-Null
        Write-Success "Kubernetes cluster is accessible"
    }
    catch {
        Write-Error "Cannot connect to Kubernetes cluster"
        exit 1
    }
}

# Check namespace exists
function Test-Namespace {
    Write-Log "Checking namespace: $Namespace"
    
    $namespaceExists = kubectl get namespace $Namespace -o name 2>$null
    
    if ($namespaceExists) {
        Write-Success "Namespace $Namespace exists"
    }
    else {
        Write-Error "Namespace $Namespace does not exist"
        Write-Log "Creating namespace..."
        kubectl apply -f kubernetes/namespace.yaml
        Write-Success "Namespace created"
    }
}

# Check deployments status
function Test-Deployments {
    Write-Log "Checking deployment status..."
    
    # Check frontend deployment
    $frontendStatus = kubectl get deployment dhakacart-frontend -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
    $frontendDesired = kubectl get deployment dhakacart-frontend -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null
    
    if ($frontendStatus -and $frontendDesired -and $frontendStatus -eq $frontendDesired) {
        Write-Success "Frontend deployment: $frontendStatus/$frontendDesired replicas ready"
    }
    else {
        Write-Error "Frontend deployment not ready: $frontendStatus/$frontendDesired replicas"
        kubectl describe deployment dhakacart-frontend -n $Namespace
    }
    
    # Check backend deployment
    $backendStatus = kubectl get deployment dhakacart-backend -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
    $backendDesired = kubectl get deployment dhakacart-backend -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null
    
    if ($backendStatus -and $backendDesired -and $backendStatus -eq $backendDesired) {
        Write-Success "Backend deployment: $backendStatus/$backendDesired replicas ready"
    }
    else {
        Write-Error "Backend deployment not ready: $backendStatus/$backendDesired replicas"
        kubectl describe deployment dhakacart-backend -n $Namespace
    }
}

# Check pod health
function Test-PodHealth {
    Write-Log "Checking pod health..."
    
    # Get all pods in namespace
    $pods = kubectl get pods -n $Namespace -o json | ConvertFrom-Json
    
    foreach ($pod in $pods.items) {
        $podName = $pod.metadata.name
        $podStatus = $pod.status.phase
        
        if ($podStatus -eq "Running") {
            Write-Success "Pod $podName is running"
            
            # Check container readiness
            foreach ($container in $pod.status.containerStatuses) {
                if ($container.ready) {
                    Write-Success "  Container $($container.name) is ready"
                }
                else {
                    Write-Warning "  Container $($container.name) is not ready"
                }
            }
        }
        else {
            Write-Error "Pod $podName status: $podStatus"
        }
    }
}

# Test service endpoints
function Test-ServiceEndpoints {
    Write-Log "Testing service endpoints..."
    
    # Test backend service
    $backendService = kubectl get service dhakacart-backend-service -n $Namespace -o jsonpath='{.spec.clusterIP}' 2>$null
    
    if ($backendService) {
        Write-Success "Backend service ClusterIP: $backendService"
        
        # Test health endpoint from within cluster
        $testPod = kubectl run test-pod --image=curlimages/curl:latest --rm -i --restart=Never -n $Namespace -- curl -s -o /dev/null -w "%{http_code}" "http://dhakacart-backend-service:5000/health"
        
        if ($testPod -eq "200") {
            Write-Success "Backend health endpoint responding"
        }
        else {
            Write-Warning "Backend health endpoint returned: $testPod"
        }
    }
    else {
        Write-Error "Backend service not found"
    }
    
    # Test frontend service
    $frontendService = kubectl get service dhakacart-frontend-service -n $Namespace -o jsonpath='{.spec.clusterIP}' 2>$null
    
    if ($frontendService) {
        Write-Success "Frontend service ClusterIP: $frontendService"
    }
    else {
        Write-Error "Frontend service not found"
    }
}

# Test resource limits and requests
function Test-ResourceConfiguration {
    Write-Log "Checking resource configuration..."
    
    # Check backend resources
    $backendResources = kubectl get deployment dhakacart-backend -n $Namespace -o jsonpath='{.spec.template.spec.containers[0].resources}'
    
    if ($backendResources) {
        Write-Success "Backend resource limits configured"
    }
    else {
        Write-Warning "Backend resource limits not configured"
    }
    
    # Check frontend resources
    $frontendResources = kubectl get deployment dhakacart-frontend -n $Namespace -o jsonpath='{.spec.template.spec.containers[0].resources}'
    
    if ($frontendResources) {
        Write-Success "Frontend resource limits configured"
    }
    else {
        Write-Warning "Frontend resource limits not configured"
    }
}

# Test secrets and config
function Test-SecretsAndConfig {
    Write-Log "Checking secrets and configuration..."
    
    # Check secrets
    $secrets = kubectl get secret dhakacart-secrets -n $Namespace -o name 2>$null
    
    if ($secrets) {
        Write-Success "Application secrets exist"
    }
    else {
        Write-Error "Application secrets not found"
    }
    
    # Check configmap
    $configmap = kubectl get configmap dhakacart-config -n $Namespace -o name 2>$null
    
    if ($configmap) {
        Write-Success "Application configmap exists"
    }
    else {
        Write-Error "Application configmap not found"
    }
}

# Generate test report
function New-TestReport {
    Write-Log "Generating test report..."
    
    $reportFile = "application-test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    $reportContent = @"
DhakaCart Application Test Report
=================================
Generated: $(Get-Date)
Namespace: $Namespace

Pod Status:
$(kubectl get pods -n $Namespace -o wide)

Service Status:
$(kubectl get services -n $Namespace)

Deployment Status:
$(kubectl get deployments -n $Namespace)

Resource Usage:
$(kubectl top pods -n $Namespace 2>$null)

Test Status: COMPLETED
All application tests have been executed.

Issues Found:
- Check the log output above for any warnings or errors
- Verify database connectivity if backend health checks fail
- Ensure secrets are properly configured with actual credentials

Next Steps:
1. Configure ingress and load balancing (Task 11.3)
2. Set up monitoring and alerting (Task 11.4)
3. Validate end-to-end user workflows (Task 11.7)
"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Success "Test report generated: $reportFile"
}

# Main execution
function Main {
    Write-Log "Starting DhakaCart application testing..."
    
    Test-KubernetesConnectivity
    Test-Namespace
    Test-Deployments
    Test-PodHealth
    Test-ServiceEndpoints
    Test-ResourceConfiguration
    Test-SecretsAndConfig
    New-TestReport
    
    Write-Success "Application testing completed!"
    Write-Log "Review the test report for detailed results."
}

# Run main function
Main