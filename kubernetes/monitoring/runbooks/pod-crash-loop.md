# Pod Crash Loop Runbook

## Alert: DhakaCartPodCrashLooping

### Description
A DhakaCart pod is in a crash loop, continuously restarting and failing to start properly.

### Severity: Critical

### Immediate Actions (0-2 minutes)

1. **Identify Affected Pods**
   ```bash
   # Check pod status
   kubectl get pods -n dhakacart -l app=dhakacart-backend
   kubectl get pods -n dhakacart -l app=dhakacart-frontend
   
   # Look for pods with high restart count or CrashLoopBackOff status
   kubectl get pods -n dhakacart --field-selector=status.phase!=Running
   ```

2. **Check Recent Logs**
   ```bash
   # Get logs from crashing pod (replace POD_NAME)
   kubectl logs -n dhakacart POD_NAME --previous
   kubectl logs -n dhakacart POD_NAME --tail=50
   
   # Check for common error patterns
   kubectl logs -n dhakacart POD_NAME | grep -i "error\|exception\|fatal\|panic"
   ```

### Investigation Steps (2-10 minutes)

1. **Analyze Pod Events**
   ```bash
   # Check pod events for clues
   kubectl describe pod POD_NAME -n dhakacart
   
   # Look for events like:
   # - Failed to pull image
   # - Liveness probe failed
   # - OOMKilled (Out of Memory)
   # - Error: ImagePullBackOff
   ```

2. **Check Resource Constraints**
   ```bash
   # Check if pod is being killed due to resource limits
   kubectl describe pod POD_NAME -n dhakacart | grep -A 10 -B 10 "OOMKilled\|Evicted"
   
   # Check node resource availability
   kubectl describe nodes | grep -A 5 "Allocated resources"
   ```

3. **Verify Configuration**
   ```bash
   # Check deployment configuration
   kubectl get deployment dhakacart-backend -n dhakacart -o yaml
   
   # Check for recent configuration changes
   kubectl rollout history deployment/dhakacart-backend -n dhakacart
   ```

### Common Causes and Solutions

#### 1. Out of Memory (OOMKilled)
**Symptoms:** Pod killed with exit code 137, OOMKilled in events
**Solution:**
```bash
# Increase memory limits
kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi"},"requests":{"memory":"512Mi"}}}]}}}}'

# Monitor memory usage
kubectl top pods -n dhakacart -l app=dhakacart-backend
```

#### 2. Application Startup Failure
**Symptoms:** Application exits immediately, configuration errors in logs
**Solution:**
```bash
# Check environment variables
kubectl exec -n dhakacart deployment/dhakacart-backend -- env | grep -E "(DB_|REDIS_|NODE_)"

# Verify secrets and configmaps
kubectl get secrets -n dhakacart
kubectl get configmaps -n dhakacart

# Check if required services are available
kubectl get svc -n dhakacart
```

#### 3. Liveness Probe Failure
**Symptoms:** Pod restarts due to failed liveness probes
**Solution:**
```bash
# Check liveness probe configuration
kubectl describe deployment dhakacart-backend -n dhakacart | grep -A 10 "Liveness"

# Test health endpoint manually
kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -f http://localhost:5000/health

# Temporarily disable liveness probe
kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","livenessProbe":null}]}}}}'
```

#### 4. Image Pull Issues
**Symptoms:** ImagePullBackOff, ErrImagePull in pod status
**Solution:**
```bash
# Check image name and tag
kubectl describe deployment dhakacart-backend -n dhakacart | grep Image

# Verify image exists in registry
docker pull dhakacart/backend:latest

# Check image pull secrets
kubectl get secrets -n dhakacart | grep docker
```

#### 5. Database Connection Failure
**Symptoms:** Database connection errors in logs
**Solution:**
```bash
# Check database connectivity
kubectl exec -n dhakacart deployment/dhakacart-backend -- nc -zv postgres-service 5432

# Verify database credentials
kubectl get secret db-credentials -n dhakacart -o yaml

# Check database service status
kubectl get pods -n dhakacart -l app=postgres
```

### Recovery Actions

1. **For Memory Issues:**
   ```bash
   # Scale down temporarily to reduce load
   kubectl scale deployment/dhakacart-backend --replicas=2 -n dhakacart
   
   # Increase memory limits
   kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"2Gi"},"requests":{"memory":"1Gi"}}}]}}}}'
   ```

2. **For Configuration Issues:**
   ```bash
   # Rollback to previous working version
   kubectl rollout undo deployment/dhakacart-backend -n dhakacart
   
   # Monitor rollback
   kubectl rollout status deployment/dhakacart-backend -n dhakacart
   ```

3. **For Probe Issues:**
   ```bash
   # Increase probe timeouts temporarily
   kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","livenessProbe":{"initialDelaySeconds":60,"timeoutSeconds":10}}]}}}}'
   ```

4. **For Image Issues:**
   ```bash
   # Use previous working image
   kubectl set image deployment/dhakacart-backend backend=dhakacart/backend:previous-tag -n dhakacart
   
   # Or rebuild and push image
   docker build -t dhakacart/backend:latest .
   docker push dhakacart/backend:latest
   ```

### Emergency Procedures

1. **If All Pods Are Crashing:**
   ```bash
   # Scale to zero to stop crash loops
   kubectl scale deployment/dhakacart-backend --replicas=0 -n dhakacart
   
   # Investigate and fix issues
   # Then scale back up
   kubectl scale deployment/dhakacart-backend --replicas=3 -n dhakacart
   ```

2. **If Service is Critical:**
   ```bash
   # Deploy emergency version with minimal functionality
   kubectl set image deployment/dhakacart-backend backend=dhakacart/backend:emergency -n dhakacart
   
   # Or use previous stable version
   kubectl rollout undo deployment/dhakacart-backend -n dhakacart
   ```

### Monitoring Recovery

1. **Watch Pod Status**
   ```bash
   # Monitor pod recovery
   kubectl get pods -n dhakacart -l app=dhakacart-backend -w
   
   # Check restart count decreases
   kubectl get pods -n dhakacart -l app=dhakacart-backend -o custom-columns=NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount
   ```

2. **Verify Functionality**
   ```bash
   # Test application endpoints
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -f http://localhost:5000/health
   kubectl exec -n dhakacart deployment/dhakacart-backend -- curl -f http://localhost:5000/api/products
   ```

### Post-Incident Analysis

1. **Root Cause Analysis**
   - Review deployment history
   - Analyze configuration changes
   - Check resource usage trends
   - Review application logs

2. **Preventive Measures**
   ```bash
   # Implement better resource monitoring
   # Add resource requests and limits
   # Improve health check endpoints
   # Add startup probes for slow-starting applications
   ```

3. **Documentation Updates**
   - Update deployment procedures
   - Document configuration requirements
   - Update monitoring thresholds

### Escalation

**Escalate immediately if:**
- Multiple services are affected
- Rollback doesn't resolve the issue
- Infrastructure problems are suspected
- Business impact is severe

**Contact Information:**
- Platform Team: platform@dhakacart.com
- Senior Engineer: +880-XXX-XXXX
- Infrastructure Team: infra@dhakacart.com

### Prevention Checklist

- [ ] Resource requests and limits properly set
- [ ] Health check endpoints implemented and tested
- [ ] Startup probes configured for slow-starting apps
- [ ] Image tags are immutable (not using :latest)
- [ ] Configuration validated before deployment
- [ ] Rollback procedures tested
- [ ] Monitoring alerts configured

### Related Runbooks
- [High Memory Usage](./high-memory-usage.md)
- [Database Issues](./database-issues.md)
- [Pod Not Ready](./pod-not-ready.md)