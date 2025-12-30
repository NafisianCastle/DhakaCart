# Task 11.2: Deploy and Test Applications

## Overview

This guide provides comprehensive instructions for building container images, pushing them to ECR, deploying applications to Kubernetes, and validating their functionality. The deployment includes both frontend (React) and backend (Node.js) applications with proper health checks, resource limits, and security configurations.

## Prerequisites

Before deploying applications, ensure you have:

1. **Infrastructure deployed** (Task 11.1 completed)
2. **Docker** installed and running
3. **AWS CLI** configured with ECR permissions
4. **kubectl** configured for your EKS cluster
5. **Terraform outputs** available (`terraform-outputs.json`)

## Application Architecture

### Frontend (React)
- **Technology**: React with nginx for serving
- **Port**: 8080
- **Health Check**: `/health` endpoint
- **Security**: Non-root user, read-only filesystem
- **Resources**: 128Mi-256Mi memory, 100m-200m CPU

### Backend (Node.js)
- **Technology**: Node.js with Express
- **Port**: 5000
- **Health Checks**: `/health` and `/ready` endpoints
- **Security**: Non-root user, read-only filesystem
- **Resources**: 256Mi-512Mi memory, 250m-500m CPU

## Deployment Steps

### Step 1: Prepare Container Images

#### Build Frontend Image

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Build the Docker image:
   ```bash
   docker build -t dhakacart-frontend:latest .
   ```

3. Test the image locally (optional):
   ```bash
   docker run -p 8080:8080 dhakacart-frontend:latest
   # Test: curl http://localhost:8080/health
   ```

#### Build Backend Image

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Build the Docker image:
   ```bash
   docker build -t dhakacart-backend:latest .
   ```

3. Test the image locally (optional):
   ```bash
   docker run -p 5000:5000 -e NODE_ENV=development dhakacart-backend:latest
   # Test: curl http://localhost:5000/health
   ```

### Step 2: Push Images to ECR

#### Get ECR Repository URLs

1. Extract ECR URLs from Terraform outputs:
   ```bash
   FRONTEND_REPO=$(jq -r '.ecr_frontend_repository_url.value' terraform-outputs.json)
   BACKEND_REPO=$(jq -r '.ecr_backend_repository_url.value' terraform-outputs.json)
   
   echo "Frontend ECR: $FRONTEND_REPO"
   echo "Backend ECR: $BACKEND_REPO"
   ```

#### Login to ECR

1. Get ECR login token:
   ```bash
   aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $FRONTEND_REPO
   ```

#### Tag and Push Images

1. Tag and push frontend image:
   ```bash
   docker tag dhakacart-frontend:latest $FRONTEND_REPO:latest
   docker tag dhakacart-frontend:latest $FRONTEND_REPO:v1.0.0
   docker push $FRONTEND_REPO:latest
   docker push $FRONTEND_REPO:v1.0.0
   ```

2. Tag and push backend image:
   ```bash
   docker tag dhakacart-backend:latest $BACKEND_REPO:latest
   docker tag dhakacart-backend:latest $BACKEND_REPO:v1.0.0
   docker push $BACKEND_REPO:latest
   docker push $BACKEND_REPO:v1.0.0
   ```

### Step 3: Configure Kubernetes Resources

#### Create Namespace

1. Apply the namespace configuration:
   ```bash
   kubectl apply -f kubernetes/namespace.yaml
   ```

#### Configure Secrets

1. Get database and Redis connection details:
   ```bash
   DB_ENDPOINT=$(jq -r '.rds_instance_endpoint.value' terraform-outputs.json)
   DB_NAME=$(jq -r '.rds_db_name.value' terraform-outputs.json)
   REDIS_ENDPOINT=$(jq -r '.redis_primary_endpoint_address.value' terraform-outputs.json)
   REDIS_PORT=$(jq -r '.redis_port.value' terraform-outputs.json)
   ```

2. Create secrets manifest:
   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: dhakacart-secrets
     namespace: dhakacart
   type: Opaque
   stringData:
     db-host: "$DB_ENDPOINT"
     db-port: "5432"
     db-name: "$DB_NAME"
     db-user: "dhakacart_admin"
     db-password: "YOUR_ACTUAL_PASSWORD"  # Get from AWS Secrets Manager
     redis-host: "$REDIS_ENDPOINT"
     redis-port: "$REDIS_PORT"
   ```

3. Apply the secrets:
   ```bash
   kubectl apply -f secrets.yaml
   ```

**Important**: Replace `YOUR_ACTUAL_PASSWORD` with the actual database password from AWS Secrets Manager.

#### Apply ConfigMap

1. Apply the configuration:
   ```bash
   kubectl apply -f kubernetes/configmap.yaml
   ```

### Step 4: Deploy Applications

#### Update Deployment Manifests

1. Update image references in deployment files to use your ECR URLs:
   
   **Frontend Deployment** (`kubernetes/deployments/frontend-deployment.yaml`):
   ```yaml
   spec:
     template:
       spec:
         containers:
         - name: frontend
           image: YOUR_FRONTEND_ECR_URL:latest  # Replace with actual ECR URL
   ```
   
   **Backend Deployment** (`kubernetes/deployments/backend-deployment.yaml`):
   ```yaml
   spec:
     template:
       spec:
         containers:
         - name: backend
           image: YOUR_BACKEND_ECR_URL:latest  # Replace with actual ECR URL
   ```

#### Deploy Applications

1. Deploy frontend:
   ```bash
   kubectl apply -f kubernetes/deployments/frontend-deployment.yaml
   kubectl apply -f kubernetes/services/frontend-service.yaml
   ```

2. Deploy backend:
   ```bash
   kubectl apply -f kubernetes/deployments/backend-deployment.yaml
   kubectl apply -f kubernetes/services/backend-service.yaml
   ```

#### Wait for Deployments

1. Monitor deployment progress:
   ```bash
   kubectl rollout status deployment/dhakacart-frontend -n dhakacart
   kubectl rollout status deployment/dhakacart-backend -n dhakacart
   ```

2. Check pod status:
   ```bash
   kubectl get pods -n dhakacart -o wide
   ```

### Step 5: Validate Application Deployment

#### Check Pod Health

1. Verify all pods are running:
   ```bash
   kubectl get pods -n dhakacart
   ```

2. Check pod logs for errors:
   ```bash
   kubectl logs -l app=dhakacart-frontend -n dhakacart
   kubectl logs -l app=dhakacart-backend -n dhakacart
   ```

#### Test Health Endpoints

1. Test backend health endpoint:
   ```bash
   BACKEND_POD=$(kubectl get pods -n dhakacart -l app=dhakacart-backend -o jsonpath='{.items[0].metadata.name}')
   kubectl exec -n dhakacart $BACKEND_POD -- curl -s http://localhost:5000/health
   ```

2. Test frontend health endpoint:
   ```bash
   FRONTEND_POD=$(kubectl get pods -n dhakacart -l app=dhakacart-frontend -o jsonpath='{.items[0].metadata.name}')
   kubectl exec -n dhakacart $FRONTEND_POD -- wget -q -O - http://localhost:8080/health
   ```

#### Test Service Connectivity

1. Test backend service:
   ```bash
   kubectl run test-pod --image=curlimages/curl:latest --rm -i --restart=Never -n dhakacart -- curl -s http://dhakacart-backend-service:5000/health
   ```

2. Test frontend service:
   ```bash
   kubectl run test-pod --image=curlimages/curl:latest --rm -i --restart=Never -n dhakacart -- curl -s http://dhakacart-frontend-service/health
   ```

#### Verify Database Connectivity

1. Test database connection from backend pod:
   ```bash
   kubectl exec -n dhakacart $BACKEND_POD -- node -e "
   const { Pool } = require('pg');
   const pool = new Pool({
     host: process.env.DB_HOST,
     port: process.env.DB_PORT,
     database: process.env.DB_NAME,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD
   });
   pool.query('SELECT 1').then(() => {
     console.log('Database connection successful');
     process.exit(0);
   }).catch(err => {
     console.error('Database connection failed:', err.message);
     process.exit(1);
   });"
   ```

#### Verify Redis Connectivity

1. Test Redis connection from backend pod:
   ```bash
   kubectl exec -n dhakacart $BACKEND_POD -- node -e "
   const redis = require('redis');
   const client = redis.createClient({
     host: process.env.REDIS_HOST,
     port: process.env.REDIS_PORT
   });
   client.on('connect', () => {
     console.log('Redis connection successful');
     client.quit();
   });
   client.on('error', (err) => {
     console.error('Redis connection failed:', err.message);
     process.exit(1);
   });"
   ```

## Validation Checklist

Mark each item as complete when validated:

- [ ] Frontend Docker image built successfully
- [ ] Backend Docker image built successfully
- [ ] Images pushed to ECR repositories
- [ ] Kubernetes namespace created
- [ ] Secrets configured with database and Redis credentials
- [ ] ConfigMap applied with application configuration
- [ ] Frontend deployment successful with 3 replicas
- [ ] Backend deployment successful with 3 replicas
- [ ] All pods are in Running state
- [ ] Frontend health endpoint responding
- [ ] Backend health endpoint responding
- [ ] Backend ready endpoint responding
- [ ] Services created and accessible within cluster
- [ ] Database connectivity verified from backend pods
- [ ] Redis connectivity verified from backend pods
- [ ] Resource limits and requests configured
- [ ] Security contexts applied (non-root user, read-only filesystem)
- [ ] Liveness and readiness probes working
- [ ] Pod logs show no critical errors

## Expected Results

After successful deployment, you should have:

### Running Pods
```bash
NAME                                   READY   STATUS    RESTARTS   AGE
dhakacart-backend-xxx-xxx              1/1     Running   0          5m
dhakacart-backend-xxx-yyy              1/1     Running   0          5m
dhakacart-backend-xxx-zzz              1/1     Running   0          5m
dhakacart-frontend-xxx-xxx             1/1     Running   0          5m
dhakacart-frontend-xxx-yyy             1/1     Running   0          5m
dhakacart-frontend-xxx-zzz             1/1     Running   0          5m
```

### Active Services
```bash
NAME                           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
dhakacart-backend-service      ClusterIP   10.100.xxx.xxx  <none>        5000/TCP   5m
dhakacart-frontend-service     ClusterIP   10.100.xxx.yyy  <none>        80/TCP     5m
```

### Healthy Endpoints
- Backend health: `http://dhakacart-backend-service:5000/health` returns 200
- Backend ready: `http://dhakacart-backend-service:5000/ready` returns 200
- Frontend health: `http://dhakacart-frontend-service/health` returns 200

## Troubleshooting

### Common Issues

1. **Image Pull Errors**:
   - Verify ECR repository URLs are correct
   - Check ECR permissions and authentication
   - Ensure images were pushed successfully

2. **Pod Startup Failures**:
   - Check pod logs: `kubectl logs <pod-name> -n dhakacart`
   - Verify secrets and configmap are created
   - Check resource limits aren't too restrictive

3. **Database Connection Failures**:
   - Verify database endpoint in secrets
   - Check security group rules allow traffic from EKS
   - Ensure database password is correct

4. **Health Check Failures**:
   - Verify health endpoints are implemented in applications
   - Check if applications are binding to correct ports
   - Review application logs for startup errors

### Debugging Commands

1. **Check pod details**:
   ```bash
   kubectl describe pod <pod-name> -n dhakacart
   ```

2. **View pod logs**:
   ```bash
   kubectl logs <pod-name> -n dhakacart -f
   ```

3. **Execute commands in pod**:
   ```bash
   kubectl exec -it <pod-name> -n dhakacart -- /bin/sh
   ```

4. **Check service endpoints**:
   ```bash
   kubectl get endpoints -n dhakacart
   ```

## Security Considerations

- All containers run as non-root users
- Read-only root filesystems prevent runtime modifications
- Secrets are stored in Kubernetes secrets (consider External Secrets Operator for production)
- Network policies should be implemented to restrict pod-to-pod communication
- Resource limits prevent resource exhaustion attacks

## Performance Considerations

- Resource requests ensure guaranteed resources
- Resource limits prevent resource hogging
- Multiple replicas provide high availability
- Health checks enable automatic recovery
- Horizontal Pod Autoscaler can scale based on metrics

## Next Steps

Once application deployment is validated:

1. Proceed to Task 11.3: Validate load balancing and auto-scaling
2. Configure ingress controller for external access
3. Set up SSL/TLS termination
4. Test horizontal pod autoscaling behavior
5. Validate cluster autoscaler functionality

This completes the application deployment and testing for Task 11.2.