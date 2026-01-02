# Scaling Procedures

**Severity**: P2-P3 (Operational)
**Last Updated**: 2024-12-30
**Owner**: DevOps Team
**Review Date**: 2025-03-30

## Overview
This runbook provides procedures for scaling the DhakaCart platform components both horizontally (adding more instances) and vertically (increasing resource allocation). It covers manual scaling for immediate needs and automatic scaling configuration.

## Scaling Strategies

### Horizontal Scaling (Scale Out)
- Adding more pod replicas
- Increasing node count
- Adding read replicas for databases

### Vertical Scaling (Scale Up)
- Increasing CPU/memory limits
- Upgrading instance types
- Increasing storage capacity

## Application Scaling

### 1. Backend API Scaling

#### Manual Horizontal Scaling
```bash
# Check current replica count
kubectl get deployment dhakacart-backend -n dhakacart

# Scale up backend pods
kubectl scale deployment dhakacart-backend --replicas=8 -n dhakacart

# Monitor scaling progress
kubectl rollout status deployment/dhakacart-backend -n dhakacart

# Verify new pods are running
kubectl get pods -n dhakacart -l app=dhakacart-backend

# Check resource usage after scaling
kubectl top pods -n dhakacart -l app=dhakacart-backend
```

#### Vertical Scaling (Resource Limits)
```bash
# Update resource limits
kubectl patch deployment dhakacart-backend -n dhakacart -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "requests": {
              "memory": "512Mi",
              "cpu": "500m"
            },
            "limits": {
              "memory": "1Gi",
              "cpu": "1000m"
            }
          }
        }]
      }
    }
  }
}'

# Monitor rollout
kubectl rollout status deployment/dhakacart-backend -n dhakacart
```

#### Auto-scaling Configuration
```bash
# Create or update HPA
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dhakacart-backend-hpa
  namespace: dhakacart
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dhakacart-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
EOF

# Check HPA status
kubectl get hpa dhakacart-backend-hpa -n dhakacart
kubectl describe hpa dhakacart-backend-hpa -n dhakacart
```

### 2. Frontend Scaling

#### Manual Scaling
```bash
# Scale frontend pods
kubectl scale deployment dhakacart-frontend --replicas=6 -n dhakacart

# Monitor scaling
kubectl rollout status deployment/dhakacart-frontend -n dhakacart

# Verify load balancer targets
aws elbv2 describe-target-health --target-group-arn $(kubectl get ingress dhakacart-ingress -n dhakacart -o jsonpath='{.metadata.annotations.alb\.ingress\.kubernetes\.io/target-group-arns}' | cut -d',' -f1)
```

#### CDN Scaling (CloudFront)
```bash
# Check CloudFront distribution status
aws cloudfront get-distribution --id $(aws cloudfront list-distributions --query 'DistributionList.Items[?Comment==`DhakaCart`].Id' --output text)

# Update CloudFront cache behaviors for better performance
aws cloudfront update-distribution --id <distribution-id> --distribution-config file://cloudfront-config.json

# Invalidate cache if needed
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

## Infrastructure Scaling

### 1. Kubernetes Cluster Scaling

#### Node Group Scaling
```bash
# Check current node count
kubectl get nodes

# Scale node group
aws eks update-nodegroup-config \
  --cluster-name dhakacart-cluster \
  --nodegroup-name main \
  --scaling-config minSize=3,maxSize=15,desiredSize=6

# Monitor node scaling
kubectl get nodes -w

# Check cluster autoscaler logs
kubectl logs -n kube-system deployment/cluster-autoscaler --tail=50
```

#### Cluster Autoscaler Configuration
```bash
# Update cluster autoscaler settings
kubectl patch deployment cluster-autoscaler -n kube-system -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "cluster-autoscaler",
          "command": [
            "./cluster-autoscaler",
            "--v=4",
            "--stderrthreshold=info",
            "--cloud-provider=aws",
            "--skip-nodes-with-local-storage=false",
            "--expander=least-waste",
            "--node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/dhakacart-cluster",
            "--balance-similar-node-groups",
            "--scale-down-enabled=true",
            "--scale-down-delay-after-add=10m",
            "--scale-down-unneeded-time=10m",
            "--scale-down-utilization-threshold=0.5"
          ]
        }]
      }
    }
  }
}'
```

### 2. Database Scaling

#### RDS Vertical Scaling
```bash
# Check current RDS instance details
aws rds describe-db-instances --db-instance-identifier dhakacart-db

# Scale up RDS instance (requires brief downtime)
aws rds modify-db-instance \
  --db-instance-identifier dhakacart-db \
  --db-instance-class db.t3.large \
  --apply-immediately

# Monitor scaling progress
aws rds describe-db-instances --db-instance-identifier dhakacart-db --query 'DBInstances[0].DBInstanceStatus'
```

#### Read Replica Scaling
```bash
# Create read replica for read traffic
aws rds create-db-instance-read-replica \
  --db-instance-identifier dhakacart-db-replica-1 \
  --source-db-instance-identifier dhakacart-db \
  --db-instance-class db.t3.medium

# Update application to use read replica for read operations
kubectl patch configmap dhakacart-config -n dhakacart -p '{
  "data": {
    "DB_READ_HOST": "dhakacart-db-replica-1.cluster-xyz.us-west-2.rds.amazonaws.com"
  }
}'

# Restart backend to pick up new configuration
kubectl rollout restart deployment/dhakacart-backend -n dhakacart
```

#### Database Connection Pool Scaling
```bash
# Update connection pool settings
kubectl patch configmap dhakacart-config -n dhakacart -p '{
  "data": {
    "DB_POOL_MAX": "30",
    "DB_POOL_MIN": "5"
  }
}'

# Restart application
kubectl rollout restart deployment/dhakacart-backend -n dhakacart
```

### 3. Cache Scaling (Redis)

#### ElastiCache Vertical Scaling
```bash
# Scale up Redis instance
aws elasticache modify-cache-cluster \
  --cache-cluster-id dhakacart-redis \
  --cache-node-type cache.t3.medium \
  --apply-immediately

# Monitor scaling
aws elasticache describe-cache-clusters --cache-cluster-id dhakacart-redis
```

#### Redis Cluster Scaling (Horizontal)
```bash
# Add more nodes to Redis cluster
aws elasticache modify-replication-group \
  --replication-group-id dhakacart-redis-cluster \
  --num-cache-clusters 4 \
  --apply-immediately

# Update application configuration for cluster mode
kubectl patch configmap dhakacart-config -n dhakacart -p '{
  "data": {
    "REDIS_CLUSTER_MODE": "true",
    "REDIS_CLUSTER_ENDPOINTS": "dhakacart-redis-cluster.xyz.cache.amazonaws.com:6379"
  }
}'
```

## Monitoring During Scaling

### Key Metrics to Watch
```bash
# CPU and Memory usage
kubectl top nodes
kubectl top pods -n dhakacart

# Request rate and response time
# Access Grafana dashboard or use Prometheus queries:
# rate(http_requests_total[5m])
# histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Database connections
# pg_stat_database_numbackends

# Queue depth (if applicable)
# Check application-specific metrics
```

### Scaling Verification
```bash
# Verify pod distribution across nodes
kubectl get pods -n dhakacart -o wide

# Check HPA status
kubectl get hpa -n dhakacart

# Verify load balancer health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# Test application performance
curl -w "@curl-format.txt" -o /dev/null -s "https://dhakacart.com/api/products"
```

## Scaling Scenarios

### Scenario 1: Traffic Spike (Black Friday)

#### Pre-event Scaling
```bash
# Scale up 2 hours before event
kubectl scale deployment dhakacart-backend --replicas=15 -n dhakacart
kubectl scale deployment dhakacart-frontend --replicas=10 -n dhakacart

# Scale up database
aws rds modify-db-instance --db-instance-identifier dhakacart-db --db-instance-class db.r5.xlarge --apply-immediately

# Scale up Redis
aws elasticache modify-cache-cluster --cache-cluster-id dhakacart-redis --cache-node-type cache.r5.large --apply-immediately

# Update HPA for higher limits
kubectl patch hpa dhakacart-backend-hpa -n dhakacart -p '{"spec":{"maxReplicas":50}}'
```

#### During Event Monitoring
```bash
# Monitor every 5 minutes
watch -n 300 'kubectl top pods -n dhakacart && kubectl get hpa -n dhakacart'

# Check error rates
# Monitor Grafana dashboards for error rates and response times

# Scale manually if auto-scaling is not keeping up
kubectl scale deployment dhakacart-backend --replicas=25 -n dhakacart
```

#### Post-event Scale Down
```bash
# Scale down gradually after event
kubectl scale deployment dhakacart-backend --replicas=8 -n dhakacart
kubectl scale deployment dhakacart-frontend --replicas=4 -n dhakacart

# Scale down database (during maintenance window)
aws rds modify-db-instance --db-instance-identifier dhakacart-db --db-instance-class db.t3.large --apply-immediately

# Reset HPA limits
kubectl patch hpa dhakacart-backend-hpa -n dhakacart -p '{"spec":{"maxReplicas":20}}'
```

### Scenario 2: Performance Degradation

#### Investigation and Scaling
```bash
# Check resource utilization
kubectl top nodes
kubectl top pods -n dhakacart

# Identify bottleneck
# If CPU bound: Scale horizontally
kubectl scale deployment dhakacart-backend --replicas=12 -n dhakacart

# If memory bound: Scale vertically
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

# If database bound: Add read replica or scale up
aws rds create-db-instance-read-replica --db-instance-identifier dhakacart-db-replica-2 --source-db-instance-identifier dhakacart-db
```

## Capacity Planning

### Growth Projections
```bash
# Analyze historical metrics (last 30 days)
# Use Prometheus queries to get average resource usage:
# avg_over_time(rate(http_requests_total[5m])[30d])
# avg_over_time(container_memory_usage_bytes[30d])

# Calculate growth rate
# Project future resource needs based on business growth
```

### Resource Recommendations

#### Small Load (< 1000 concurrent users)
- Backend: 3-5 replicas, 256Mi memory, 250m CPU
- Frontend: 2-3 replicas, 128Mi memory, 100m CPU
- Database: db.t3.medium
- Redis: cache.t3.micro

#### Medium Load (1000-10000 concurrent users)
- Backend: 5-15 replicas, 512Mi memory, 500m CPU
- Frontend: 3-8 replicas, 256Mi memory, 200m CPU
- Database: db.r5.large with read replica
- Redis: cache.r5.large

#### High Load (> 10000 concurrent users)
- Backend: 15-50 replicas, 1Gi memory, 1000m CPU
- Frontend: 8-20 replicas, 512Mi memory, 500m CPU
- Database: db.r5.xlarge with multiple read replicas
- Redis: cache.r5.xlarge cluster mode

## Cost Optimization

### Right-sizing Resources
```bash
# Analyze resource usage over time
kubectl top pods -n dhakacart --sort-by=cpu
kubectl top pods -n dhakacart --sort-by=memory

# Use Vertical Pod Autoscaler recommendations
kubectl describe vpa dhakacart-backend-vpa -n dhakacart
```

### Spot Instance Usage
```bash
# Configure spot instances for non-critical workloads
aws eks create-nodegroup \
  --cluster-name dhakacart-cluster \
  --nodegroup-name spot-nodes \
  --capacity-type SPOT \
  --instance-types t3.medium,t3a.medium,t2.medium \
  --scaling-config minSize=0,maxSize=10,desiredSize=2

# Add node affinity for spot instances
kubectl patch deployment dhakacart-backend -n dhakacart -p '{
  "spec": {
    "template": {
      "spec": {
        "affinity": {
          "nodeAffinity": {
            "preferredDuringSchedulingIgnoredDuringExecution": [{
              "weight": 50,
              "preference": {
                "matchExpressions": [{
                  "key": "eks.amazonaws.com/capacityType",
                  "operator": "In",
                  "values": ["SPOT"]
                }]
              }
            }]
          }
        }
      }
    }
  }
}'
```

## Rollback Procedures

### Scaling Rollback
```bash
# If scaling causes issues, rollback quickly
kubectl scale deployment dhakacart-backend --replicas=3 -n dhakacart
kubectl scale deployment dhakacart-frontend --replicas=2 -n dhakacart

# Rollback resource limits
kubectl patch deployment dhakacart-backend -n dhakacart -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "requests": {
              "memory": "256Mi",
              "cpu": "250m"
            },
            "limits": {
              "memory": "512Mi",
              "cpu": "500m"
            }
          }
        }]
      }
    }
  }
}'

# Monitor rollback
kubectl rollout status deployment/dhakacart-backend -n dhakacart
```

## Related Documentation
- [Performance Issues](../troubleshooting/performance-issues.md)
- [System Outage Response](../emergency/system-outage.md)
- [Capacity Planning](../maintenance/capacity-planning.md)
- [Cost Optimization Guide](../maintenance/cost-optimization.md)