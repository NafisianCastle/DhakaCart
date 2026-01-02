# DhakaCart Chaos Engineering Suite

This chaos engineering suite validates the resilience and fault tolerance of the DhakaCart application by intentionally introducing failures and monitoring system behavior.

## 🎯 Resilience Requirements

Based on the requirements document, this suite validates:

- **Requirement 1.4**: Pod replacement within 30 seconds during failures
- **Requirement 1.5**: 99.9% uptime availability during various failure scenarios
- **Requirement 1.2**: Auto-scaling response within 5 minutes during resource exhaustion
- **Requirement 5.3**: Database failover within 60 seconds

## 🔥 Chaos Experiments

### 1. Pod Failure Experiment (`pod-failure-test.js`)
- **Purpose**: Validate Kubernetes pod recovery and application resilience
- **Method**: Terminates backend pods and monitors recovery
- **Validates**: Pod replacement time, application availability during failures
- **Expected Behavior**: New pods should start within 30 seconds, application remains available

### 2. Network Partition Experiment (`network-partition-test.js`)
- **Purpose**: Test application behavior during network connectivity issues
- **Method**: Creates network policies to block database access
- **Validates**: Circuit breaker patterns, graceful degradation
- **Expected Behavior**: Application should handle database connectivity loss gracefully

### 3. Resource Exhaustion Experiment (`resource-exhaustion-test.js`)
- **Purpose**: Validate auto-scaling and resource management
- **Method**: Deploys resource-intensive pods to exhaust cluster resources
- **Validates**: HPA response, cluster autoscaler behavior, application stability
- **Expected Behavior**: Auto-scaling should trigger within 5 minutes

### 4. Database Failure Experiment (`database-failure-test.js`)
- **Purpose**: Test database failover and application resilience
- **Method**: Simulates database failures through various methods
- **Validates**: Database failover time, application error handling
- **Expected Behavior**: Database should recover within 60 seconds

## 🚀 Quick Start

### Prerequisites

1. **Kubernetes Cluster Access**:
   ```bash
   kubectl config current-context
   kubectl get nodes
   ```

2. **Install Dependencies**:
   ```bash
   cd chaos-engineering
   npm install
   ```

3. **Set Environment Variables**:
   ```bash
   export K8S_NAMESPACE=dhakacart
   export API_URL=http://your-api-url
   export EXPERIMENT_DURATION=300  # 5 minutes
   ```

### Running Experiments

#### Run All Experiments
```bash
node run-chaos-experiments.js --all
```

#### Run Individual Experiments
```bash
# Pod failure experiment
node run-chaos-experiments.js --pod-failure

# Network partition experiment
node run-chaos-experiments.js --network-partition

# Resource exhaustion experiment
node run-chaos-experiments.js --resource-exhaustion

# Database failure experiment
node run-chaos-experiments.js --database-failure
```

#### CI/CD Mode (Continue on Failures)
```bash
node run-chaos-experiments.js --all --ci
```

#### Dry Run (Validate Setup)
```bash
node run-chaos-experiments.js --dry-run
```

## 📊 Understanding Results

### Experiment Reports

After running experiments, you'll find:

```
chaos-engineering/
├── chaos-experiment-report.json    # Detailed JSON results
├── chaos-experiment-report.html    # Visual HTML report
└── chaos-experiments.log           # Detailed execution logs
```

### Key Metrics

#### Pod Failure Metrics
- **Recovery Time**: Time for new pods to become ready
- **Application Availability**: Percentage of successful health checks during failure
- **Error Rate**: Percentage of failed requests during pod replacement

#### Network Partition Metrics
- **Database Error Rate**: Percentage of database-dependent requests that failed
- **Recovery Time**: Time for connectivity to be restored
- **Graceful Degradation**: Application behavior during network issues

#### Resource Exhaustion Metrics
- **Scaling Response Time**: Time for HPA to trigger scaling
- **Resource Utilization**: CPU/Memory usage during stress
- **Application Stability**: Health check success rate under resource pressure

#### Database Failure Metrics
- **Failover Time**: Time for database to recover
- **Application Error Handling**: How application handles database unavailability
- **Data Consistency**: Validation of data integrity after recovery

### Resilience Score

The suite calculates an overall resilience score based on:
- Experiment success rate
- Recovery times vs. requirements
- Application availability during failures
- Auto-scaling effectiveness

## 🔧 Configuration

### Environment Variables

```bash
# Kubernetes Configuration
K8S_NAMESPACE=dhakacart              # Target namespace
KUBECONFIG=/path/to/kubeconfig       # Kubernetes config file

# Application URLs
API_URL=http://localhost:5000        # Backend API URL
FRONTEND_URL=http://localhost:3000   # Frontend URL (optional)

# Experiment Configuration
EXPERIMENT_DURATION=300              # Experiment duration in seconds
RECOVERY_TIMEOUT=600                 # Maximum recovery wait time in seconds

# Logging
LOG_LEVEL=info                       # Logging level (debug, info, warn, error)
```

### Experiment Customization

Edit individual experiment files to customize:

#### Pod Failure (`pod-failure-test.js`)
```javascript
// Select different pod types for failure
selectTargetPods(pods) {
  return pods.filter(pod => 
    pod.metadata.name.includes('frontend') && // Target frontend instead
    pod.status.phase === 'Running'
  ).slice(0, 2); // Fail 2 pods instead of 1
}
```

#### Resource Exhaustion (`resource-exhaustion-test.js`)
```javascript
// Adjust stress pod configuration
const stressPod = {
  // ... other config
  spec: {
    containers: [{
      args: [
        '--cpu', '4',        // Increase CPU stress
        '--vm-bytes', '1G'   // Increase memory stress
      ]
    }]
  }
};
```

## 🚨 Safety Considerations

### Pre-Experiment Checklist

1. **Backup Critical Data**: Ensure recent backups exist
2. **Notify Team**: Inform team members about chaos experiments
3. **Monitor Resources**: Ensure sufficient cluster resources
4. **Validate Permissions**: Confirm Kubernetes RBAC permissions
5. **Test Environment**: Run experiments in staging first

### During Experiments

- **Monitor Dashboards**: Keep monitoring dashboards open
- **Have Rollback Plan**: Know how to quickly restore services
- **Communication Channel**: Keep team communication open
- **Resource Limits**: Experiments respect resource limits and quotas

### Emergency Procedures

If experiments cause unexpected issues:

1. **Stop Experiments**:
   ```bash
   # Kill running experiment
   pkill -f "run-chaos-experiments"
   
   # Clean up chaos resources
   kubectl delete pods -l chaos-experiment --all-namespaces
   kubectl delete networkpolicies -l created-by=dhakacart-chaos-engineering
   ```

2. **Restore Services**:
   ```bash
   # Scale up deployments if needed
   kubectl scale deployment dhakacart-backend --replicas=3
   kubectl scale deployment dhakacart-frontend --replicas=3
   
   # Check pod status
   kubectl get pods -n dhakacart
   ```

3. **Validate Recovery**:
   ```bash
   # Test application health
   curl http://your-api-url/health
   ```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Chaos Engineering Tests
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM
  workflow_dispatch:

jobs:
  chaos-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Configure kubectl
        uses: azure/k8s-set-context@v1
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBECONFIG }}
      
      - name: Install dependencies
        run: |
          cd chaos-engineering
          npm install
      
      - name: Run chaos experiments
        run: |
          cd chaos-engineering
          node run-chaos-experiments.js --all --ci
        env:
          K8S_NAMESPACE: dhakacart-staging
          API_URL: https://staging-api.dhakacart.com
          EXPERIMENT_DURATION: 180
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: chaos-experiment-results
          path: |
            chaos-engineering/chaos-experiment-report.html
            chaos-engineering/chaos-experiment-report.json
            chaos-engineering/chaos-experiments.log
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: chaos-engineering-tests
  namespace: dhakacart
spec:
  schedule: "0 2 * * 1"  # Weekly on Monday at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: chaos-tests
            image: dhakacart/chaos-engineering:latest
            command: ["node", "run-chaos-experiments.js", "--all", "--ci"]
            env:
            - name: K8S_NAMESPACE
              value: "dhakacart"
            - name: API_URL
              value: "http://dhakacart-backend:5000"
          restartPolicy: OnFailure
          serviceAccountName: chaos-engineering-sa
```

## 📚 Best Practices

### Experiment Design

1. **Start Small**: Begin with single pod failures before complex scenarios
2. **Gradual Increase**: Progressively increase failure scope and duration
3. **Hypothesis-Driven**: Define expected behavior before running experiments
4. **Measure Everything**: Collect comprehensive metrics during experiments

### Monitoring

1. **Real-Time Dashboards**: Monitor system health during experiments
2. **Alert Thresholds**: Set appropriate alert thresholds for experiments
3. **Log Correlation**: Use correlation IDs to track request flows
4. **Business Metrics**: Monitor business KPIs alongside technical metrics

### Team Practices

1. **Game Days**: Run experiments as team exercises
2. **Post-Mortems**: Conduct reviews after each experiment
3. **Documentation**: Document findings and improvements
4. **Knowledge Sharing**: Share learnings across teams

## 🤝 Contributing

When adding new chaos experiments:

1. Follow the existing experiment structure
2. Include comprehensive logging and metrics
3. Add safety checks and cleanup procedures
4. Update this README with new experiment details
5. Test experiments in staging environments first

## 📄 License

This chaos engineering suite is part of the DhakaCart project and follows the same license terms.