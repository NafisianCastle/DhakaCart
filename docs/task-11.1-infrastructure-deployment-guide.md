# Task 11.1: Deploy and Validate Infrastructure

## Overview

This guide provides step-by-step instructions for deploying and validating the DhakaCart cloud infrastructure using Terraform. The infrastructure includes VPC, EKS cluster, RDS PostgreSQL, ElastiCache Redis, and ECR repositories.

## Prerequisites

Before running the deployment, ensure you have:

1. **AWS CLI** installed and configured with appropriate credentials
2. **Terraform** (version >= 1.0) installed
3. **kubectl** installed for Kubernetes management
4. **jq** installed for JSON processing (optional but recommended)
5. **AWS credentials** with sufficient permissions for:
   - VPC and networking resources
   - EKS cluster management
   - RDS and ElastiCache services
   - ECR repositories
   - IAM roles and policies

## Deployment Steps

### Step 1: Configure Terraform Variables

1. Navigate to the `terraform` directory:
   ```bash
   cd terraform
   ```

2. Copy the example variables file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

3. Edit `terraform.tfvars` with your specific values:
   ```hcl
   # AWS Configuration
   aws_region = "us-west-2"  # Change to your preferred region
   environment = "prod"      # Change to "prod" for production
   project_name = "dhakacart"
   
   # GitHub Repository for CI/CD
   github_repository = "your-org/dhakacart"  # Replace with actual repo
   
   # Production settings
   node_instance_types = ["t3.medium", "t3.large"]
   node_desired_size = 3
   node_max_size = 10
   db_instance_class = "db.t3.small"  # Upgrade for production
   redis_node_type = "cache.t3.small"  # Upgrade for production
   ```

### Step 2: Initialize and Deploy Infrastructure

1. Initialize Terraform:
   ```bash
   terraform init
   ```

2. Validate the configuration:
   ```bash
   terraform validate
   ```

3. Plan the deployment:
   ```bash
   terraform plan -out=tfplan
   ```

4. Review the plan carefully, then apply:
   ```bash
   terraform apply tfplan
   ```

5. Save outputs for later use:
   ```bash
   terraform output -json > ../terraform-outputs.json
   ```

### Step 3: Validate Infrastructure Components

#### VPC and Networking Validation

1. **Check VPC Creation**:
   ```bash
   # Get VPC ID from outputs
   VPC_ID=$(jq -r '.vpc_id.value' ../terraform-outputs.json)
   
   # Verify VPC exists
   aws ec2 describe-vpcs --vpc-ids $VPC_ID --region us-west-2
   ```

2. **Validate Subnets**:
   ```bash
   # Check public subnets
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=public"
   
   # Check private app subnets
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=private-app"
   
   # Check private DB subnets
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=private-db"
   ```

3. **Verify NAT Gateways**:
   ```bash
   aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$VPC_ID"
   ```

#### EKS Cluster Validation

1. **Check Cluster Status**:
   ```bash
   CLUSTER_NAME=$(jq -r '.eks_cluster_id.value' ../terraform-outputs.json)
   aws eks describe-cluster --name $CLUSTER_NAME --region us-west-2
   ```

2. **Update kubeconfig**:
   ```bash
   aws eks update-kubeconfig --region us-west-2 --name $CLUSTER_NAME
   ```

3. **Verify Node Groups**:
   ```bash
   aws eks list-nodegroups --cluster-name $CLUSTER_NAME --region us-west-2
   kubectl get nodes
   ```

4. **Check Node Readiness**:
   ```bash
   kubectl get nodes -o wide
   kubectl describe nodes
   ```

#### RDS PostgreSQL Validation

1. **Check Database Status**:
   ```bash
   RDS_INSTANCE=$(jq -r '.rds_instance_id.value' ../terraform-outputs.json)
   aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE --region us-west-2
   ```

2. **Verify Multi-AZ Configuration**:
   ```bash
   aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE \
     --query 'DBInstances[0].MultiAZ' --output text
   ```

3. **Check Backup Configuration**:
   ```bash
   aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE \
     --query 'DBInstances[0].BackupRetentionPeriod' --output text
   ```

#### ElastiCache Redis Validation

1. **Check Redis Cluster Status**:
   ```bash
   REDIS_GROUP=$(jq -r '.redis_replication_group_id.value' ../terraform-outputs.json)
   aws elasticache describe-replication-groups --replication-group-id $REDIS_GROUP --region us-west-2
   ```

2. **Verify Automatic Failover**:
   ```bash
   aws elasticache describe-replication-groups --replication-group-id $REDIS_GROUP \
     --query 'ReplicationGroups[0].AutomaticFailover' --output text
   ```

#### ECR Repositories Validation

1. **Check Repository Creation**:
   ```bash
   aws ecr describe-repositories --region us-west-2
   ```

2. **Verify Repository URLs**:
   ```bash
   echo "Frontend ECR: $(jq -r '.ecr_frontend_repository_url.value' ../terraform-outputs.json)"
   echo "Backend ECR: $(jq -r '.ecr_backend_repository_url.value' ../terraform-outputs.json)"
   ```

### Step 4: Test Connectivity from Kubernetes

#### Database Connectivity Test

1. **Create test pod**:
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Pod
   metadata:
     name: db-test-pod
   spec:
     containers:
     - name: postgres-client
       image: postgres:15-alpine
       command: ['sleep', '300']
       env:
       - name: PGHOST
         value: "$(jq -r '.rds_instance_endpoint.value' ../terraform-outputs.json)"
     restartPolicy: Never
   EOF
   ```

2. **Test connection**:
   ```bash
   kubectl wait --for=condition=Ready pod/db-test-pod --timeout=60s
   kubectl exec db-test-pod -- pg_isready -h $(jq -r '.rds_instance_endpoint.value' ../terraform-outputs.json)
   ```

3. **Cleanup**:
   ```bash
   kubectl delete pod db-test-pod
   ```

#### Redis Connectivity Test

1. **Create test pod**:
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Pod
   metadata:
     name: redis-test-pod
   spec:
     containers:
     - name: redis-client
       image: redis:7-alpine
       command: ['sleep', '300']
     restartPolicy: Never
   EOF
   ```

2. **Test connection**:
   ```bash
   kubectl wait --for=condition=Ready pod/redis-test-pod --timeout=60s
   kubectl exec redis-test-pod -- redis-cli -h $(jq -r '.redis_primary_endpoint_address.value' ../terraform-outputs.json) ping
   ```

3. **Cleanup**:
   ```bash
   kubectl delete pod redis-test-pod
   ```

## Validation Checklist

Mark each item as complete when validated:

- [ ] VPC created with correct CIDR block
- [ ] Public subnets created in multiple AZs
- [ ] Private application subnets created in multiple AZs
- [ ] Private database subnets created in multiple AZs
- [ ] NAT Gateways deployed for private subnet internet access
- [ ] Internet Gateway attached to VPC
- [ ] Route tables configured correctly
- [ ] Security groups created with appropriate rules
- [ ] EKS cluster is in ACTIVE state
- [ ] EKS node groups are ACTIVE with desired capacity
- [ ] Kubernetes nodes are Ready
- [ ] RDS PostgreSQL instance is available
- [ ] RDS Multi-AZ is enabled (for production)
- [ ] RDS automated backups are configured
- [ ] ElastiCache Redis cluster is available
- [ ] Redis automatic failover is enabled
- [ ] ECR repositories created for frontend and backend
- [ ] Database connectivity from Kubernetes cluster verified
- [ ] Redis connectivity from Kubernetes cluster verified

## Expected Outputs

After successful deployment, you should have:

1. **VPC Infrastructure**:
   - 1 VPC with public and private subnets across 2+ AZs
   - NAT Gateways for outbound internet access from private subnets
   - Security groups for different tiers (ALB, EKS, RDS, Redis)

2. **EKS Cluster**:
   - Managed Kubernetes cluster with 3+ worker nodes
   - Cluster autoscaler configured
   - OIDC provider for service account authentication

3. **Database Services**:
   - RDS PostgreSQL with Multi-AZ deployment
   - ElastiCache Redis cluster with automatic failover
   - Encrypted storage and transit

4. **Container Registry**:
   - ECR repositories for frontend and backend images
   - Lifecycle policies for image management

5. **IAM Roles**:
   - EKS cluster service role
   - Node group instance role
   - Application pod roles
   - CI/CD pipeline roles

## Troubleshooting

### Common Issues

1. **Insufficient AWS Permissions**:
   - Ensure your AWS credentials have permissions for all required services
   - Check CloudTrail logs for permission denied errors

2. **Resource Limits**:
   - Verify your AWS account limits for VPCs, EIPs, and other resources
   - Request limit increases if needed

3. **Terraform State Issues**:
   - Use `terraform refresh` to sync state with actual resources
   - Consider using remote state backend for team collaboration

4. **Network Connectivity**:
   - Verify security group rules allow required traffic
   - Check route table configurations
   - Ensure NAT Gateways have Elastic IPs

### Validation Failures

If any validation step fails:

1. Check the specific AWS service console for error details
2. Review Terraform logs for deployment issues
3. Verify resource dependencies are met
4. Check AWS service quotas and limits
5. Ensure proper IAM permissions

## Next Steps

Once infrastructure validation is complete:

1. Proceed to Task 11.2: Deploy and test applications
2. Build and push container images to ECR
3. Deploy Kubernetes manifests
4. Configure application secrets and environment variables

## Cost Optimization

For development/testing environments:

- Use smaller instance types (t3.micro, t3.small)
- Enable single NAT Gateway instead of per-AZ
- Use SPOT instances for EKS node groups
- Set shorter backup retention periods

For production environments:

- Use appropriate instance sizes based on load testing
- Enable Multi-AZ for all critical services
- Configure proper backup and retention policies
- Implement resource tagging for cost allocation

## Security Considerations

- All database subnets are private with no internet access
- Security groups follow principle of least privilege
- Encryption at rest enabled for RDS and ElastiCache
- VPC Flow Logs enabled for network monitoring
- IAM roles use minimal required permissions

This completes the infrastructure deployment and validation for Task 11.1.