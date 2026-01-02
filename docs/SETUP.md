# DhakaCart Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [Configuration Management](#configuration-management)
5. [Verification and Testing](#verification-and-testing)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **AWS CLI** >= 2.0
- **Terraform** >= 1.0
- **kubectl** >= 1.24
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Node.js** >= 18.0
- **npm** >= 8.0
- **Git** >= 2.30

### AWS Account Requirements
- AWS account with administrative access
- AWS CLI configured with appropriate credentials
- Sufficient service limits for EKS, RDS, and ElastiCache
- Domain name registered (optional, for custom domains)

### Installation Commands

#### macOS (using Homebrew)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install awscli terraform kubectl docker docker-compose node git
```

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

#### Windows (using Chocolatey)
```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install required tools
choco install awscli terraform kubernetes-cli docker-desktop nodejs git
```

## Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/dhakacart.git
cd dhakacart
```

### 2. Environment Configuration

#### Backend Environment
```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit backend/.env with your configuration
cat > backend/.env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dhakacart
DB_USER=postgres
DB_PASSWORD=postgres123

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application Configuration
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
API_RATE_LIMIT=100

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
EOF
```

#### Frontend Environment
```bash
# Copy environment template
cp frontend/.env.example frontend/.env

# Edit frontend/.env
cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENVIRONMENT=development
REACT_APP_LOG_LEVEL=debug
EOF
```

### 3. Start Local Infrastructure
```bash
# Start PostgreSQL and Redis using Docker Compose
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps
```

### 4. Database Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

### 5. Start Development Servers

#### Backend Server
```bash
# In backend directory
npm run dev

# Server should start on http://localhost:5000
# Health check: curl http://localhost:5000/health
```

#### Frontend Server
```bash
# In new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Application should open at http://localhost:3000
```

### 6. Verify Local Setup
```bash
# Test backend API
curl http://localhost:5000/health
curl http://localhost:5000/api/products

# Test frontend (in browser)
# Navigate to http://localhost:3000
# Should see DhakaCart homepage
```

## Production Deployment

### 1. AWS Account Setup

#### Configure AWS CLI
```bash
# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID, Secret Access Key, Region, and Output format

# Verify configuration
aws sts get-caller-identity
```

#### Set Required Environment Variables
```bash
export AWS_REGION=us-west-2
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export CLUSTER_NAME=dhakacart-cluster
export ENVIRONMENT=production
```

### 2. Infrastructure Deployment

#### Initialize Terraform
```bash
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars from template
cp terraform.tfvars.example terraform.tfvars
```

#### Configure Terraform Variables
```bash
# Edit terraform.tfvars
cat > terraform.tfvars << EOF
# Basic Configuration
region = "us-west-2"
environment = "production"
project_name = "dhakacart"

# EKS Configuration
cluster_name = "dhakacart-cluster"
cluster_version = "1.28"
node_instance_types = ["t3.medium"]
node_desired_capacity = 3
node_min_capacity = 2
node_max_capacity = 10

# Database Configuration
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_max_allocated_storage = 100
db_backup_retention_period = 7
db_multi_az = true

# Redis Configuration
redis_node_type = "cache.t3.micro"
redis_num_cache_nodes = 2
redis_parameter_group_name = "default.redis7"

# Networking
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]

# Security
enable_irsa = true
enable_cluster_autoscaler = true
enable_aws_load_balancer_controller = true

# Monitoring
enable_prometheus = true
enable_grafana = true
enable_elk_stack = true

# Backup and DR
backup_retention_days = 30
enable_cross_region_backup = true
dr_region = "us-east-1"
EOF
```

#### Deploy Infrastructure
```bash
# Plan deployment
terraform plan -out=tfplan

# Review the plan carefully
# Apply infrastructure changes
terraform apply tfplan

# Note: This process takes 15-20 minutes
```

#### Configure kubectl
```bash
# Update kubeconfig
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Verify cluster access
kubectl get nodes
kubectl get namespaces
```

### 3. Application Deployment

#### Build and Push Container Images
```bash
# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push backend image
cd backend
docker build -t dhakacart-backend .
docker tag dhakacart-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dhakacart-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dhakacart-backend:latest

# Build and push frontend image
cd ../frontend
docker build -t dhakacart-frontend .
docker tag dhakacart-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dhakacart-frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dhakacart-frontend:latest
```

#### Deploy Kubernetes Resources
```bash
cd kubernetes

# Create namespace
kubectl apply -f namespace.yaml

# Deploy secrets (using External Secrets Operator)
kubectl apply -f external-secrets/

# Deploy applications
kubectl apply -f deployments/
kubectl apply -f services/
kubectl apply -f ingress/

# Deploy monitoring stack
kubectl apply -f monitoring/

# Deploy autoscaling
kubectl apply -f autoscaling/

# Deploy security policies
kubectl apply -f security/
```

#### Verify Deployment
```bash
# Check pod status
kubectl get pods -n dhakacart

# Check services
kubectl get svc -n dhakacart

# Check ingress
kubectl get ingress -n dhakacart

# Get application URL
kubectl get ingress dhakacart-ingress -n dhakacart -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 4. Database Migration
```bash
# Run database migrations using Kubernetes job
kubectl apply -f kubernetes/jobs/db-migration-job.yaml

# Monitor migration progress
kubectl logs -f job/db-migration -n dhakacart

# Verify migration completion
kubectl get job db-migration -n dhakacart
```

## Configuration Management

### Environment-Specific Configurations

#### Development Environment
```yaml
# kubernetes/overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patchesStrategicMerge:
- deployment-patch.yaml
- service-patch.yaml

configMapGenerator:
- name: app-config
  literals:
  - NODE_ENV=development
  - LOG_LEVEL=debug
  - API_RATE_LIMIT=1000
```

#### Production Environment
```yaml
# kubernetes/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patchesStrategicMerge:
- deployment-patch.yaml
- hpa-patch.yaml

configMapGenerator:
- name: app-config
  literals:
  - NODE_ENV=production
  - LOG_LEVEL=info
  - API_RATE_LIMIT=100
```

### Secrets Management

#### Using AWS Secrets Manager
```bash
# Create database secret
aws secretsmanager create-secret \
  --name "dhakacart/database" \
  --description "Database credentials for DhakaCart" \
  --secret-string '{
    "username": "dhakacart_user",
    "password": "your-secure-password",
    "host": "dhakacart-db.cluster-xyz.us-west-2.rds.amazonaws.com",
    "port": "5432",
    "database": "dhakacart"
  }'

# Create Redis secret
aws secretsmanager create-secret \
  --name "dhakacart/redis" \
  --description "Redis credentials for DhakaCart" \
  --secret-string '{
    "host": "dhakacart-redis.xyz.cache.amazonaws.com",
    "port": "6379",
    "auth_token": "your-redis-auth-token"
  }'

# Create JWT secret
aws secretsmanager create-secret \
  --name "dhakacart/jwt" \
  --description "JWT signing key for DhakaCart" \
  --secret-string '{
    "secret": "your-super-secure-jwt-signing-key"
  }'
```

#### External Secrets Operator Configuration
```yaml
# kubernetes/external-secrets/secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: dhakacart
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-west-2
      auth:
        serviceAccount:
          name: external-secrets-sa
```

## Verification and Testing

### Health Checks
```bash
# Application health
curl -f http://your-domain.com/health || echo "Health check failed"

# Database connectivity
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run db:check

# Redis connectivity
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run redis:check
```

### Load Testing
```bash
# Install Artillery.js
npm install -g artillery

# Run load test
artillery run tests/load-test.yml

# Monitor during load test
kubectl top pods -n dhakacart
kubectl get hpa -n dhakacart
```

### Security Testing
```bash
# Run security scan on containers
trivy image $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dhakacart-backend:latest
trivy image $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/dhakacart-frontend:latest

# Check for vulnerabilities in dependencies
cd backend && npm audit
cd frontend && npm audit
```

### Monitoring Verification
```bash
# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80

# Access Grafana at http://localhost:3000
# Default credentials: admin/admin

# Verify Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access Prometheus at http://localhost:9090/targets
```

## Troubleshooting

### Common Issues and Solutions

#### 1. EKS Cluster Access Issues
```bash
# Problem: kubectl commands fail with authentication errors
# Solution: Update kubeconfig
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Verify IAM permissions
aws sts get-caller-identity
aws eks describe-cluster --name $CLUSTER_NAME
```

#### 2. Pod Startup Issues
```bash
# Check pod status
kubectl get pods -n dhakacart

# Describe problematic pod
kubectl describe pod <pod-name> -n dhakacart

# Check pod logs
kubectl logs <pod-name> -n dhakacart

# Common fixes:
# - Check image pull secrets
# - Verify resource limits
# - Check environment variables
# - Validate secrets and configmaps
```

#### 3. Database Connection Issues
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier dhakacart-db

# Test database connectivity from pod
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- bash
# Inside pod:
pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER
```

#### 4. Load Balancer Issues
```bash
# Check ALB status
kubectl describe ingress dhakacart-ingress -n dhakacart

# Check AWS Load Balancer Controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Verify security groups
aws ec2 describe-security-groups --group-names dhakacart-alb-sg
```

#### 5. Monitoring Stack Issues
```bash
# Check Prometheus status
kubectl get pods -n monitoring -l app=prometheus

# Check Grafana status
kubectl get pods -n monitoring -l app=grafana

# Restart monitoring components
kubectl rollout restart deployment/prometheus -n monitoring
kubectl rollout restart deployment/grafana -n monitoring
```

### Log Analysis
```bash
# Application logs
kubectl logs -f deployment/dhakacart-backend -n dhakacart

# System logs
kubectl logs -f daemonset/aws-node -n kube-system

# Ingress controller logs
kubectl logs -f deployment/aws-load-balancer-controller -n kube-system
```

### Performance Debugging
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n dhakacart

# Check HPA status
kubectl get hpa -n dhakacart
kubectl describe hpa dhakacart-backend-hpa -n dhakacart

# Check cluster autoscaler
kubectl logs -f deployment/cluster-autoscaler -n kube-system
```

### Emergency Procedures
```bash
# Scale down application (emergency)
kubectl scale deployment dhakacart-backend --replicas=0 -n dhakacart
kubectl scale deployment dhakacart-frontend --replicas=0 -n dhakacart

# Scale up application
kubectl scale deployment dhakacart-backend --replicas=3 -n dhakacart
kubectl scale deployment dhakacart-frontend --replicas=3 -n dhakacart

# Rollback deployment
kubectl rollout undo deployment/dhakacart-backend -n dhakacart
kubectl rollout undo deployment/dhakacart-frontend -n dhakacart
```

## Next Steps

After successful setup:

1. **Configure Monitoring Alerts**: Set up AlertManager rules and notification channels
2. **Set up CI/CD Pipeline**: Configure GitHub Actions for automated deployments
3. **Performance Tuning**: Optimize resource limits and auto-scaling parameters
4. **Security Hardening**: Implement additional security policies and scanning
5. **Backup Testing**: Verify backup and restore procedures
6. **Documentation**: Update team documentation and runbooks

For detailed operational procedures, see the [Operational Runbooks](runbooks/README.md).