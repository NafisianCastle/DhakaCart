# Deploy ELK Stack for DhakaCart
# This script installs Elasticsearch, Logstash, Kibana, and Filebeat using Helm

param(
    [switch]$DryRun = $false
)

Write-Host "🚀 Deploying ELK Stack for DhakaCart..." -ForegroundColor Green

# Check if Helm is installed
try {
    helm version | Out-Null
} catch {
    Write-Host "❌ Helm is not installed. Please install Helm first." -ForegroundColor Red
    exit 1
}

# Check if kubectl is configured
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Host "❌ kubectl is not configured or cluster is not accessible." -ForegroundColor Red
    exit 1
}

if ($DryRun) {
    Write-Host "🔍 Running in dry-run mode..." -ForegroundColor Yellow
}

# Create logging namespace
Write-Host "📦 Creating logging namespace..." -ForegroundColor Cyan
if ($DryRun) {
    kubectl create namespace logging --dry-run=client -o yaml
} else {
    kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -
}

# Create dhakacart namespace if it doesn't exist
Write-Host "📦 Creating dhakacart namespace..." -ForegroundColor Cyan
if ($DryRun) {
    kubectl create namespace dhakacart --dry-run=client -o yaml
} else {
    kubectl create namespace dhakacart --dry-run=client -o yaml | kubectl apply -f -
}

# Add Elastic Helm repository
Write-Host "📚 Adding Elastic Helm repository..." -ForegroundColor Cyan
if (-not $DryRun) {
    helm repo add elastic https://helm.elastic.co
    helm repo update
}

# Deploy Elasticsearch
Write-Host "🔍 Deploying Elasticsearch..." -ForegroundColor Cyan
$elasticsearchArgs = @(
    "upgrade", "--install", "elasticsearch", "elastic/elasticsearch",
    "--namespace", "logging",
    "--values", "elasticsearch/values.yaml",
    "--wait",
    "--timeout", "15m"
)

if ($DryRun) {
    $elasticsearchArgs += "--dry-run"
}

& helm $elasticsearchArgs

if (-not $DryRun) {
    # Wait for Elasticsearch to be ready
    Write-Host "⏳ Waiting for Elasticsearch to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=elasticsearch-master --namespace logging --timeout=600s

    # Deploy Logstash
    Write-Host "📊 Deploying Logstash..." -ForegroundColor Cyan
    helm upgrade --install logstash elastic/logstash `
        --namespace logging `
        --values logstash/values.yaml `
        --wait `
        --timeout 10m

    # Wait for Logstash to be ready
    Write-Host "⏳ Waiting for Logstash to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=logstash --namespace logging --timeout=300s

    # Deploy Kibana
    Write-Host "📈 Deploying Kibana..." -ForegroundColor Cyan
    helm upgrade --install kibana elastic/kibana `
        --namespace logging `
        --values kibana/values.yaml `
        --wait `
        --timeout 10m

    # Wait for Kibana to be ready
    Write-Host "⏳ Waiting for Kibana to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=kibana --namespace logging --timeout=300s

    # Deploy Filebeat
    Write-Host "📋 Deploying Filebeat..." -ForegroundColor Cyan
    helm upgrade --install filebeat elastic/filebeat `
        --namespace logging `
        --values filebeat/values.yaml `
        --wait `
        --timeout 10m

    # Wait for Filebeat DaemonSet to be ready
    Write-Host "⏳ Waiting for Filebeat to be ready..." -ForegroundColor Yellow
    kubectl rollout status daemonset/filebeat-filebeat --namespace logging --timeout=300s

    # Create Elasticsearch index lifecycle policy
    Write-Host "🔄 Creating index lifecycle policy..." -ForegroundColor Cyan
    $ilmPolicy = @'
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "5GB",
            "max_age": "7d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "allocate": {
            "number_of_replicas": 0
          }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "allocate": {
            "number_of_replicas": 0
          }
        }
      },
      "delete": {
        "min_age": "90d"
      }
    }
  }
}
'@

    kubectl exec -n logging deployment/elasticsearch-master -- curl -X PUT "localhost:9200/_ilm/policy/dhakacart-policy" -H 'Content-Type: application/json' -d $ilmPolicy

    # Import Kibana dashboards
    Write-Host "📊 Importing Kibana dashboards..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30  # Wait for Kibana to fully initialize

    # Get Kibana pod name
    $kibanaPod = kubectl get pods -n logging -l app=kibana -o jsonpath='{.items[0].metadata.name}'

    # Copy dashboard file to Kibana pod
    kubectl cp kibana/dashboards/dhakacart-logs-dashboard.json logging/$kibanaPod`:/tmp/dashboard.json

    # Import dashboard
    kubectl exec -n logging $kibanaPod -- curl -X POST "localhost:5601/api/saved_objects/_import" `
        -H "kbn-xsrf: true" `
        -H "Content-Type: application/json" `
        --form file=@/tmp/dashboard.json

    # Create index patterns
    Write-Host "🔍 Creating index patterns..." -ForegroundColor Cyan
    $indexPattern = @'
{
  "attributes": {
    "title": "dhakacart-*",
    "timeFieldName": "@timestamp"
  }
}
'@

    kubectl exec -n logging $kibanaPod -- curl -X POST "localhost:5601/api/saved_objects/index-pattern/dhakacart-*" `
        -H "kbn-xsrf: true" `
        -H "Content-Type: application/json" `
        -d $indexPattern

    # Get service information
    Write-Host "📊 Getting service information..." -ForegroundColor Cyan

    # Elasticsearch
    $elasticsearchService = kubectl get svc -n logging -l app=elasticsearch-master -o jsonpath='{.items[0].metadata.name}'
    Write-Host "🔍 Elasticsearch is accessible via: kubectl port-forward -n logging svc/$elasticsearchService 9200:9200" -ForegroundColor Cyan

    # Kibana
    $kibanaService = kubectl get svc -n logging -l app=kibana -o jsonpath='{.items[0].metadata.name}'
    $kibanaType = kubectl get svc -n logging $kibanaService -o jsonpath='{.spec.type}'

    if ($kibanaType -eq "LoadBalancer") {
        Write-Host "⏳ Waiting for LoadBalancer to get external IP..." -ForegroundColor Yellow
        kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' svc/$kibanaService -n logging --timeout=300s
        $kibanaUrl = kubectl get svc -n logging $kibanaService -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
        if (-not $kibanaUrl) {
            $kibanaUrl = kubectl get svc -n logging $kibanaService -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
        }
        Write-Host "🎉 Kibana is accessible at: http://$kibanaUrl`:5601" -ForegroundColor Green
    } else {
        Write-Host "🎉 Kibana is accessible via: kubectl port-forward -n logging svc/$kibanaService 5601:5601" -ForegroundColor Green
    }

    # Logstash
    $logstashService = kubectl get svc -n logging -l app=logstash -o jsonpath='{.items[0].metadata.name}'
    Write-Host "📊 Logstash is accessible via: kubectl port-forward -n logging svc/$logstashService 5044:5044" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "✅ ELK Stack deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Configure your applications to send logs to Logstash (port 5044)"
    Write-Host "2. Access Kibana to create visualizations and dashboards"
    Write-Host "3. Set up log retention policies as needed"
    Write-Host "4. Configure alerting based on log patterns"
    Write-Host ""
    Write-Host "🔍 Useful commands:" -ForegroundColor Yellow
    Write-Host "  - View Elasticsearch indices: kubectl exec -n logging deployment/elasticsearch-master -- curl localhost:9200/_cat/indices"
    Write-Host "  - Check Logstash pipeline: kubectl logs -n logging deployment/logstash"
    Write-Host "  - Monitor Filebeat: kubectl logs -n logging daemonset/filebeat-filebeat"
}