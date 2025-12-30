# High Error Rate Runbook

## Alert: DhakaCartHighErrorRate

### Description
The DhakaCart backend is experiencing a high error rate (>5% of requests returning 5xx status codes).

### Severity: Critical

### Immediate Actions (0-5 minutes)

1. **Check Current Status**
   ```bash
   # Check pod status
   kubectl get pods -n dhakacart -l app=dhakacart-backend
   
   # Check recent logs for errors
   kubectl logs -n dhakacart -l app=dhakacart-backend --tail=100 | grep -i error
   ```

2. **Verify Service Health**
   ```bash
   # Check service endpoints
   kubectl get endpoints -n dhakacart dhakacart-backend
   
   # Test health endpoint
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -f http://localhost:5000/health
   ```

3. **Check Resource Usage**
   ```bash
   # Check CPU and memory usage
   kubectl top pods -n dhakacart -l app=dhakacart-backend
   
   # Check if pods are being throttled
   kubectl describe pods -n dhakacart -l app=dhakacart-backend | grep -A 5 -B 5 "throttled"
   ```

### Investigation Steps (5-15 minutes)

1. **Analyze Error Patterns**
   - Open Kibana dashboard: http://kibana.dhakacart.local
   - Filter logs by: `level:ERROR AND service:backend`
   - Look for common error messages or patterns
   - Check if errors correlate with specific endpoints

2. **Check Database Connectivity**
   ```bash
   # Check database connection pool
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/metrics | grep pg_pool
   
   # Check database status
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/health/db
   ```

3. **Check External Dependencies**
   ```bash
   # Check Redis connectivity
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/health/redis
   
   # Check if external APIs are responding
   kubectl logs -n dhakacart -l app=dhakacart-backend | grep -i "external\|api\|timeout"
   ```

### Common Causes and Solutions

#### 1. Database Connection Issues
**Symptoms:** Connection timeout errors, pool exhaustion
**Solution:**
```bash
# Restart backend pods to reset connection pools
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Check database performance
kubectl exec -n dhakacart deployment/dhakacart-backend -- curl http://localhost:5000/metrics | grep pg_stat
```

#### 2. Memory/CPU Exhaustion
**Symptoms:** Out of memory errors, high CPU usage
**Solution:**
```bash
# Scale up replicas temporarily
kubectl scale deployment/dhakacart-backend --replicas=6 -n dhakacart

# Check if HPA is working
kubectl get hpa -n dhakacart
```

#### 3. Code Deployment Issues
**Symptoms:** Errors started after recent deployment
**Solution:**
```bash
# Check deployment history
kubectl rollout history deployment/dhakacart-backend -n dhakacart

# Rollback to previous version if needed
kubectl rollout undo deployment/dhakacart-backend -n dhakacart
```

#### 4. External Service Failures
**Symptoms:** Timeout errors, connection refused
**Solution:**
- Check external service status
- Implement circuit breaker if not already present
- Consider graceful degradation

### Recovery Actions

1. **If Database Issues:**
   ```bash
   # Restart database connections
   kubectl rollout restart deployment/dhakacart-backend -n dhakacart
   
   # Check database metrics in Grafana
   # Navigate to: Grafana > DhakaCart > Database Dashboard
   ```

2. **If Resource Issues:**
   ```bash
   # Increase resource limits temporarily
   kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi","cpu":"1000m"}}}]}}}}'
   
   # Scale horizontally
   kubectl scale deployment/dhakacart-backend --replicas=8 -n dhakacart
   ```

3. **If Code Issues:**
   ```bash
   # Rollback deployment
   kubectl rollout undo deployment/dhakacart-backend -n dhakacart
   
   # Monitor rollback progress
   kubectl rollout status deployment/dhakacart-backend -n dhakacart
   ```

### Monitoring Recovery

1. **Watch Error Rate**
   - Monitor Grafana dashboard: DhakaCart Application Metrics
   - Error rate should drop below 5% within 5-10 minutes
   - Response times should return to normal (<2s)

2. **Verify Functionality**
   ```bash
   # Test key endpoints
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -f http://localhost:5000/api/products
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -f http://localhost:5000/health
   ```

### Post-Incident Actions

1. **Document the Incident**
   - Record root cause in incident management system
   - Update this runbook if new solutions were found
   - Schedule post-mortem if incident was severe

2. **Preventive Measures**
   - Review and adjust resource limits
   - Implement additional monitoring if gaps were found
   - Consider code improvements to handle edge cases

### Escalation

**Escalate to Senior Engineer if:**
- Error rate doesn't improve within 15 minutes
- Multiple services are affected
- Database or infrastructure issues are suspected

**Contact Information:**
- Senior Engineer: +880-XXX-XXXX
- Database Team: db-team@dhakacart.com
- Infrastructure Team: infra@dhakacart.com

### Related Runbooks
- [High Response Time](./high-response-time.md)
- [Pod Crash Loop](./pod-crash-loop.md)
- [Database Issues](./database-issues.md)