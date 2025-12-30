#!/bin/bash

# Deploy Alerting and Notification System for DhakaCart
# This script configures AlertManager with notification channels

set -e

echo "🚨 Deploying Alerting and Notification System for DhakaCart..."

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not configured or cluster is not accessible."
    exit 1
fi

# Check if monitoring namespace exists
if ! kubectl get namespace monitoring &> /dev/null; then
    echo "❌ Monitoring namespace not found. Please deploy Prometheus stack first."
    exit 1
fi

# Create alertmanager configuration secret
echo "📧 Creating AlertManager configuration..."
kubectl create secret generic alertmanager-config \
    --from-file=alertmanager.yml=alertmanager/alertmanager.yaml \
    --from-file=email.tmpl=alertmanager/templates/email.tmpl \
    --namespace monitoring \
    --dry-run=client -o yaml | kubectl apply -f -

# Update Prometheus stack with AlertManager configuration
echo "⚙️  Updating Prometheus stack with AlertManager configuration..."
helm upgrade prometheus-stack prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --reuse-values \
    --set alertmanager.config.global.smtp_smarthost="smtp.gmail.com:587" \
    --set alertmanager.config.global.smtp_from="alerts@dhakacart.com" \
    --set alertmanager.configFileName="alertmanager.yml" \
    --wait

# Apply PrometheusRules for DhakaCart
echo "📊 Applying DhakaCart alerting rules..."
kubectl apply -f prometheus/rules/dhakacart-alerts.yaml -n dhakacart

# Wait for AlertManager to be ready
echo "⏳ Waiting for AlertManager to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=alertmanager --namespace monitoring --timeout=300s

# Create runbooks configmap
echo "📚 Creating runbooks configmap..."
kubectl create configmap dhakacart-runbooks \
    --from-file=runbooks/ \
    --namespace dhakacart \
    --dry-run=client -o yaml | kubectl apply -f -

# Create notification test script
echo "🧪 Creating notification test script..."
cat > /tmp/test-alerts.sh << 'EOF'
#!/bin/bash

# Test AlertManager notifications
ALERTMANAGER_URL="http://localhost:9093"

echo "Testing AlertManager notifications..."

# Test critical alert
curl -X POST $ALERTMANAGER_URL/api/v1/alerts -H "Content-Type: application/json" -d '[
  {
    "labels": {
      "alertname": "TestCriticalAlert",
      "severity": "critical",
      "service": "dhakacart-backend",
      "instance": "test-instance"
    },
    "annotations": {
      "summary": "Test critical alert for notification system",
      "description": "This is a test alert to verify critical notification channels are working",
      "runbook_url": "https://runbooks.dhakacart.com/test-alert"
    },
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "endsAt": "'$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }
]'

echo "Critical test alert sent!"

# Test warning alert
curl -X POST $ALERTMANAGER_URL/api/v1/alerts -H "Content-Type: application/json" -d '[
  {
    "labels": {
      "alertname": "TestWarningAlert",
      "severity": "warning",
      "service": "dhakacart-backend",
      "instance": "test-instance"
    },
    "annotations": {
      "summary": "Test warning alert for notification system",
      "description": "This is a test alert to verify warning notification channels are working",
      "runbook_url": "https://runbooks.dhakacart.com/test-alert"
    },
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "endsAt": "'$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }
]'

echo "Warning test alert sent!"
EOF

chmod +x /tmp/test-alerts.sh

# Get AlertManager service information
ALERTMANAGER_SERVICE=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}')

echo ""
echo "✅ Alerting and notification system deployed successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "  - AlertManager configured with email and Slack notifications"
echo "  - Notification templates created for better formatting"
echo "  - DhakaCart-specific alerting rules applied"
echo "  - Runbooks created for common scenarios"
echo ""
echo "🔧 Next Steps:"
echo "1. Update AlertManager configuration with your actual:"
echo "   - SMTP credentials (Gmail app password)"
echo "   - Slack webhook URLs"
echo "   - Email addresses for different teams"
echo ""
echo "2. Test notifications:"
echo "   kubectl port-forward -n monitoring svc/$ALERTMANAGER_SERVICE 9093:9093"
echo "   Then run: /tmp/test-alerts.sh"
echo ""
echo "3. Access AlertManager UI:"
echo "   kubectl port-forward -n monitoring svc/$ALERTMANAGER_SERVICE 9093:9093"
echo "   Open: http://localhost:9093"
echo ""
echo "📧 Email Configuration Required:"
echo "  - Update alertmanager/alertmanager.yaml with your SMTP settings"
echo "  - For Gmail: Use app-specific password, not regular password"
echo "  - Enable 2FA and generate app password at: https://myaccount.google.com/apppasswords"
echo ""
echo "💬 Slack Configuration Required:"
echo "  - Create Slack app and webhook URLs"
echo "  - Update webhook URLs in alertmanager/alertmanager.yaml"
echo "  - Create channels: #alerts-critical, #alerts-warning, #business-alerts, #infrastructure-alerts"
echo ""
echo "📚 Runbooks Available:"
echo "  - High Error Rate: kubectl get configmap dhakacart-runbooks -n dhakacart -o jsonpath='{.data.high-error-rate\.md}'"
echo "  - High Response Time: kubectl get configmap dhakacart-runbooks -n dhakacart -o jsonpath='{.data.high-response-time\.md}'"
echo "  - Pod Crash Loop: kubectl get configmap dhakacart-runbooks -n dhakacart -o jsonpath='{.data.pod-crash-loop\.md}'"
echo ""
echo "🔍 Useful Commands:"
echo "  - View active alerts: curl http://localhost:9093/api/v1/alerts"
echo "  - Check AlertManager config: kubectl get secret alertmanager-config -n monitoring -o yaml"
echo "  - View alerting rules: kubectl get prometheusrules -n dhakacart"
echo "  - Test alert routing: kubectl logs -n monitoring alertmanager-prometheus-stack-kube-prom-alertmanager-0"