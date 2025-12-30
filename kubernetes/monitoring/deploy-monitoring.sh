#!/bin/bash

# Complete Monitoring and Logging Infrastructure Deployment for DhakaCart
# This script deploys Prometheus, Grafana, ELK stack, and AlertManager

set -e

echo "🚀 Deploying Complete Monitoring and Logging Infrastructure for DhakaCart..."

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v helm &> /dev/null; then
    echo "❌ Helm is not installed. Please install Helm first."
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not configured or cluster is not accessible."
    exit 1
fi

# Create namespaces
echo "📦 Creating namespaces..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace dhakacart --dry-run=client -o yaml | kubectl apply -f -

# Add Helm repositories
echo "📚 Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add elastic https://helm.elastic.co
helm repo update

echo ""
echo "🎯 Deployment Plan:"
echo "1. Deploy Prometheus monitoring stack (Prometheus + Grafana + AlertManager)"
echo "2. Deploy ELK stack (Elasticsearch + Logstash + Kibana + Filebeat)"
echo "3. Configure alerting and notifications"
echo "4. Set up dashboards and runbooks"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Deploy Prometheus Stack
echo ""
echo "📊 Step 1: Deploying Prometheus monitoring stack..."
cd prometheus
./deploy-prometheus.sh
cd ..

# Deploy ELK Stack
echo ""
echo "📋 Step 2: Deploying ELK stack..."
cd elk
./deploy-elk.sh
cd ..

# Deploy Alerting
echo ""
echo "🚨 Step 3: Deploying alerting and notifications..."
./deploy-alerting.sh

# Create monitoring overview dashboard
echo ""
echo "📈 Step 4: Creating monitoring overview..."

# Get service information
GRAFANA_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}')
PROMETHEUS_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}')
ALERTMANAGER_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}')
KIBANA_SERVICE=$(kubectl get svc -n logging -l app=kibana -o jsonpath='{.items[0].metadata.name}')
ELASTICSEARCH_SERVICE=$(kubectl get svc -n logging -l app=elasticsearch-master -o jsonpath='{.items[0].metadata.name}')

# Create port-forward script
cat > monitoring-access.sh << EOF
#!/bin/bash

echo "🎛️  DhakaCart Monitoring Access Script"
echo "This script sets up port forwarding for all monitoring services"
echo ""

# Function to start port forwarding in background
start_port_forward() {
    local service=\$1
    local namespace=\$2
    local local_port=\$3
    local remote_port=\$4
    local name=\$5
    
    echo "Starting \$name on http://localhost:\$local_port"
    kubectl port-forward -n \$namespace svc/\$service \$local_port:\$remote_port &
    echo \$! > /tmp/pf-\$name.pid
}

# Kill existing port forwards
pkill -f "kubectl port-forward" 2>/dev/null || true

echo "🚀 Starting port forwards..."

# Start all services
start_port_forward "$GRAFANA_SERVICE" "monitoring" "3000" "80" "grafana"
start_port_forward "$PROMETHEUS_SERVICE" "monitoring" "9090" "9090" "prometheus"
start_port_forward "$ALERTMANAGER_SERVICE" "monitoring" "9093" "9093" "alertmanager"
start_port_forward "$KIBANA_SERVICE" "logging" "5601" "5601" "kibana"
start_port_forward "$ELASTICSEARCH_SERVICE" "logging" "9200" "9200" "elasticsearch"

sleep 5

echo ""
echo "✅ All services are now accessible:"
echo "📊 Grafana:      http://localhost:3000 (admin/admin123)"
echo "🔍 Prometheus:   http://localhost:9090"
echo "🚨 AlertManager: http://localhost:9093"
echo "📋 Kibana:       http://localhost:5601"
echo "🔎 Elasticsearch: http://localhost:9200"
echo ""
echo "🛑 To stop all port forwards, run: pkill -f 'kubectl port-forward'"
echo "📝 PID files are stored in /tmp/pf-*.pid"

# Wait for user input
echo ""
echo "Press Ctrl+C to stop all port forwards and exit..."
wait
EOF

chmod +x monitoring-access.sh

# Create monitoring status script
cat > monitoring-status.sh << EOF
#!/bin/bash

echo "🎛️  DhakaCart Monitoring Status"
echo "================================"
echo ""

echo "📊 Prometheus Stack Status:"
kubectl get pods -n monitoring -l "release=prometheus-stack"
echo ""

echo "📋 ELK Stack Status:"
kubectl get pods -n logging
echo ""

echo "🚨 AlertManager Status:"
kubectl get pods -n monitoring -l app.kubernetes.io/name=alertmanager
echo ""

echo "📈 Services:"
echo "Monitoring namespace:"
kubectl get svc -n monitoring
echo ""
echo "Logging namespace:"
kubectl get svc -n logging
echo ""

echo "💾 Storage:"
echo "Monitoring PVCs:"
kubectl get pvc -n monitoring
echo ""
echo "Logging PVCs:"
kubectl get pvc -n logging
echo ""

echo "🔍 Resource Usage:"
kubectl top pods -n monitoring 2>/dev/null || echo "Metrics server not available"
kubectl top pods -n logging 2>/dev/null || echo "Metrics server not available"
EOF

chmod +x monitoring-status.sh

echo ""
echo "🎉 Complete monitoring and logging infrastructure deployed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "✅ Prometheus + Grafana + AlertManager deployed in 'monitoring' namespace"
echo "✅ Elasticsearch + Logstash + Kibana + Filebeat deployed in 'logging' namespace"
echo "✅ Custom DhakaCart dashboards and alerts configured"
echo "✅ Runbooks created for common scenarios"
echo "✅ Notification channels configured (requires SMTP/Slack setup)"
echo ""
echo "🎛️  Quick Access:"
echo "Run: ./monitoring-access.sh to start port forwarding for all services"
echo "Run: ./monitoring-status.sh to check the status of all components"
echo ""
echo "📊 Default Credentials:"
echo "Grafana: admin / admin123 (change in production!)"
echo ""
echo "🔧 Next Steps:"
echo "1. Configure SMTP settings in AlertManager for email notifications"
echo "2. Set up Slack webhooks for chat notifications"
echo "3. Import additional Grafana dashboards as needed"
echo "4. Configure log retention policies"
echo "5. Set up backup for Grafana dashboards and Prometheus data"
echo ""
echo "📚 Documentation:"
echo "- Runbooks: kubectl get configmap dhakacart-runbooks -n dhakacart"
echo "- Alerting rules: kubectl get prometheusrules -n dhakacart"
echo "- Grafana dashboards: Check Grafana UI under 'DhakaCart' folder"
echo ""
echo "🔍 Troubleshooting:"
echo "If any component fails to start, check:"
echo "- kubectl describe pods -n monitoring"
echo "- kubectl describe pods -n logging"
echo "- kubectl logs -n monitoring <pod-name>"
echo "- kubectl logs -n logging <pod-name>"
EOF

chmod +x kubernetes/monitoring/deploy-monitoring.sh