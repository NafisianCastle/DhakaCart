# DhakaCart Kubernetes Deployment

This directory contains all the Kubernetes manifests and configurations needed to deploy DhakaCart to a production Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (EKS recommended for AWS)
- kubectl configured to access your cluster
- Container images built and pushed to a registry
- Database (RDS PostgreSQL) and cache (ElastiCache Redis) services running
- Proper IAM roles and permissions for AWS services

## Directory Structure

```
kubernetes/
├── namespace.yaml                    # Namespace definition
├── configmap.yaml                   # Application configuration
├── deployments/                     # Application deployments
│   ├── frontend-deployment.yaml
│   └── backend-deployment.yaml
├── services/                        # Kubernetes services
│   ├── frontend-service.yaml
│   └── backend-service.yaml
├── autoscaling/                     # Auto-scaling configurations
│   ├── frontend-hpa.yaml           # Horizontal Pod Autoscaler
│   ├── backend-hpa.yaml
│   ├── frontend-vpa.yaml           # Vertical Pod Autoscaler
│   ├── backend-vpa.yaml
│   └── cluster-autoscaler.yaml     # Cluster-level autoscaling
├── ingress/                         # Ingress configurations
│   ├── aws-load-balancer-controller.yaml
│   ├── dhakacart-ingress.yaml      # ALB ingress
│   ├── rate-limiting-config.yaml   # Nginx ingress with rate limiting
│   └── cert-manager-issuer.yaml    # SSL certificate management
├── policies/                        # Kubernetes policies
│   └── pod-disruption-budgets.yaml
├── deploy.sh                        # Bash deployment script
├── deploy.ps1                       # PowerShell deployment script
└── README.md                        # This file
```

## Quick Deployment

### 1. Create Secrets

Before deploying, create the required secrets:

```bash
kubectl create secret generic dhakacart-secrets --namespace=dhakacart \
  --from-literal=db-host=<RDS_ENDPOINT> \
  --from-literal=db-port=5432 \
  --from-literal=db-name=dhakacartdb \
  --from-literal=db-user=<DB_USER> \
  --from-literal=db-password=<DB_PASSWORD> \
  --from-literal=redis-host=<REDIS_ENDPOINT> \
  --from-literal=redis-port=6379
```

### 2. Deploy Using Script

**Linux/macOS:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Windows PowerShell:**
```powershell
.\deploy.ps1 -IngressType alb
```

### 3. Manual Deployment

If you prefer manual deployment:

```bash
# 1. Create namespace and config
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml

# 2. Deploy applications
kubectl apply -f deployments/
kubectl apply -f services/

# 3. Set up autoscaling
kubectl apply -f autoscaling/frontend-hpa.yaml
kubectl apply -f autoscaling/backend-hpa.yaml

# 4. Apply policies
kubectl apply -f policies/

# 5. Set up ingress (choose one)
kubectl apply -f ingress/dhakacart-ingress.yaml  # For ALB
# OR
kubectl apply -f ingress/rate-limiting-config.yaml  # For Nginx
```

## Configuration Details

### Resource Limits

**Frontend:**
- Requests: 128Mi memory, 100m CPU
- Limits: 256Mi memory, 200m CPU
- Replicas: 3-20 (auto-scaling)

**Backend:**
- Requests: 256Mi memory, 250m CPU
- Limits: 512Mi memory, 500m CPU
- Replicas: 3-50 (auto-scaling)

### Health Checks

Both frontend and backend include:
- **Liveness Probe**: Restarts unhealthy containers
- **Readiness Probe**: Removes unhealthy pods from service
- **Startup Probe**: Handles slow-starting containers (backend only)

### Auto-scaling

**Horizontal Pod Autoscaler (HPA):**
- CPU threshold: 70%
- Memory threshold: 80%
- Scale-up: Fast (60s stabilization)
- Scale-down: Conservative (300s stabilization)

**Vertical Pod Autoscaler (VPA):**
- Automatically adjusts resource requests/limits
- Requires VPA controller to be installed

**Cluster Autoscaler:**
- Automatically scales worker nodes
- Requires proper IAM roles and node group tags

### Ingress Options

#### AWS Application Load Balancer (ALB)
- Internet-facing load balancer
- SSL termination with ACM certificates
- Health checks and access logging
- Path-based routing (/api → backend, / → frontend)

#### Nginx Ingress Controller
- Rate limiting per IP and endpoint
- SSL with Let's Encrypt certificates
- Custom nginx configuration
- Advanced routing rules

### Security Features

- **Non-root containers**: All containers run as non-root users
- **Read-only root filesystem**: Prevents runtime modifications
- **Security contexts**: Dropped capabilities and privilege escalation prevention
- **Pod Security Standards**: Enforced through security contexts
- **Network policies**: Can be added for pod-to-pod communication restrictions

## Monitoring and Observability

The deployment includes annotations for:
- **Prometheus scraping**: Backend metrics collection
- **Health check endpoints**: /health and /ready
- **Resource monitoring**: CPU, memory, and custom metrics

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n dhakacart
kubectl describe pod <pod-name> -n dhakacart
```

### View Logs
```bash
kubectl logs -f deployment/dhakacart-backend -n dhakacart
kubectl logs -f deployment/dhakacart-frontend -n dhakacart
```

### Check Services and Ingress
```bash
kubectl get svc -n dhakacart
kubectl get ingress -n dhakacart
kubectl describe ingress dhakacart-ingress -n dhakacart
```

### Scale Manually
```bash
kubectl scale deployment dhakacart-backend --replicas=5 -n dhakacart
```

### Check HPA Status
```bash
kubectl get hpa -n dhakacart
kubectl describe hpa dhakacart-backend-hpa -n dhakacart
```

## Production Considerations

1. **Image Tags**: Use specific version tags instead of `latest`
2. **Resource Limits**: Adjust based on actual usage patterns
3. **Backup Strategy**: Ensure database and persistent volume backups
4. **Monitoring**: Set up comprehensive monitoring and alerting
5. **Security Scanning**: Regularly scan container images for vulnerabilities
6. **Network Policies**: Implement network segmentation
7. **RBAC**: Set up proper role-based access control
8. **Secrets Management**: Use external secret management systems
9. **Disaster Recovery**: Test failover procedures regularly
10. **Performance Testing**: Validate auto-scaling behavior under load

## Updates and Rollbacks

### Rolling Updates
The deployments use `RollingUpdate` strategy with:
- `maxSurge: 1`: One extra pod during updates
- `maxUnavailable: 0`: No downtime during updates

### Rollback
```bash
kubectl rollout undo deployment/dhakacart-backend -n dhakacart
kubectl rollout status deployment/dhakacart-backend -n dhakacart
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Kubernetes events: `kubectl get events -n dhakacart`
3. Check application logs for specific error messages
4. Verify external dependencies (database, Redis, DNS)