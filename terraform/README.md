# DhakaCart Infrastructure as Code

This directory contains Terraform configuration for deploying DhakaCart's cloud infrastructure on AWS.

## Architecture Overview

The infrastructure includes:
- **VPC** with public and private subnets across multiple AZs
- **EKS Cluster** with managed node groups and auto-scaling
- **ECR Repositories** for container images
- **Security Groups** for network access control
- **IAM Roles** for service accounts and CI/CD pipeline

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **kubectl** for Kubernetes cluster management
4. **AWS permissions** for creating VPC, EKS, ECR, and IAM resources

## Quick Start

1. **Copy and customize variables:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your specific values
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init
   ```

3. **Plan the deployment:**
   ```bash
   terraform plan
   ```

4. **Apply the configuration:**
   ```bash
   terraform apply
   ```

5. **Configure kubectl:**
   ```bash
   aws eks update-kubeconfig --region <your-region> --name <cluster-name>
   ```

## Configuration

### Required Variables

- `aws_region`: AWS region for deployment
- `github_repository`: GitHub repository for CI/CD (format: "owner/repo")

### Optional Variables

- `environment`: Environment name (default: "dev")
- `project_name`: Project name for resource naming (default: "dhakacart")
- `vpc_cidr`: VPC CIDR block (default: "10.0.0.0/16")
- `single_nat_gateway`: Use single NAT gateway for cost optimization (default: false)
- `node_capacity_type`: EKS node capacity type - "ON_DEMAND" or "SPOT" (default: "ON_DEMAND")

## Security Considerations

1. **Restrict cluster endpoint access** by updating `cluster_endpoint_public_access_cidrs`
2. **Use private subnets** for application workloads
3. **Enable encryption** for EKS secrets using KMS
4. **Scan container images** automatically with ECR
5. **Use IAM roles for service accounts** (IRSA) for pod-level permissions

## Cost Optimization

For development environments:
- Set `single_nat_gateway = true`
- Use `node_capacity_type = "SPOT"`
- Reduce `node_desired_size` and `node_max_size`
- Consider enabling Fargate for specific workloads

## Outputs

After successful deployment, Terraform provides:
- VPC and subnet IDs
- EKS cluster endpoint and certificate
- ECR repository URLs
- IAM role ARNs for CI/CD and applications

## Cleanup

To destroy the infrastructure:
```bash
terraform destroy
```

**Warning:** This will delete all resources including data stores. Ensure you have backups if needed.

## Troubleshooting

### Common Issues

1. **Insufficient IAM permissions**: Ensure your AWS credentials have permissions for VPC, EKS, ECR, and IAM operations
2. **Region availability**: Some instance types may not be available in all regions
3. **Resource limits**: Check AWS service quotas for EKS clusters and EC2 instances

### Useful Commands

```bash
# Check EKS cluster status
aws eks describe-cluster --name <cluster-name> --region <region>

# List ECR repositories
aws ecr describe-repositories --region <region>

# Get cluster credentials
aws eks update-kubeconfig --region <region> --name <cluster-name>

# Verify cluster access
kubectl get nodes
```

## Next Steps

After infrastructure deployment:
1. Install AWS Load Balancer Controller
2. Set up monitoring with Prometheus and Grafana
3. Configure CI/CD pipeline with GitHub Actions
4. Deploy application workloads to the cluster