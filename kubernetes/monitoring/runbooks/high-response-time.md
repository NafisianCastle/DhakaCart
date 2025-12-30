# High Response Time Runbook

## Alert: DhakaCartHighResponseTime

### Description
The DhakaCart backend 95th percentile response time is above 2 seconds, indicating performance degradation.

### Severity: Warning

### Immediate Actions (0-5 minutes)

1. **Check Current Performance**
   ```bash
   # Check current response times
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5000/health
   
   # Check pod resource usage
   kubectl top pods -n dhakacart -l app=dhakacart-backend
   ```

2. **Verify System Load**
   ```bash
   # Check current request rate
   kubectl logs -n dhakacart -l app=dhakacart-backend --tail=50 | grep -c "$(date '+%Y-%m-%d %H:%M')"
   
   # Check if auto-scaling is working
   kubectl get hpa -n dhakacart
   ```

### Investigation Steps (5-15 minutes)

1. **Analyze Performance Metrics**
   - Open Grafana: http://grafana.dhakacart.local
   - Navigate to: DhakaCart Application Metrics dashboard
   - Check:
     - Request rate trends
     - Response time percentiles
     - Error rate correlation
     - Resource utilization

2. **Check Database Performance**
   ```bash
   # Check database connection metrics
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/metrics | grep -E "(pg_pool|db_query_duration)"
   
   # Check for slow queries in logs
   kubectl logs -n dhakacart -l app=dhakacart-backend | grep -i "slow\|timeout\|query.*ms"
   ```

3. **Check Cache Performance**
   ```bash
   # Check Redis cache hit rate
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/metrics | grep redis_hit_rate
   
   # Check Redis connection status
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/health/redis
   ```

### Common Causes and Solutions

#### 1. High Traffic Load
**Symptoms:** Increased request rate, CPU usage near limits
**Solution:**
```bash
# Scale up replicas
kubectl scale deployment/dhakacart-backend --replicas=8 -n dhakacart

# Check if cluster autoscaler is adding nodes
kubectl get nodes
kubectl describe nodes | grep -A 5 "Allocated resources"
```

#### 2. Database Performance Issues
**Symptoms:** High database query times, connection pool exhaustion
**Solution:**
```bash
# Check database metrics in Grafana
# Look for: slow queries, connection count, lock waits

# Restart backend to reset connection pools
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Consider read replica usage for read-heavy workloads
```

#### 3. Cache Miss Rate High
**Symptoms:** Low cache hit rate, increased database load
**Solution:**
```bash
# Check cache statistics
kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/metrics | grep cache

# Warm up cache if needed
kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -X POST http://localhost:5000/admin/cache/warmup
```

#### 4. Memory Pressure
**Symptoms:** High memory usage, garbage collection pauses
**Solution:**
```bash
# Check memory usage patterns
kubectl top pods -n dhakacart -l app=dhakacart-backend

# Increase memory limits temporarily
kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

#### 5. Network Latency
**Symptoms:** High response times across all endpoints
**Solution:**
```bash
# Check network connectivity
kubectl exec -n dhakacart deployment/dhakacart-backend -- ping -c 3 dhakacart-database

# Check service mesh metrics if applicable
kubectl get svc -n dhakacart
```

### Performance Optimization Actions

1. **Immediate Scaling**
   ```bash
   # Horizontal scaling
   kubectl scale deployment/dhakacart-backend --replicas=6 -n dhakacart
   
   # Verify scaling
   kubectl get pods -n dhakacart -l app=dhakacart-backend
   ```

2. **Resource Optimization**
   ```bash
   # Check current resource requests/limits
   kubectl describe deployment dhakacart-backend -n dhakacart | grep -A 10 "Limits\|Requests"
   
   # Temporarily increase resources
   kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"requests":{"cpu":"500m","memory":"512Mi"},"limits":{"cpu":"1000m","memory":"1Gi"}}}]}}}}'
   ```

3. **Cache Optimization**
   ```bash
   # Check cache configuration
   kubectl exec -n dhakacart deployment/dhakacart-backend -- env | grep REDIS
   
   # Restart Redis if needed
   kubectl rollout restart deployment/redis -n dhakacart
   ```

### Monitoring Recovery

1. **Watch Response Time Metrics**
   - Monitor Grafana dashboard
   - Response times should improve within 5-10 minutes
   - 95th percentile should drop below 2 seconds

2. **Verify Performance**
   ```bash
   # Test response times
   for i in {1..10}; do
     kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:5000/api/products
   done
   ```

### Performance Tuning Recommendations

1. **Database Optimization**
   - Review slow query logs
   - Consider adding database indexes
   - Optimize connection pool settings
   - Implement query caching

2. **Application Optimization**
   - Profile application code for bottlenecks
   - Implement response caching
   - Optimize database queries
   - Use connection pooling effectively

3. **Infrastructure Optimization**
   - Review resource allocation
   - Consider using faster storage classes
   - Optimize network configuration
   - Implement CDN for static assets

### Preventive Measures

1. **Monitoring Enhancements**
   ```bash
   # Set up additional performance alerts
   # Monitor 50th, 90th, and 99th percentiles
   # Track business metrics correlation
   ```

2. **Load Testing**
   - Implement regular load testing
   - Establish performance baselines
   - Test auto-scaling behavior

3. **Capacity Planning**
   - Monitor growth trends
   - Plan for peak traffic periods
   - Review resource allocation regularly

### Escalation

**Escalate to Performance Team if:**
- Response times don't improve within 20 minutes
- Performance degradation affects business metrics
- Infrastructure scaling is not effective

**Contact Information:**
- Performance Team: perf-team@dhakacart.com
- Database Team: db-team@dhakacart.com
- Senior Engineer: +880-XXX-XXXX

### Related Runbooks
- [High Error Rate](./high-error-rate.md)
- [Database Issues](./database-issues.md)
- [High Memory Usage](./high-memory-usage.md)