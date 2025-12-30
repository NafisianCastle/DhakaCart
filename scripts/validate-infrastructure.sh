#!/bin/bash

# Infrastructure Validation Script for DhakaCart Cloud Migration
# This script validates the deployment and functionality of all infrastructure components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="terraform"
REGION=${AWS_REGION:-"us-west-2"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}
PROJECT_NAME=${PROJECT_NAME:-"dhakacart"}

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        error "Terraform is not installed"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Initialize and plan Terraform
terraform_init_and_plan() {
    log "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    terraform init
    
    # Create terraform.tfvars if it doesn't exist
    if [ ! -f "terraform.tfvars" ]; then
        warning "terraform.tfvars not found, creating from example..."
        cp terraform.tfvars.example terraform.tfvars
        warning "Please review and update terraform.tfvars with your specific values"
    fi
    
    # Validate Terraform configuration
    terraform validate
    success "Terraform configuration is valid"
    
    # Plan Terraform deployment
    log "Creating Terraform plan..."
    terraform plan -out=tfplan
    success "Terraform plan created successfully"
    
    cd ..
}

# Deploy infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    cd "$TERRAFORM_DIR"
    
    # Apply Terraform configuration
    terraform apply tfplan
    success "Infrastructure deployed successfully"
    
    # Save outputs to file for later use
    terraform output -json > ../terraform-outputs.json
    success "Terraform outputs saved"
    
    cd ..
}

# Validate VPC and networking
validate_vpc_networking() {
    log "Validating VPC and networking configuration..."
    
    # Get VPC ID from Terraform outputs
    VPC_ID=$(jq -r '.vpc_id.value' terraform-outputs.json)
    
    if [ "$VPC_ID" = "null" ] || [ -z "$VPC_ID" ]; then
        error "VPC ID not found in Terraform outputs"
        return 1
    fi
    
    # Check VPC exists
    if aws ec2 describe-vpcs --vpc-ids "$VPC_ID" --region "$REGION" &> /dev/null; then
        success "VPC $VPC_ID exists and is accessible"
    else
        error "VPC $VPC_ID not found or not accessible"
        return 1
    fi
    
    # Check subnets
    PUBLIC_SUBNETS=$(jq -r '.public_subnet_ids.value[]' terraform-outputs.json)
    PRIVATE_APP_SUBNETS=$(jq -r '.private_app_subnet_ids.value[]' terraform-outputs.json)
    PRIVATE_DB_SUBNETS=$(jq -r '.private_db_subnet_ids.value[]' terraform-outputs.json)
    
    for subnet in $PUBLIC_SUBNETS; do
        if aws ec2 describe-subnets --subnet-ids "$subnet" --region "$REGION" &> /dev/null; then
            success "Public subnet $subnet exists"
        else
            error "Public subnet $subnet not found"
            return 1
        fi
    done
    
    for subnet in $PRIVATE_APP_SUBNETS; do
        if aws ec2 describe-subnets --subnet-ids "$subnet" --region "$REGION" &> /dev/null; then
            success "Private app subnet $subnet exists"
        else
            error "Private app subnet $subnet not found"
            return 1
        fi
    done
    
    for subnet in $PRIVATE_DB_SUBNETS; do
        if aws ec2 describe-subnets --subnet-ids "$subnet" --region "$REGION" &> /dev/null; then
            success "Private DB subnet $subnet exists"
        else
            error "Private DB subnet $subnet not found"
            return 1
        fi
    done
    
    # Check NAT Gateways
    NAT_GATEWAYS=$(jq -r '.nat_gateway_ids.value[]?' terraform-outputs.json)
    if [ -n "$NAT_GATEWAYS" ]; then
        for nat in $NAT_GATEWAYS; do
            if aws ec2 describe-nat-gateways --nat-gateway-ids "$nat" --region "$REGION" &> /dev/null; then
                success "NAT Gateway $nat exists"
            else
                error "NAT Gateway $nat not found"
                return 1
            fi
        done
    fi
    
    success "VPC and networking validation completed"
}

# Validate EKS cluster
validate_eks_cluster() {
    log "Validating EKS cluster..."
    
    # Get cluster name from Terraform outputs
    CLUSTER_NAME=$(jq -r '.eks_cluster_id.value' terraform-outputs.json)
    
    if [ "$CLUSTER_NAME" = "null" ] || [ -z "$CLUSTER_NAME" ]; then
        error "EKS cluster name not found in Terraform outputs"
        return 1
    fi
    
    # Check if cluster exists and is active
    CLUSTER_STATUS=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$REGION" --query 'cluster.status' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$CLUSTER_STATUS" = "ACTIVE" ]; then
        success "EKS cluster $CLUSTER_NAME is active"
    else
        error "EKS cluster $CLUSTER_NAME status: $CLUSTER_STATUS"
        return 1
    fi
    
    # Update kubeconfig
    log "Updating kubeconfig for EKS cluster..."
    aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME"
    success "Kubeconfig updated"
    
    # Check node group
    NODE_GROUPS=$(aws eks list-nodegroups --cluster-name "$CLUSTER_NAME" --region "$REGION" --query 'nodegroups' --output text)
    
    if [ -n "$NODE_GROUPS" ]; then
        for nodegroup in $NODE_GROUPS; do
            NODE_STATUS=$(aws eks describe-nodegroup --cluster-name "$CLUSTER_NAME" --nodegroup-name "$nodegroup" --region "$REGION" --query 'nodegroup.status' --output text)
            if [ "$NODE_STATUS" = "ACTIVE" ]; then
                success "Node group $nodegroup is active"
            else
                error "Node group $nodegroup status: $NODE_STATUS"
                return 1
            fi
        done
    else
        error "No node groups found for cluster $CLUSTER_NAME"
        return 1
    fi
    
    # Check if nodes are ready
    log "Checking if Kubernetes nodes are ready..."
    READY_NODES=$(kubectl get nodes --no-headers | grep -c "Ready" || echo "0")
    TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)
    
    if [ "$READY_NODES" -gt 0 ] && [ "$READY_NODES" -eq "$TOTAL_NODES" ]; then
        success "$READY_NODES/$TOTAL_NODES nodes are ready"
    else
        error "Only $READY_NODES/$TOTAL_NODES nodes are ready"
        kubectl get nodes
        return 1
    fi
    
    success "EKS cluster validation completed"
}

# Validate RDS PostgreSQL
validate_rds() {
    log "Validating RDS PostgreSQL..."
    
    # Get RDS instance ID from Terraform outputs
    RDS_INSTANCE_ID=$(jq -r '.rds_instance_id.value' terraform-outputs.json)
    RDS_ENDPOINT=$(jq -r '.rds_instance_endpoint.value' terraform-outputs.json)
    
    if [ "$RDS_INSTANCE_ID" = "null" ] || [ -z "$RDS_INSTANCE_ID" ]; then
        error "RDS instance ID not found in Terraform outputs"
        return 1
    fi
    
    # Check RDS instance status
    RDS_STATUS=$(aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" --region "$REGION" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$RDS_STATUS" = "available" ]; then
        success "RDS instance $RDS_INSTANCE_ID is available"
        success "RDS endpoint: $RDS_ENDPOINT"
    else
        error "RDS instance $RDS_INSTANCE_ID status: $RDS_STATUS"
        return 1
    fi
    
    # Check if Multi-AZ is enabled (for production)
    MULTI_AZ=$(aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" --region "$REGION" --query 'DBInstances[0].MultiAZ' --output text)
    
    if [ "$MULTI_AZ" = "True" ]; then
        success "Multi-AZ is enabled for RDS instance"
    else
        warning "Multi-AZ is not enabled for RDS instance"
    fi
    
    # Check backup configuration
    BACKUP_RETENTION=$(aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" --region "$REGION" --query 'DBInstances[0].BackupRetentionPeriod' --output text)
    
    if [ "$BACKUP_RETENTION" -gt 0 ]; then
        success "Automated backups enabled with $BACKUP_RETENTION days retention"
    else
        warning "Automated backups are not enabled"
    fi
    
    success "RDS validation completed"
}

# Validate ElastiCache Redis
validate_redis() {
    log "Validating ElastiCache Redis..."
    
    # Get Redis replication group ID from Terraform outputs
    REDIS_GROUP_ID=$(jq -r '.redis_replication_group_id.value' terraform-outputs.json)
    REDIS_ENDPOINT=$(jq -r '.redis_primary_endpoint_address.value' terraform-outputs.json)
    
    if [ "$REDIS_GROUP_ID" = "null" ] || [ -z "$REDIS_GROUP_ID" ]; then
        error "Redis replication group ID not found in Terraform outputs"
        return 1
    fi
    
    # Check Redis replication group status
    REDIS_STATUS=$(aws elasticache describe-replication-groups --replication-group-id "$REDIS_GROUP_ID" --region "$REGION" --query 'ReplicationGroups[0].Status' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$REDIS_STATUS" = "available" ]; then
        success "Redis replication group $REDIS_GROUP_ID is available"
        success "Redis endpoint: $REDIS_ENDPOINT"
    else
        error "Redis replication group $REDIS_GROUP_ID status: $REDIS_STATUS"
        return 1
    fi
    
    # Check if automatic failover is enabled
    AUTO_FAILOVER=$(aws elasticache describe-replication-groups --replication-group-id "$REDIS_GROUP_ID" --region "$REGION" --query 'ReplicationGroups[0].AutomaticFailover' --output text)
    
    if [ "$AUTO_FAILOVER" = "enabled" ]; then
        success "Automatic failover is enabled for Redis"
    else
        warning "Automatic failover is not enabled for Redis"
    fi
    
    success "Redis validation completed"
}

# Validate ECR repositories
validate_ecr() {
    log "Validating ECR repositories..."
    
    # Get ECR repository URLs from Terraform outputs
    FRONTEND_REPO=$(jq -r '.ecr_frontend_repository_url.value' terraform-outputs.json)
    BACKEND_REPO=$(jq -r '.ecr_backend_repository_url.value' terraform-outputs.json)
    
    if [ "$FRONTEND_REPO" = "null" ] || [ -z "$FRONTEND_REPO" ]; then
        error "Frontend ECR repository URL not found in Terraform outputs"
        return 1
    fi
    
    if [ "$BACKEND_REPO" = "null" ] || [ -z "$BACKEND_REPO" ]; then
        error "Backend ECR repository URL not found in Terraform outputs"
        return 1
    fi
    
    # Extract repository names
    FRONTEND_REPO_NAME=$(echo "$FRONTEND_REPO" | cut -d'/' -f2)
    BACKEND_REPO_NAME=$(echo "$BACKEND_REPO" | cut -d'/' -f2)
    
    # Check if repositories exist
    if aws ecr describe-repositories --repository-names "$FRONTEND_REPO_NAME" --region "$REGION" &> /dev/null; then
        success "Frontend ECR repository exists: $FRONTEND_REPO"
    else
        error "Frontend ECR repository not found: $FRONTEND_REPO_NAME"
        return 1
    fi
    
    if aws ecr describe-repositories --repository-names "$BACKEND_REPO_NAME" --region "$REGION" &> /dev/null; then
        success "Backend ECR repository exists: $BACKEND_REPO"
    else
        error "Backend ECR repository not found: $BACKEND_REPO_NAME"
        return 1
    fi
    
    success "ECR validation completed"
}

# Test database connectivity from within the cluster
test_database_connectivity() {
    log "Testing database connectivity from within the cluster..."
    
    # Get database connection details
    DB_ENDPOINT=$(jq -r '.rds_instance_endpoint.value' terraform-outputs.json)
    DB_NAME=$(jq -r '.rds_db_name.value' terraform-outputs.json)
    
    # Create a temporary pod to test database connectivity
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: db-test-pod
  namespace: default
spec:
  containers:
  - name: postgres-client
    image: postgres:15-alpine
    command: ['sleep', '300']
    env:
    - name: PGHOST
      value: "$DB_ENDPOINT"
    - name: PGDATABASE
      value: "$DB_NAME"
  restartPolicy: Never
EOF
    
    # Wait for pod to be ready
    kubectl wait --for=condition=Ready pod/db-test-pod --timeout=60s
    
    # Test connection (this will fail without credentials, but should show connectivity)
    if kubectl exec db-test-pod -- pg_isready -h "$DB_ENDPOINT" -d "$DB_NAME"; then
        success "Database is reachable from within the cluster"
    else
        error "Database is not reachable from within the cluster"
        kubectl delete pod db-test-pod --ignore-not-found=true
        return 1
    fi
    
    # Clean up test pod
    kubectl delete pod db-test-pod --ignore-not-found=true
    
    success "Database connectivity test completed"
}

# Test Redis connectivity from within the cluster
test_redis_connectivity() {
    log "Testing Redis connectivity from within the cluster..."
    
    # Get Redis connection details
    REDIS_ENDPOINT=$(jq -r '.redis_primary_endpoint_address.value' terraform-outputs.json)
    REDIS_PORT=$(jq -r '.redis_port.value' terraform-outputs.json)
    
    # Create a temporary pod to test Redis connectivity
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: redis-test-pod
  namespace: default
spec:
  containers:
  - name: redis-client
    image: redis:7-alpine
    command: ['sleep', '300']
  restartPolicy: Never
EOF
    
    # Wait for pod to be ready
    kubectl wait --for=condition=Ready pod/redis-test-pod --timeout=60s
    
    # Test connection
    if kubectl exec redis-test-pod -- redis-cli -h "$REDIS_ENDPOINT" -p "$REDIS_PORT" ping | grep -q "PONG"; then
        success "Redis is reachable from within the cluster"
    else
        error "Redis is not reachable from within the cluster"
        kubectl delete pod redis-test-pod --ignore-not-found=true
        return 1
    fi
    
    # Clean up test pod
    kubectl delete pod redis-test-pod --ignore-not-found=true
    
    success "Redis connectivity test completed"
}

# Generate validation report
generate_report() {
    log "Generating validation report..."
    
    REPORT_FILE="infrastructure-validation-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" <<EOF
DhakaCart Infrastructure Validation Report
==========================================
Generated: $(date)
Region: $REGION
Environment: $ENVIRONMENT

Infrastructure Components:
- VPC ID: $(jq -r '.vpc_id.value' terraform-outputs.json)
- EKS Cluster: $(jq -r '.eks_cluster_id.value' terraform-outputs.json)
- RDS Instance: $(jq -r '.rds_instance_id.value' terraform-outputs.json)
- Redis Group: $(jq -r '.redis_replication_group_id.value' terraform-outputs.json)
- Frontend ECR: $(jq -r '.ecr_frontend_repository_url.value' terraform-outputs.json)
- Backend ECR: $(jq -r '.ecr_backend_repository_url.value' terraform-outputs.json)

Validation Status: PASSED
All infrastructure components have been successfully deployed and validated.

Next Steps:
1. Deploy applications (Task 11.2)
2. Configure load balancing and auto-scaling (Task 11.3)
3. Set up monitoring and alerting (Task 11.4)
4. Test backup and disaster recovery (Task 11.5)
5. Validate security and compliance (Task 11.6)
6. Execute end-to-end user workflow tests (Task 11.7)
7. Perform performance and scalability validation (Task 11.8)
EOF
    
    success "Validation report generated: $REPORT_FILE"
}

# Main execution
main() {
    log "Starting DhakaCart infrastructure validation..."
    
    check_prerequisites
    terraform_init_and_plan
    
    # Ask for confirmation before deploying
    echo
    warning "This will deploy infrastructure to AWS which may incur costs."
    read -p "Do you want to proceed with deployment? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Deployment cancelled by user"
        exit 0
    fi
    
    deploy_infrastructure
    validate_vpc_networking
    validate_eks_cluster
    validate_rds
    validate_redis
    validate_ecr
    test_database_connectivity
    test_redis_connectivity
    generate_report
    
    success "Infrastructure validation completed successfully!"
    log "All infrastructure components are deployed and operational."
}

# Run main function
main "$@"