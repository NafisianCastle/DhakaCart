#!/bin/bash

# Deploy ELK Stack for DhakaCart
# This script installs Elasticsearch, Logstash, Kibana, and Filebeat using Helm

set -e

echo "🚀 Deploying ELK Stack for DhakaCart..."

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

# Create logging namespace
echo "📦 Creating logging namespace..."
kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -

# Create dhakacart namespace if it doesn't exist
echo "📦 Creating dhakacart namespace..."
kubectl create namespace dhakacart --dry-run=client -o yaml | kubectl apply -f -

# Add Elastic Helm repository
echo "📚 Adding Elastic Helm repository..."
helm repo add elastic https://helm.elastic.co
helm repo update

# Deploy Elasticsearch
echo "🔍 Deploying Elasticsearch..."
helm upgrade --install elasticsearch elastic/elasticsearch \
    --namespace logging \
    --values elasticsearch/values.yaml \
    --wait \
    --timeout 15m

# Wait for Elasticsearch to be ready
echo "⏳ Waiting for Elasticsearch to be ready..."
kubectl wait --for=condition=ready pod -l app=elasticsearch-master --namespace logging --timeout=600s

# Deploy Logstash
echo "📊 Deploying Logstash..."
helm upgrade --install logstash elastic/logstash \
    --namespace logging \
    --values logstash/values.yaml \
    --wait \
    --timeout 10m

# Wait for Logstash to be ready
echo "⏳ Waiting for Logstash to be ready..."
kubectl wait --for=condition=ready pod -l app=logstash --namespace logging --timeout=300s

# Deploy Kibana
echo "📈 Deploying Kibana..."
helm upgrade --install kibana elastic/kibana \
    --namespace logging \
    --values kibana/values.yaml \
    --wait \
    --timeout 10m

# Wait for Kibana to be ready
echo "⏳ Waiting for Kibana to be ready..."
kubectl wait --for=condition=ready pod -l app=kibana --namespace logging --timeout=300s

# Deploy Filebeat
echo "📋 Deploying Filebeat..."
helm upgrade --install filebeat elastic/filebeat \
    --namespace logging \
    --values filebeat/values.yaml \
    --wait \
    --timeout 10m

# Wait for Filebeat DaemonSet to be ready
echo "⏳ Waiting for Filebeat to be ready..."
kubectl rollout status daemonset/filebeat-filebeat --namespace logging --timeout=300s

# Create Elasticsearch index lifecycle policy
echo "🔄 Creating index lifecycle policy..."
kubectl exec -n logging deployment/elasticsearch-master -- curl -X PUT "localhost:9200/_ilm/policy/dhakacart-policy" -H 'Content-Type: application/json' -d'
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
}'

# Import Kibana dashboards
echo "📊 Importing Kibana dashboards..."
sleep 30  # Wait for Kibana to fully initialize

# Get Kibana pod name
KIBANA_POD=$(kubectl get pods -n logging -l app=kibana -o jsonpath='{.items[0].metadata.name}')

# Copy dashboard file to Kibana pod
kubectl cp kibana/dashboards/dhakacart-logs-dashboard.json logging/$KIBANA_POD:/tmp/dashboard.json

# Import dashboard
kubectl exec -n logging $KIBANA_POD -- curl -X POST "localhost:5601/api/saved_objects/_import" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    --form file=@/tmp/dashboard.json

# Create index patterns
echo "🔍 Creating index patterns..."
kubectl exec -n logging $KIBANA_POD -- curl -X POST "localhost:5601/api/saved_objects/index-pattern/dhakacart-*" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -d '{
      "attributes": {
        "title": "dhakacart-*",
        "timeFieldName": "@timestamp"
      }
    }'

# Get service information
echo "📊 Getting service information..."

# Elasticsearch
ELASTICSEARCH_SERVICE=$(kubectl get svc -n logging -l app=elasticsearch-master -o jsonpath='{.items[0].metadata.name}')
echo "🔍 Elasticsearch is accessible via: kubectl port-forward -n logging svc/$ELASTICSEARCH_SERVICE 9200:9200"

# Kibana
KIBANA_SERVICE=$(kubectl get svc -n logging -l app=kibana -o jsonpath='{.items[0].metadata.name}')
KIBANA_TYPE=$(kubectl get svc -n logging $KIBANA_SERVICE -o jsonpath='{.spec.type}')

if [ "$KIBANA_TYPE" = "LoadBalancer" ]; then
    echo "⏳ Waiting for LoadBalancer to get external IP..."
    kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' svc/$KIBANA_SERVICE -n logging --timeout=300s
    KIBANA_URL=$(kubectl get svc -n logging $KIBANA_SERVICE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    if [ -z "$KIBANA_URL" ]; then
        KIBANA_URL=$(kubectl get svc -n logging $KIBANA_SERVICE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    fi
    echo "🎉 Kibana is accessible at: http://$KIBANA_URL:5601"
else
    echo "🎉 Kibana is accessible via: kubectl port-forward -n logging svc/$KIBANA_SERVICE 5601:5601"
fi

# Logstash
LOGSTASH_SERVICE=$(kubectl get svc -n logging -l app=logstash -o jsonpath='{.items[0].metadata.name}')
echo "📊 Logstash is accessible via: kubectl port-forward -n logging svc/$LOGSTASH_SERVICE 5044:5044"

echo ""
echo "✅ ELK Stack deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your applications to send logs to Logstash (port 5044)"
echo "2. Access Kibana to create visualizations and dashboards"
echo "3. Set up log retention policies as needed"
echo "4. Configure alerting based on log patterns"
echo ""
echo "🔍 Useful commands:"
echo "  - View Elasticsearch indices: kubectl exec -n logging deployment/elasticsearch-master -- curl localhost:9200/_cat/indices"
echo "  - Check Logstash pipeline: kubectl logs -n logging deployment/logstash"
echo "  - Monitor Filebeat: kubectl logs -n logging daemonset/filebeat-filebeat"