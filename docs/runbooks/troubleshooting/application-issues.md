# Application Issues Troubleshooting Guide

**Severity**: P1-P3 (Varies)
**Last Updated**: 2024-12-30
**Owner**: Development Team
**Review Date**: 2025-03-30

## Overview
This runbook covers common application-level issues in the DhakaCart platform, including API errors, frontend problems, authentication issues, and performance degradation.

## Common Application Issues

### 1. API Returning 500 Internal Server Errors

#### Symptoms
- Backend API returns 500 status codes
- Error rate spike in monitoring dashboards
- Application logs show unhandled exceptions
- Users unable to complete transactions

#### Investigation Steps
```bash
# Check recent application logs
kubectl logs deployment/dhakacart-backend -n dhakacart --tail=100 | grep -i error

# Check for recent deployments
kubectl rollout history deployment/dhakacart-backend -n dhakacart

# Check pod resource usage
kubectl top pods -n dhakacart
kubectl describe pods -n dhakacart | grep -A 10 "Limits\|Requests"

# Check application health endpoint
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- curl localhost:5000/health
```

#### Resolution Steps
```bash
# If caused by recent deployment, rollback
kubectl rollout undo deployment/dhakacart-backend -n dhakacart
kubectl rollout status deployment/dhakacart-backend -n dhakacart

# If resource exhaustion, scale up
kubectl scale deployment dhakacart-backend --replicas=5 -n dhakacart

# If database connection issues
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run db:check

# Restart pods if needed
kubectl rollout restart deployment/dhakacart-backend -n dhakacart
```

### 2. Frontend Application Not Loading

#### Symptoms
- Users see blank page or loading spinner
- Browser console shows JavaScript errors
- CDN/static assets not loading
- Network errors in browser developer tools

#### Investigation Steps
```bash
# Check frontend pod status
kubectl get pods -n dhakacart -l app=dhakacart-frontend

# Check frontend logs
kubectl logs deployment/dhakacart-frontend -n dhakacart --tail=50

# Check ingress configuration
kubectl describe ingress dhakacart-ingress -n dhakacart

# Test frontend service directly
kubectl port-forward svc/dhakacart-frontend 8080:80 -n dhakacart
# Then test: curl http://localhost:8080
```

#### Resolution Steps
```bash
# Check if backend API is accessible from frontend
kubectl exec -it deployment/dhakacart-frontend -n dhakacart -- curl dhakacart-backend:5000/health

# Restart frontend pods
kubectl rollout restart deployment/dhakacart-frontend -n dhakacart

# If ingress issues, recreate ingress
kubectl delete ingress dhakacart-ingress -n dhakacart
kubectl apply -f kubernetes/ingress/dhakacart-ingress.yaml

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn $(kubectl get ingress dhakacart-ingress -n dhakacart -o jsonpath='{.metadata.annotations.alb\.ingress\.kubernetes\.io/target-group-arns}')
```

### 3. Authentication/Authorization Issues

#### Symptoms
- Users cannot log in
- JWT token validation errors
- Session timeouts
- Unauthorized access errors (401/403)

#### Investigation Steps
```bash
# Check authentication service logs
kubectl logs deployment/dhakacart-backend -n dhakacart | grep -i "auth\|jwt\|login"

# Check JWT secret configuration
kubectl get secret dhakacart-jwt-secret -n dhakacart -o yaml

# Test JWT token generation
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({userId: 'test'}, process.env.JWT_SECRET, {expiresIn: '1h'});
console.log('Token generated:', token);
const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log('Token verified:', decoded);
"
```

#### Resolution Steps
```bash
# If JWT secret is corrupted, regenerate
kubectl delete secret dhakacart-jwt-secret -n dhakacart
kubectl create secret generic dhakacart-jwt-secret -n dhakacart --from-literal=secret=$(openssl rand -base64 32)
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Clear Redis sessions if needed
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST FLUSHDB

# Check session storage
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST KEYS "session:*"
```

### 4. Database Connection Issues

#### Symptoms
- Database connection timeouts
- Connection pool exhaustion
- Slow query performance
- Transaction deadlocks

#### Investigation Steps
```bash
# Check database connectivity
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run db:check

# Check connection pool status
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- node -e "
const { Pool } = require('pg');
const pool = new Pool();
console.log('Total connections:', pool.totalCount);
console.log('Idle connections:', pool.idleCount);
console.log('Waiting clients:', pool.waitingCount);
"

# Check RDS instance metrics
aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name DatabaseConnections --dimensions Name=DBInstanceIdentifier,Value=dhakacart-db --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 300 --statistics Average
```

#### Resolution Steps
```bash
# Restart application to reset connection pool
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Scale up RDS instance if needed
aws rds modify-db-instance --db-instance-identifier dhakacart-db --db-instance-class db.t3.medium --apply-immediately

# Check for long-running queries
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
"

# Kill long-running queries if necessary
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT pg_terminate_backend(<pid>);"
```

### 5. Cache/Redis Issues

#### Symptoms
- Cache misses causing slow performance
- Redis connection errors
- Session data loss
- Memory usage spikes

#### Investigation Steps
```bash
# Check Redis connectivity
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST ping

# Check Redis memory usage
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST info memory

# Check Redis connection count
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST info clients

# Check for Redis errors in application logs
kubectl logs deployment/dhakacart-backend -n dhakacart | grep -i redis
```

#### Resolution Steps
```bash
# Restart Redis cluster (ElastiCache)
aws elasticache reboot-cache-cluster --cache-cluster-id dhakacart-redis

# Clear Redis cache if corrupted
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- redis-cli -h $REDIS_HOST FLUSHALL

# Scale up Redis instance
aws elasticache modify-cache-cluster --cache-cluster-id dhakacart-redis --cache-node-type cache.t3.medium --apply-immediately

# Check Redis configuration
aws elasticache describe-cache-parameters --cache-parameter-group-name dhakacart-redis-params
```

## Performance Issues

### 1. High Response Times

#### Investigation Steps
```bash
# Check application metrics
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access Prometheus at localhost:9090 and query:
# histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Check resource usage
kubectl top pods -n dhakacart
kubectl top nodes

# Check database performance
aws rds describe-db-instances --db-instance-identifier dhakacart-db --query 'DBInstances[0].{CPUUtilization:ProcessorFeatures,IOPS:Iops}'
```

#### Resolution Steps
```bash
# Scale application horizontally
kubectl scale deployment dhakacart-backend --replicas=8 -n dhakacart

# Optimize database queries
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
"

# Add database indexes if needed
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
CREATE INDEX CONCURRENTLY idx_products_category_active ON products(category_id, is_active);
"
```

### 2. Memory Leaks

#### Investigation Steps
```bash
# Monitor memory usage over time
kubectl top pods -n dhakacart --sort-by=memory

# Check for memory leaks in Node.js
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- node --expose-gc -e "
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory usage:', JSON.stringify(used));
  global.gc();
}, 5000);
"

# Check application logs for out-of-memory errors
kubectl logs deployment/dhakacart-backend -n dhakacart | grep -i "memory\|oom"
```

#### Resolution Steps
```bash
# Increase memory limits temporarily
kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi"}}}]}}}}'

# Restart pods to clear memory
kubectl rollout restart deployment/dhakacart-backend -n dhakacart

# Enable garbage collection logging
kubectl patch deployment dhakacart-backend -n dhakacart -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","env":[{"name":"NODE_OPTIONS","value":"--max-old-space-size=512 --gc-interval=100"}]}]}}}}'
```

## Error Code Reference

### HTTP Status Codes
- **400 Bad Request**: Invalid request format or parameters
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Application error
- **502 Bad Gateway**: Load balancer cannot reach backend
- **503 Service Unavailable**: Service temporarily unavailable
- **504 Gateway Timeout**: Request timeout

### Application Error Codes
- **AUTH_001**: Invalid JWT token
- **AUTH_002**: Token expired
- **AUTH_003**: Insufficient permissions
- **DB_001**: Database connection failed
- **DB_002**: Query timeout
- **DB_003**: Transaction deadlock
- **CACHE_001**: Redis connection failed
- **CACHE_002**: Cache operation timeout
- **API_001**: Invalid request format
- **API_002**: Missing required parameters

## Monitoring and Alerting

### Key Metrics to Monitor
```bash
# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Database connections
pg_stat_database_numbackends

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes

# CPU usage
rate(container_cpu_usage_seconds_total[5m])
```

### Alert Thresholds
- **Error Rate**: > 5% for 5 minutes
- **Response Time**: > 2 seconds (95th percentile) for 5 minutes
- **Memory Usage**: > 80% for 10 minutes
- **CPU Usage**: > 80% for 10 minutes
- **Database Connections**: > 80% of max for 5 minutes

## Prevention Measures

### Code Quality
- Implement comprehensive error handling
- Add input validation and sanitization
- Use connection pooling for database and Redis
- Implement circuit breakers for external services
- Add proper logging and monitoring

### Testing
- Unit tests with >80% coverage
- Integration tests for API endpoints
- Load testing for performance validation
- Chaos engineering for resilience testing

### Monitoring
- Application performance monitoring (APM)
- Real user monitoring (RUM)
- Synthetic monitoring for critical paths
- Log aggregation and analysis

## Related Documentation
- [Performance Issues](performance-issues.md)
- [Database Issues](database-issues.md)
- [System Outage Response](../emergency/system-outage.md)
- [Scaling Procedures](../operations/scaling.md)