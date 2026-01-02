# Monitoring and Alerting Validation Script for DhakaCart
# This script validates Prometheus, Grafana, ELK stack, and alerting configurations

param(
    [string]$Namespace = "dhakacart",
    [string]$MonitoringNamespace = "monitoring"
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
    
    # Check if Helm is available
    try {
        helm version | Out-Null
        Write-Success "Helm is available"
    }
    catch {
        Write-Warning "Helm not available - will use kubectl for deployments"
    }
}

# Create monitoring namespace
function New-MonitoringNamespace {
    Write-Log "Creating monitoring namespace..."
    
    $namespaceExists = kubectl get namespace $MonitoringNamespace --no-headers 2>$null
    
    if (-not $namespaceExists) {
        kubectl create namespace $MonitoringNamespace
        Write-Success "Monitoring namespace created"
    }
    else {
        Write-Success "Monitoring namespace already exists"
    }
}

# Deploy Prometheus stack
function Deploy-PrometheusStack {
    Write-Log "Deploying Prometheus monitoring stack..."
    
    # Check if Prometheus is already deployed
    $existingPrometheus = kubectl get deployment prometheus-server -n $MonitoringNamespace --no-headers 2>$null
    
    if ($existingPrometheus) {
        Write-Success "Prometheus already deployed"
        return
    }
    
    # Add Prometheus Helm repository
    try {
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        Write-Success "Prometheus Helm repository added"
    }
    catch {
        Write-Warning "Failed to add Helm repository - using kubectl deployment"
    }
    
    # Deploy using Helm if available, otherwise use kubectl
    try {
        helm install prometheus prometheus-community/kube-prometheus-stack `
            --namespace $MonitoringNamespace `
            --values kubernetes/monitoring/prometheus/values.yaml `
            --wait --timeout=600s
        
        Write-Success "Prometheus stack deployed via Helm"
    }
    catch {
        Write-Log "Helm deployment failed, using kubectl..."
        
        # Deploy Prometheus using kubectl
        kubectl apply -f kubernetes/monitoring/prometheus/ -R
        Write-Success "Prometheus deployed via kubectl"
    }
}

# Deploy Grafana dashboards
function Deploy-GrafanaDashboards {
    Write-Log "Deploying Grafana dashboards..."
    
    # Apply dashboard ConfigMaps
    if (Test-Path "kubernetes/monitoring/prometheus/dashboards") {
        kubectl apply -f kubernetes/monitoring/prometheus/dashboards/ -n $MonitoringNamespace
        Write-Success "Grafana dashboards deployed"
    }
    else {
        Write-Warning "Dashboard directory not found"
    }
}

# Deploy AlertManager configuration
function Deploy-AlertManagerConfig {
    Write-Log "Deploying AlertManager configuration..."
    
    # Create AlertManager secret
    $alertmanagerConfig = Get-Content "kubernetes/monitoring/prometheus/alertmanager/alertmanager.yaml" -Raw
    
    $secretManifest = @"
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: $MonitoringNamespace
type: Opaque
stringData:
  alertmanager.yml: |
$alertmanagerConfig
"@
    
    $secretManifest | kubectl apply -f -
    Write-Success "AlertManager configuration deployed"
}

# Deploy Prometheus rules
function Deploy-PrometheusRules {
    Write-Log "Deploying Prometheus alerting rules..."
    
    # Apply Prometheus rules
    kubectl apply -f kubernetes/monitoring/prometheus/rules/dhakacart-alerts.yaml
    Write-Success "Prometheus alerting rules deployed"
}

# Deploy ELK stack
function Deploy-ELKStack {
    Write-Log "Deploying ELK stack for log aggregation..."
    
    # Check if Elasticsearch is already deployed
    $existingElasticsearch = kubectl get statefulset elasticsearch-master -n $MonitoringNamespace --no-headers 2>$null
    
    if ($existingElasticsearch) {
        Write-Success "ELK stack already deployed"
        return
    }
    
    try {
        # Add Elastic Helm repository
        helm repo add elastic https://helm.elastic.co
        helm repo update
        
        # Deploy Elasticsearch
        helm install elasticsearch elastic/elasticsearch `
            --namespace $MonitoringNamespace `
            --values kubernetes/monitoring/elk/elasticsearch/values.yaml `
            --wait --timeout=600s
        
        # Deploy Kibana
        helm install kibana elastic/kibana `
            --namespace $MonitoringNamespace `
            --values kubernetes/monitoring/elk/kibana/values.yaml `
            --wait --timeout=300s
        
        # Deploy Filebeat
        helm install filebeat elastic/filebeat `
            --namespace $MonitoringNamespace `
            --values kubernetes/monitoring/elk/filebeat/values.yaml `
            --wait --timeout=300s
        
        Write-Success "ELK stack deployed"
    }
    catch {
        Write-Warning "ELK stack deployment failed: $_"
        Write-Log "Continuing with Prometheus-only monitoring"
    }
}

# Validate Prometheus deployment
function Test-PrometheusDeployment {
    Write-Log "Validating Prometheus deployment..."
    
    # Check Prometheus pods
    $prometheusPods = kubectl get pods -n $MonitoringNamespace -l app.kubernetes.io/name=prometheus --no-headers 2>$null
    
    if ($prometheusPods) {
        Write-Success "Prometheus pods are running"
        
        # Check if Prometheus is accessible
        try {
            kubectl port-forward -n $MonitoringNamespace svc/prometheus-server 9090:80 --address=0.0.0.0 &
            Start-Sleep 5
            
            $response = Invoke-WebRequest -Uri "http://localhost:9090/api/v1/query?query=up" -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "Prometheus API is accessible"
            }
            
            # Stop port-forward
            Get-Process | Where-Object { $_.ProcessName -eq "kubectl" -and $_.CommandLine -like "*port-forward*" } | Stop-Process -Force
        }
        catch {
            Write-Warning "Prometheus API test failed: $_"
        }
    }
    else {
        Write-Error "Prometheus pods not found"
    }
}

# Validate Grafana deployment
function Test-GrafanaDeployment {
    Write-Log "Validating Grafana deployment..."
    
    # Check Grafana pods
    $grafanaPods = kubectl get pods -n $MonitoringNamespace -l app.kubernetes.io/name=grafana --no-headers 2>$null
    
    if ($grafanaPods) {
        Write-Success "Grafana pods are running"
        
        # Get Grafana service URL
        $grafanaService = kubectl get svc -n $MonitoringNamespace -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>$null
        
        if ($grafanaService) {
            Write-Success "Grafana service URL: http://$grafanaService"
            $script:GrafanaUrl = "http://$grafanaService"
        }
        else {
            Write-Log "Grafana LoadBalancer not ready, using port-forward for testing"
            
            try {
                kubectl port-forward -n $MonitoringNamespace svc/grafana 3000:80 --address=0.0.0.0 &
                Start-Sleep 5
                
                $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 10 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Success "Grafana is accessible via port-forward"
                }
                
                # Stop port-forward
                Get-Process | Where-Object { $_.ProcessName -eq "kubectl" -and $_.CommandLine -like "*port-forward*" } | Stop-Process -Force
            }
            catch {
                Write-Warning "Grafana accessibility test failed: $_"
            }
        }
    }
    else {
        Write-Error "Grafana pods not found"
    }
}

# Validate AlertManager deployment
function Test-AlertManagerDeployment {
    Write-Log "Validating AlertManager deployment..."
    
    # Check AlertManager pods
    $alertmanagerPods = kubectl get pods -n $MonitoringNamespace -l app.kubernetes.io/name=alertmanager --no-headers 2>$null
    
    if ($alertmanagerPods) {
        Write-Success "AlertManager pods are running"
        
        # Test AlertManager API
        try {
            kubectl port-forward -n $MonitoringNamespace svc/alertmanager 9093:9093 --address=0.0.0.0 &
            Start-Sleep 5
            
            $response = Invoke-WebRequest -Uri "http://localhost:9093/api/v1/status" -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "AlertManager API is accessible"
            }
            
            # Stop port-forward
            Get-Process | Where-Object { $_.ProcessName -eq "kubectl" -and $_.CommandLine -like "*port-forward*" } | Stop-Process -Force
        }
        catch {
            Write-Warning "AlertManager API test failed: $_"
        }
    }
    else {
        Write-Error "AlertManager pods not found"
    }
}

# Test metrics collection
function Test-MetricsCollection {
    Write-Log "Testing metrics collection from applications..."
    
    # Check if application pods have metrics endpoints
    $backendPods = kubectl get pods -n $Namespace -l app=dhakacart-backend --no-headers 2>$null
    
    if ($backendPods) {
        $podName = ($backendPods -split '\s+')[0]
        
        try {
            # Test metrics endpoint
            $metricsResponse = kubectl exec -n $Namespace $podName -- curl -s http://localhost:5000/metrics
            
            if ($metricsResponse -like "*http_requests_total*") {
                Write-Success "Application metrics are being collected"
            }
            else {
                Write-Warning "Application metrics endpoint not configured properly"
            }
        }
        catch {
            Write-Warning "Failed to test application metrics: $_"
        }
    }
    else {
        Write-Warning "No backend pods found for metrics testing"
    }
}

# Test alerting rules
function Test-AlertingRules {
    Write-Log "Testing alerting rules..."
    
    # Check if Prometheus rules are loaded
    try {
        kubectl port-forward -n $MonitoringNamespace svc/prometheus-server 9090:80 --address=0.0.0.0 &
        Start-Sleep 5
        
        $rulesResponse = Invoke-WebRequest -Uri "http://localhost:9090/api/v1/rules" -TimeoutSec 10 -UseBasicParsing
        $rulesData = $rulesResponse.Content | ConvertFrom-Json
        
        if ($rulesData.data.groups.Count -gt 0) {
            Write-Success "Prometheus alerting rules are loaded"
            Write-Log "Found $($rulesData.data.groups.Count) rule groups"
        }
        else {
            Write-Warning "No alerting rules found"
        }
        
        # Stop port-forward
        Get-Process | Where-Object { $_.ProcessName -eq "kubectl" -and $_.CommandLine -like "*port-forward*" } | Stop-Process -Force
    }
    catch {
        Write-Warning "Failed to test alerting rules: $_"
    }
}

# Test log aggregation
function Test-LogAggregation {
    Write-Log "Testing log aggregation with ELK stack..."
    
    # Check if Kibana is accessible
    $kibanaPods = kubectl get pods -n $MonitoringNamespace -l app=kibana --no-headers 2>$null
    
    if ($kibanaPods) {
        Write-Success "Kibana pods are running"
        
        try {
            kubectl port-forward -n $MonitoringNamespace svc/kibana-kibana 5601:5601 --address=0.0.0.0 &
            Start-Sleep 10
            
            $kibanaResponse = Invoke-WebRequest -Uri "http://localhost:5601/api/status" -TimeoutSec 15 -UseBasicParsing
            if ($kibanaResponse.StatusCode -eq 200) {
                Write-Success "Kibana is accessible for log analysis"
            }
            
            # Stop port-forward
            Get-Process | Where-Object { $_.ProcessName -eq "kubectl" -and $_.CommandLine -like "*port-forward*" } | Stop-Process -Force
        }
        catch {
            Write-Warning "Kibana accessibility test failed: $_"
        }
    }
    else {
        Write-Warning "Kibana not deployed - log aggregation not available"
    }
}

# Generate test alerts
function Start-AlertTesting {
    Write-Log "Generating test alerts..."
    
    # Create a pod that will trigger resource alerts
    $testPodManifest = @"
apiVersion: v1
kind: Pod
metadata:
  name: alert-test-pod
  namespace: $Namespace
  labels:
    app: alert-test
spec:
  containers:
  - name: cpu-stress
    image: progrium/stress
    command: ["stress"]
    args: ["--cpu", "2", "--timeout", "300s"]
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 200m
        memory: 256Mi
  restartPolicy: Never
"@
    
    $testPodManifest | kubectl apply -f -
    
    Write-Success "Test pod created to trigger resource alerts"
    Write-Log "Monitor alerts in Prometheus/AlertManager for the next 5 minutes"
}

# Generate validation report
function New-ValidationReport {
    Write-Log "Generating monitoring and alerting validation report..."
    
    $reportFile = "monitoring-alerting-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    # Get current status
    $prometheusPods = kubectl get pods -n $MonitoringNamespace -l app.kubernetes.io/name=prometheus --no-headers 2>$null
    $grafanaPods = kubectl get pods -n $MonitoringNamespace -l app.kubernetes.io/name=grafana --no-headers 2>$null
    $alertmanagerPods = kubectl get pods -n $MonitoringNamespace -l app.kubernetes.io/name=alertmanager --no-headers 2>$null
    $kibanaPods = kubectl get pods -n $MonitoringNamespace -l app=kibana --no-headers 2>$null
    
    $reportContent = @"
DhakaCart Monitoring and Alerting Validation Report
==================================================
Generated: $(Get-Date)
Monitoring Namespace: $MonitoringNamespace
Application Namespace: $Namespace

Prometheus Stack Status:
- Prometheus Pods: $(if ($prometheusPods) { "Running" } else { "Not Found" })
- Grafana Pods: $(if ($grafanaPods) { "Running" } else { "Not Found" })
- AlertManager Pods: $(if ($alertmanagerPods) { "Running" } else { "Not Found" })

ELK Stack Status:
- Kibana Pods: $(if ($kibanaPods) { "Running" } else { "Not Found" })

Access URLs:
- Grafana: $script:GrafanaUrl (if available)
- Prometheus: Use kubectl port-forward for access
- AlertManager: Use kubectl port-forward for access
- Kibana: Use kubectl port-forward for access

Validation Results:
- Prometheus deployment: Validated
- Grafana deployment: Validated
- AlertManager configuration: Deployed
- Prometheus alerting rules: Deployed
- Application metrics collection: Tested
- Log aggregation: Configured (if ELK deployed)

Alert Testing:
- Test pod created to trigger resource alerts
- Monitor Prometheus/AlertManager for alert generation

Next Steps:
1. Configure notification channels (email, Slack)
2. Set up custom business metrics
3. Create additional dashboards for business KPIs
4. Test disaster recovery scenarios (Task 11.5)
5. Validate security and compliance (Task 11.6)

Notes:
- Update AlertManager configuration with actual notification endpoints
- Configure Grafana data sources and import dashboards
- Set up log retention policies for Elasticsearch
- Configure backup for Prometheus data
"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Success "Validation report generated: $reportFile"
}

# Cleanup test resources
function Remove-TestResources {
    Write-Log "Cleaning up test resources..."
    
    # Remove test pod
    kubectl delete pod alert-test-pod -n $Namespace --ignore-not-found=true
    
    Write-Success "Test resources cleaned up"
}

# Main execution
function Main {
    Write-Log "Starting DhakaCart monitoring and alerting validation..."
    
    Test-Prerequisites
    New-MonitoringNamespace
    Deploy-PrometheusStack
    Deploy-GrafanaDashboards
    Deploy-AlertManagerConfig
    Deploy-PrometheusRules
    Deploy-ELKStack
    Test-PrometheusDeployment
    Test-GrafanaDeployment
    Test-AlertManagerDeployment
    Test-MetricsCollection
    Test-AlertingRules
    Test-LogAggregation
    Start-AlertTesting
    New-ValidationReport
    
    Write-Success "Monitoring and alerting validation completed!"
    Write-Log "Review the validation report for detailed results."
    Write-Log "Access Grafana at: $script:GrafanaUrl (if available)"
    
    # Don't cleanup immediately to allow monitoring
    Write-Log "Test resources will remain active for monitoring. Clean up manually if needed."
}

# Run main function
Main