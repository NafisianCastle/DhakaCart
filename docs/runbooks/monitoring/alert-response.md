# Alert Response Guide

**Severity**: P1-P3 (Varies by Alert)
**Last Updated**: 2024-12-30
**Owner**: DevOps Team
**Review Date**: 2025-03-30

## Overview
This runbook provides specific response procedures for each type of alert in the DhakaCart monitoring system. It includes investigation steps, resolution procedures, and escalation criteria for all configured alerts.

## Alert Severity Levels

### P0 - Critical (Immediate Response Required)
- Complete service outage
- Data loss or corruption
- Security breach
- Response Time: < 5 minutes

### P1 - High (Urgent Response Required)
- Significant performance degradation
- Partial service outage
- High error rates
- Response Time: < 15 minutes

### P2 - Medium (Timely Response Required)
- Minor performance issues
- Non-critical service degradation
- Resource warnings
- Response Time: < 1 hour

### P3 - Low (Standard Response)
- Informational alerts
- Capacity planning warnings
- Non-urgent maintenance items
- Response Time: < 4 hours

## Application Alerts

### 1. High Error Rate Alert

**Alert Name**: `HighErrorRate`
**Severity**: P1
**Threshold**: Error rate > 5% for 5 minutes
**Description**: Application is returning high number of 5xx errors

#### Investigation Steps
```bash
# Check current error rate
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
# Query: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Check application logs for errors
kubectl logs deployment/dhakacart-backend -n dhakacart --tail=100 | grep -E "ERROR|error|Error"

# Check recent deployments
kubectl rollout history deployment/dhakacart-backend -n dhakacart
kubectl rollout history deployment/dhakacart-frontend -n dhakacart

# Check pod status
kubectl get pods -n dhakacart -o wide
```

#### Resolution Steps
```bash
# If caused by recent deployment, rollback
kubectl rollout undo deployment/dhakacart-backend -n dhakacart

# If database connectivity issues
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run db:check

# If resource exhaustion, scale up
kubectl scale deployment dhakacart-backend --replicas=8 -n dhakacart

# Monitor error rate improvement
# Check Prometheus query: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

#### Escalation Criteria
- Error rate > 10% for 10 minutes
- No improvement after initial remediation
- Customer complaints increasing

### 2. High Response Time Alert

**Alert Name**: `HighResponseTime`
**Severity**: P1
**Threshold**: 95th percentile response time > 2 seconds for 5 minutes
**Description**: Application response times are degraded

#### Investigation Steps
```bash
# Check current response times
# Prometheus query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Check resource utilization
kubectl top pods -n dhakacart
kubectl top nodes

# Check database performance
aws rds describe-db-instances --db-instance-identifier dhakacart-db --query 'DBInstances[0].{Status:DBInstanceStatus,CPU:ProcessorFeatures}'

# Check for slow queries
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
"
```

#### Resolution Steps
```bash
# Scale application if CPU/memory bound
kubectl scale deployment dhakacart-backend --replicas=10 -n dhakacart

# If database is the bottleneck
aws rds modify-db-instance --db-instance-identifier dhakacart-db --db-instance-class db.r5.large --apply-immediately

# Clear cache if stale data is causing issues
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST FLUSHALL

# Restart pods if memory leaks suspected
kubectl rollout restart deployment/dhakacart-backend -n dhakacart
```

### 3. Pod Crash Loop Alert

**Alert Name**: `PodCrashLooping`
**Severity**: P1
**Threshold**: Pod restart count > 5 in 10 minutes
**Description**: Application pods are repeatedly crashing

#### Investigation Steps
```bash
# Identify crashing pods
kubectl get pods -n dhakacart | grep -E "CrashLoopBackOff|Error|Pending"

# Check pod events and logs
kubectl describe pod <pod-name> -n dhakacart
kubectl logs <pod-name> -n dhakacart --previous

# Check resource limits
kubectl describe pod <pod-name> -n dhakacart | grep -A 10 "Limits\|Requests"

# Check node resources
kubectl describe node <node-name> | grep -A 5 "Allocated resources"
```

#### Resolution Steps
```bash
# If out of memory, increase limits
kubectl patch deployment dhakacart-backend -n dhakacart -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "limits": {
              "memory": "1Gi"
            }
          }
        }]
      }
    }
  }
}'

# If configuration issue, rollback
kubectl rollout undo deployment/dhakacart-backend -n dhakacart

# If node resource exhaustion, scale cluster
aws eks update-nodegroup-config --cluster-name dhakacart-cluster --nodegroup-name main --scaling-config desiredSize=5
```

## Infrastructure Alerts

### 4. High CPU Usage Alert

**Alert Name**: `HighCPUUsage`
**Severity**: P2
**Threshold**: CPU usage > 80% for 10 minutes
**Description**: High CPU utilization on nodes or pods

#### Investigation Steps
```bash
# Check CPU usage by node
kubectl top nodes --sort-by=cpu

# Check CPU usage by pod
kubectl top pods -n dhakacart --sort-by=cpu

# Check CPU metrics in Prometheus
# Query: rate(container_cpu_usage_seconds_total[5m]) * 100

# Identify CPU-intensive processes
kubectl exec -it <pod-name> -n dhakacart -- top
```

#### Resolution Steps
```bash
# Scale horizontally if application CPU is high
kubectl scale deployment dhakacart-backend --replicas=8 -n dhakacart

# Scale cluster if node CPU is high
aws eks update-nodegroup-config --cluster-name dhakacart-cluster --nodegroup-name main --scaling-config desiredSize=6

# Increase CPU limits if pods are throttled
kubectl patch deployment dhakacart-backend -n dhakacart -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "limits": {
              "cpu": "1000m"
            }
          }
        }]
      }
    }
  }
}'
```

### 5. High Memory Usage Alert

**Alert Name**: `HighMemoryUsage`
**Severity**: P2
**Threshold**: Memory usage > 85% for 10 minutes
**Description**: High memory utilization on nodes or pods

#### Investigation Steps
```bash
# Check memory usage by node
kubectl top nodes --sort-by=memory

# Check memory usage by pod
kubectl top pods -n dhakacart --sort-by=memory

# Check for memory leaks
kubectl exec -it <pod-name> -n dhakacart -- cat /proc/meminfo

# Check OOM kills
dmesg | grep -i "killed process"
kubectl get events -n dhakacart | grep -i "oom"
```

#### Resolution Steps
```bash
# Increase memory limits
kubectl patch deployment dhakacart-backend -n dhakacart -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "limits": {
              "memory": "2Gi"
            }
          }
        }]
      }
    }
  }
}'

# Restart pods to clear memory leaks
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Scale cluster if node memory is exhausted
aws eks update-nodegroup-config --cluster-name dhakacart-cluster --nodegroup-name main --scaling-config desiredSize=6
```

## Database Alerts

### 6. Database Connection Alert

**Alert Name**: `DatabaseConnectionHigh`
**Severity**: P2
**Threshold**: Database connections > 80% of max for 5 minutes
**Description**: High number of database connections

#### Investigation Steps
```bash
# Check current connection count
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection by state
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"

# Check long-running connections
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pid, usename, application_name, client_addr, state, 
       now() - state_change as state_duration
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY state_change;
"
```

#### Resolution Steps
```bash
# Kill idle connections
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND now() - state_change > interval '1 hour';
"

# Restart application to reset connection pool
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Scale up database if needed
aws rds modify-db-instance --db-instance-identifier dhakacart-db --db-instance-class db.r5.large --apply-immediately
```

### 7. Database Slow Query Alert

**Alert Name**: `DatabaseSlowQueries`
**Severity**: P2
**Threshold**: Queries taking > 5 seconds detected
**Description**: Slow database queries detected

#### Investigation Steps
```bash
# Check slow queries
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT query, calls, total_time, mean_time, max_time
FROM pg_stat_statements 
WHERE mean_time > 5000
ORDER BY mean_time DESC 
LIMIT 10;
"

# Check currently running queries
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';
"

# Check database locks
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
"
```

#### Resolution Steps
```bash
# Kill long-running queries
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT pg_terminate_backend(<pid>);"

# Add missing indexes
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
CREATE INDEX CONCURRENTLY idx_products_category_active ON products(category_id, is_active);
"

# Update table statistics
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "ANALYZE;"
```

## Monitoring System Alerts

### 8. Prometheus Target Down Alert

**Alert Name**: `PrometheusTargetDown`
**Severity**: P2
**Threshold**: Prometheus target down for 5 minutes
**Description**: Prometheus cannot scrape metrics from target

#### Investigation Steps
```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
# Access http://localhost:9090/targets

# Check target service status
kubectl get svc -n dhakacart
kubectl get endpoints -n dhakacart

# Check network policies
kubectl get networkpolicy -n dhakacart
kubectl get networkpolicy -n monitoring
```

#### Resolution Steps
```bash
# Restart target service
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Check service monitor configuration
kubectl get servicemonitor -n monitoring dhakacart-backend-monitor -o yaml

# Restart Prometheus if needed
kubectl rollout restart deployment/prometheus -n monitoring
```

### 9. Disk Space Alert

**Alert Name**: `HighDiskUsage`
**Severity**: P2
**Threshold**: Disk usage > 85% for 10 minutes
**Description**: High disk usage on nodes

#### Investigation Steps
```bash
# Check disk usage on nodes
kubectl get nodes -o wide
for node in $(kubectl get nodes -o name); do
  echo "=== $node ==="
  kubectl debug $node -it --image=busybox -- df -h
done

# Check persistent volume usage
kubectl get pv
kubectl describe pv <pv-name>
```

#### Resolution Steps
```bash
# Clean up old logs
kubectl exec -it <pod-name> -n dhakacart -- find /var/log -name "*.log" -mtime +7 -delete

# Increase EBS volume size
aws ec2 modify-volume --volume-id <volume-id> --size 100

# Clean up unused Docker images on nodes
kubectl debug <node-name> -it --image=busybox -- docker system prune -f
```

## Alert Acknowledgment and Resolution

### Acknowledging Alerts
```bash
# Silence alert in AlertManager (15 minutes)
curl -X POST http://alertmanager:9093/api/v1/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {
        "name": "alertname",
        "value": "HighErrorRate",
        "isRegex": false
      }
    ],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "endsAt": "'$(date -u -d '+15 minutes' +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "createdBy": "oncall-engineer",
    "comment": "Investigating high error rate - scaling application"
  }'
```

### Marking Alerts as Resolved
```bash
# Verify alert condition is cleared
# Check relevant metrics in Prometheus/Grafana

# Document resolution in incident tracking system
# Update team in Slack channel
# Close AlertManager silence if manually created
```

## Communication Templates

### Alert Acknowledgment
```
🔍 ALERT ACKNOWLEDGED: [Alert Name]
Engineer: @username
Status: Investigating
ETA: [time estimate]
Actions: [brief description of investigation steps]
```

### Alert Resolution
```
✅ ALERT RESOLVED: [Alert Name]
Duration: [time from alert to resolution]
Root Cause: [brief explanation]
Resolution: [what was done to fix it]
Prevention: [steps to prevent recurrence]
```

### Escalation Notification
```
⚠️ ALERT ESCALATION: [Alert Name]
Original Alert Time: [timestamp]
Escalation Reason: [why escalating]
Current Status: [what has been tried]
Next Steps: [what will be done next]
```

## Related Documentation
- [System Outage Response](../emergency/system-outage.md)
- [Application Issues](../troubleshooting/application-issues.md)
- [Performance Issues](../troubleshooting/performance-issues.md)
- [Scaling Procedures](../operations/scaling.md)