# Task 11.8: Performance and Scalability Validation Guide

## Overview

This guide provides comprehensive instructions for validating performance and scalability of the DhakaCart application, including load testing with 100,000+ concurrent users, response time validation, auto-scaling behavior testing, and uptime verification during peak load.

## Prerequisites

### Required Tools
- Artillery.js (for comprehensive load testing)
- kubectl (configured for EKS cluster access)
- AWS CLI (configured with appropriate permissions)
- curl (for HTTP requests)
- PowerShell 7+ (Windows) or Bash (Linux/macOS)
- Apache Bench (ab) or wrk (alternative load testing tools)

### Infrastructure Requirements
- Deployed DhakaCart application with auto-scaling configured
- Horizontal Pod Autoscaler (HPA) configured
- Cluster Autoscaler enabled
- Monitoring stack (Prometheus, Grafana) deployed
- Load balancer with health checks configured

### Performance Targets
- Response time: < 2 seconds average under normal load
- 99th percentile response time: < 5 seconds under peak load
- System uptime: 99.9% during testing
- Auto-scaling: Trigger within 2 minutes of load increase
- Concurrent users: Support 100,000+ users

## Performance Testing Components

### 1. Baseline Performance Measurement

#### Single Request Testing
```bash
# Measure response time for key endpoints
curl -w "Total time: %{time_total}s\nConnect time: %{time_connect}s\nTTFB: %{time_starttransfer}s\n" \
  -s "https://api.dhakacart.example.com/api/products" -o /dev/null

# Test with different payload sizes
curl -w "%{time_total}\n" -s "https://api.dhakacart.example.com/api/products?limit=100" -o /dev/null
```

#### Response Time Distribution
```bash
# Multiple requests to get distribution
for i in {1..50}; do
  curl -w "%{time_total}\n" -s "https://api.dhakacart.example.com/api/products" -o /dev/null
done | sort -n | awk '
{
  times[NR] = $1
  sum += $1
}
END {
  print "Count:", NR
  print "Average:", sum/NR
  print "Median:", times[int(NR/2)]
  print "95th percentile:", times[int(NR*0.95)]
  print "99th percentile:", times[int(NR*0.99)]
}'
```

### 2. Load Testing with Artillery

#### Basic Load Test Configuration
```yaml
# artillery-basic.yml
config:
  target: 'https://api.dhakacart.example.com'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
    - duration: 120
      arrivalRate: 500
      name: "Peak load"
  defaults:
    headers:
      User-Agent: "DhakaCart Load Test"

scenarios:
  - name: "Product browsing"
    weight: 70
    flow:
      - get:
          url: "/api/products"
      - think: 2
      - get:
          url: "/api/products/search?q={{ $randomString() }}"
      - think: 1
      - get:
          url: "/api/products/{{ $randomInt(1, 100) }}"

  - name: "Cart operations"
    weight: 30
    flow:
      - post:
          url: "/api/cart"
          json:
            items: []
          capture:
            - json: "$.id"
              as: "cartId"
      - post:
          url: "/api/cart/{{ cartId }}/items"
          json:
            productId: "{{ $randomInt(1, 100) }}"
            quantity: "{{ $randomInt(1, 5) }}"
      - get:
          url: "/api/cart/{{ cartId }}"
```

#### High-Scale Load Test Configuration
```yaml
# artillery-scale.yml
config:
  target: 'https://api.dhakacart.example.com'
  phases:
    - duration: 300
      arrivalRate: 100
      name: "Ramp up"
    - duration: 600
      arrivalRate: 1000
      name: "High load"
    - duration: 900
      arrivalRate: 2000
      name: "Peak load"
    - duration: 1800
      arrivalRate: 5000
      name: "Extreme load"
  defaults:
    headers:
      User-Agent: "DhakaCart Scale Test"
  http:
    timeout: 30
    pool: 50

scenarios:
  - name: "Realistic user journey"
    flow:
      - get:
          url: "/api/products"
          expect:
            - statusCode: 200
      - think: "{{ $randomInt(1, 5) }}"
      - get:
          url: "/api/products/search?q=laptop"
          expect:
            - statusCode: 200
      - think: "{{ $randomInt(2, 8) }}"
      - post:
          url: "/api/cart"
          json:
            items: []
          capture:
            - json: "$.id"
              as: "cartId"
          expect:
            - statusCode: [200, 201]
      - post:
          url: "/api/cart/{{ cartId }}/items"
          json:
            productId: "1"
            quantity: 1
          expect:
            - statusCode: [200, 201]
```

#### Running Artillery Tests
```bash
# Install Artillery
npm install -g artillery

# Run basic load test
artillery run artillery-basic.yml --output basic-results.json

# Run scale test
artillery run artillery-scale.yml --output scale-results.json

# Generate HTML report
artillery report basic-results.json --output basic-report.html
artillery report scale-results.json --output scale-report.html
```

### 3. Alternative Load Testing Tools

#### Apache Bench (ab)
```bash
# Basic load test
ab -n 10000 -c 100 https://api.dhakacart.example.com/api/products

# POST request test
ab -n 1000 -c 50 -p cart-data.json -T application/json https://api.dhakacart.example.com/api/cart

# Sustained load test
ab -n 100000 -c 1000 -t 300 https://api.dhakacart.example.com/api/products
```

#### wrk Load Testing
```bash
# Install wrk (Linux/macOS)
# Ubuntu: sudo apt-get install wrk
# macOS: brew install wrk

# Basic load test
wrk -t12 -c400 -d30s https://api.dhakacart.example.com/api/products

# Custom script for complex scenarios
wrk -t12 -c400 -d30s -s script.lua https://api.dhakacart.example.com/
```

#### wrk Lua Script Example
```lua
-- script.lua
wrk.method = "GET"
wrk.headers["Content-Type"] = "application/json"

local counter = 0
local threads = {}

function setup(thread)
   thread:set("id", counter)
   table.insert(threads, thread)
   counter = counter + 1
end

function init(args)
   requests = 0
   responses = 0
end

function request()
   requests = requests + 1
   local paths = {
      "/api/products",
      "/api/products/search?q=laptop",
      "/api/products/1",
      "/health"
   }
   return wrk.format(nil, paths[math.random(#paths)])
end

function response(status, headers, body)
   responses = responses + 1
end
```

### 4. Auto-scaling Validation

#### Monitoring HPA Behavior
```bash
# Watch HPA scaling in real-time
kubectl get hpa -n dhakacart -w

# Monitor pod scaling
kubectl get pods -n dhakacart -l app=backend -w

# Check HPA events
kubectl describe hpa -n dhakacart

# View HPA metrics
kubectl top pods -n dhakacart
```

#### Cluster Autoscaler Monitoring
```bash
# Monitor node scaling
kubectl get nodes -w

# Check cluster autoscaler logs
kubectl logs -n kube-system deployment/cluster-autoscaler

# View cluster autoscaler events
kubectl get events --field-selector reason=TriggeredScaleUp
kubectl get events --field-selector reason=ScaleDown
```

#### Custom Metrics Scaling
```bash
# Check custom metrics (if configured)
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1" | jq .

# Monitor custom metrics HPA
kubectl describe hpa custom-metrics-hpa -n dhakacart
```

### 5. Database Performance Testing

#### Connection Pool Testing
```bash
# Test database connection limits
for i in {1..100}; do
  (curl -s "https://api.dhakacart.example.com/api/products/search?q=test$i" &)
done
wait
```

#### Query Performance Analysis
```sql
-- Enable slow query logging (PostgreSQL)
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Monitor active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

#### Redis Performance Testing
```bash
# Redis performance benchmark
redis-benchmark -h redis-host -p 6379 -n 100000 -c 50

# Monitor Redis metrics
redis-cli -h redis-host INFO stats
redis-cli -h redis-host INFO memory
redis-cli -h redis-host INFO clients
```

### 6. Network Performance Testing

#### Bandwidth Testing
```bash
# Test download speed
curl -w "Download speed: %{speed_download} bytes/sec\n" \
  -o /dev/null -s "https://dhakacart.example.com/large-file"

# Test with different payload sizes
for size in 1KB 10KB 100KB 1MB; do
  curl -w "$size: %{time_total}s\n" \
    -o /dev/null -s "https://api.dhakacart.example.com/api/test-payload?size=$size"
done
```

#### CDN Performance Testing
```bash
# Test static asset delivery
curl -w "Static asset time: %{time_total}s\n" \
  -o /dev/null -s "https://dhakacart.example.com/static/js/main.js"

# Test from different geographic locations (using VPN or cloud instances)
for region in us-east-1 eu-west-1 ap-southeast-1; do
  echo "Testing from $region"
  # Run tests from different regions
done
```

### 7. Memory and CPU Stress Testing

#### Memory Stress Testing
```bash
# Monitor memory usage during load
kubectl top pods -n dhakacart --sort-by=memory

# Check for memory leaks
kubectl exec -n dhakacart deployment/backend -- ps aux | grep node
kubectl exec -n dhakacart deployment/backend -- cat /proc/meminfo
```

#### CPU Stress Testing
```bash
# Monitor CPU usage
kubectl top pods -n dhakacart --sort-by=cpu

# Generate CPU-intensive requests
for i in {1..10}; do
  (
    for j in {1..1000}; do
      curl -s "https://api.dhakacart.example.com/api/products/search?q=complex-query" > /dev/null
    done
  ) &
done
```

## Automated Performance Testing Script

### Running the Complete Performance Suite
```powershell
# Run comprehensive performance validation
./scripts/validate-performance-scalability.ps1 `
  -BaseUrl "https://dhakacart.example.com" `
  -ApiUrl "https://api.dhakacart.example.com" `
  -MaxUsers 100000 `
  -TestDuration 30 `
  -Region "us-west-2" `
  -ClusterName "dhakacart-cluster" `
  -Namespace "dhakacart"
```

### Continuous Performance Testing
```yaml
# .github/workflows/performance-test.yml
name: Performance Testing
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Artillery
        run: npm install -g artillery
      
      - name: Run performance tests
        run: |
          artillery run artillery-basic.yml --output results.json
          artillery report results.json --output report.html
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: |
            results.json
            report.html
```

## Performance Monitoring and Alerting

### Key Performance Metrics
- Response time (average, 95th, 99th percentile)
- Throughput (requests per second)
- Error rate (4xx, 5xx responses)
- Resource utilization (CPU, memory, disk, network)
- Database performance (query time, connection count)
- Cache hit ratio

### Prometheus Queries for Performance Monitoring
```promql
# Average response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# CPU utilization
rate(container_cpu_usage_seconds_total[5m]) * 100

# Memory utilization
container_memory_usage_bytes / container_spec_memory_limit_bytes * 100
```

### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "DhakaCart Performance Dashboard",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      }
    ]
  }
}
```

## Performance Optimization Strategies

### Application-Level Optimizations
- Implement response caching
- Optimize database queries
- Use connection pooling
- Enable gzip compression
- Minimize payload sizes
- Implement lazy loading

### Infrastructure-Level Optimizations
- Configure auto-scaling policies
- Optimize resource requests/limits
- Use appropriate instance types
- Implement CDN for static assets
- Configure load balancer settings
- Optimize network policies

### Database Optimizations
- Add appropriate indexes
- Implement query caching
- Use read replicas
- Optimize connection pooling
- Monitor slow queries
- Implement database sharding (if needed)

## Troubleshooting Performance Issues

### High Response Times
```bash
# Check application logs
kubectl logs -n dhakacart deployment/backend --tail=100

# Monitor database performance
kubectl exec -n dhakacart deployment/postgres -- psql -c "SELECT * FROM pg_stat_activity;"

# Check resource constraints
kubectl describe pod -n dhakacart -l app=backend
```

### Memory Issues
```bash
# Check memory usage
kubectl top pods -n dhakacart

# Analyze memory leaks
kubectl exec -n dhakacart deployment/backend -- node --expose-gc -e "
  setInterval(() => {
    console.log('Memory:', process.memoryUsage());
    global.gc();
  }, 5000);
"
```

### CPU Bottlenecks
```bash
# Profile CPU usage
kubectl exec -n dhakacart deployment/backend -- top

# Check for CPU throttling
kubectl describe pod -n dhakacart -l app=backend | grep -A 5 "cpu"
```

## Performance Testing Best Practices

### Test Environment
- Use production-like data volumes
- Test with realistic user patterns
- Include geographic distribution
- Test during different time periods
- Use production-equivalent infrastructure

### Test Scenarios
- Normal load (baseline)
- Peak load (expected maximum)
- Stress load (beyond capacity)
- Spike load (sudden increases)
- Endurance load (sustained periods)

### Monitoring During Tests
- Real-time metrics collection
- Application and infrastructure logs
- Database performance metrics
- Network utilization
- User experience metrics

### Result Analysis
- Compare against baselines
- Identify performance bottlenecks
- Analyze scaling behavior
- Document performance characteristics
- Create optimization recommendations

## Compliance and SLA Validation

### SLA Targets
- 99.9% uptime
- < 2 second average response time
- < 5 second 99th percentile response time
- Support for 100,000+ concurrent users
- Auto-scaling within 2 minutes

### Compliance Reporting
```bash
# Generate SLA compliance report
./scripts/generate-sla-report.sh --start-date "2024-01-01" --end-date "2024-01-31"

# Calculate uptime percentage
uptime_percentage=$(echo "scale=4; $successful_requests / $total_requests * 100" | bc)
echo "Uptime: $uptime_percentage%"
```

## Additional Resources

- [Artillery.js Documentation](https://artillery.io/docs/)
- [Kubernetes Performance Testing](https://kubernetes.io/docs/concepts/cluster-administration/system-logs/)
- [AWS Load Testing Best Practices](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Prometheus Performance Monitoring](https://prometheus.io/docs/practices/instrumentation/)
- [Grafana Performance Dashboards](https://grafana.com/grafana/dashboards/)