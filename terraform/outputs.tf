# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "IDs of the private application subnets"
  value       = aws_subnet.private_app[*].id
}

output "private_db_subnet_ids" {
  description = "IDs of the private database subnets"
  value       = aws_subnet.private_db[*].id
}

# NAT Gateway Outputs
output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_public_ips" {
  description = "Public IPs of the NAT Gateways"
  value       = aws_eip.nat[*].public_ip
}

# Security Group Outputs
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "eks_cluster_security_group_id" {
  description = "ID of the EKS cluster security group"
  value       = aws_security_group.eks_cluster.id
}

output "eks_nodes_security_group_id" {
  description = "ID of the EKS nodes security group"
  value       = aws_security_group.eks_nodes.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}# EK
S Cluster Outputs
output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.main.id
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = aws_eks_cluster.main.version
}

output "eks_cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "eks_node_group_arn" {
  description = "EKS node group ARN"
  value       = aws_eks_node_group.main.arn
}

output "eks_node_group_status" {
  description = "EKS node group status"
  value       = aws_eks_node_group.main.status
}

output "eks_oidc_issuer_url" {
  description = "EKS cluster OIDC issuer URL"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN"
  value       = aws_iam_openid_connect_provider.eks.arn
}# ECR R
epository Outputs
output "ecr_frontend_repository_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_backend_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_arn" {
  description = "ECR repository ARN for frontend"
  value       = aws_ecr_repository.frontend.arn
}

output "ecr_backend_repository_arn" {
  description = "ECR repository ARN for backend"
  value       = aws_ecr_repository.backend.arn
}

# IAM Role Outputs
output "github_actions_role_arn" {
  description = "GitHub Actions IAM role ARN"
  value       = aws_iam_role.github_actions.arn
}

output "eks_deployment_role_arn" {
  description = "EKS deployment IAM role ARN"
  value       = aws_iam_role.eks_deployment.arn
}

output "app_pod_role_arn" {
  description = "Application pod IAM role ARN"
  value       = aws_iam_role.app_pod.arn
}

output "aws_load_balancer_controller_role_arn" {
  description = "AWS Load Balancer Controller IAM role ARN"
  value       = aws_iam_role.aws_load_balancer_controller.arn
}# RD
S Database Outputs
output "rds_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "rds_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "rds_instance_address" {
  description = "RDS instance address"
  value       = aws_db_instance.main.address
}

output "rds_db_name" {
  description = "RDS database name"
  value       = aws_db_instance.main.db_name
}

output "rds_db_username" {
  description = "RDS database username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "rds_read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = var.environment == "prod" && var.create_read_replica ? aws_db_instance.read_replica[0].endpoint : null
}

output "rds_secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "rds_kms_key_id" {
  description = "KMS key ID for RDS encryption"
  value       = aws_kms_key.rds.key_id
}

output "rds_kms_key_arn" {
  description = "KMS key ARN for RDS encryption"
  value       = aws_kms_key.rds.arn
}# ElastiC
ache Redis Outputs
output "redis_replication_group_id" {
  description = "Redis replication group ID"
  value       = aws_elasticache_replication_group.main.id
}

output "redis_replication_group_arn" {
  description = "Redis replication group ARN"
  value       = aws_elasticache_replication_group.main.arn
}

output "redis_primary_endpoint_address" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint_address" {
  description = "Redis reader endpoint address"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis credentials"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "redis_kms_key_id" {
  description = "KMS key ID for Redis encryption"
  value       = aws_kms_key.elasticache.key_id
}

output "redis_kms_key_arn" {
  description = "KMS key ARN for Redis encryption"
  value       = aws_kms_key.elasticache.arn
}
# Backup System Outputs
output "backup_s3_bucket" {
  description = "S3 bucket for database backups"
  value       = aws_s3_bucket.backup.bucket
}

output "backup_s3_bucket_arn" {
  description = "ARN of the S3 bucket for database backups"
  value       = aws_s3_bucket.backup.arn
}

output "backup_kms_key_id" {
  description = "KMS key ID for backup encryption"
  value       = aws_kms_key.backup.key_id
}

output "backup_kms_key_arn" {
  description = "KMS key ARN for backup encryption"
  value       = aws_kms_key.backup.arn
}

output "backup_lambda_function_name" {
  description = "Name of the backup manager Lambda function"
  value       = aws_lambda_function.backup_manager.function_name
}

output "backup_lambda_function_arn" {
  description = "ARN of the backup manager Lambda function"
  value       = aws_lambda_function.backup_manager.arn
}

output "backup_verifier_lambda_function_name" {
  description = "Name of the backup verifier Lambda function"
  value       = aws_lambda_function.backup_verifier.function_name
}

output "backup_verifier_lambda_function_arn" {
  description = "ARN of the backup verifier Lambda function"
  value       = aws_lambda_function.backup_verifier.arn
}

output "backup_sns_topic_arn" {
  description = "ARN of the SNS topic for backup notifications"
  value       = aws_sns_topic.backup_notifications.arn
}

output "db_instance_id" {
  description = "Database instance identifier for backup operations"
  value       = aws_db_instance.main.identifier
}
# Disaster Recovery Outputs
output "dr_vpc_id" {
  description = "VPC ID in disaster recovery region"
  value       = var.enable_cross_region_backup ? aws_vpc.dr.id : null
}

output "dr_db_instance_id" {
  description = "Database instance identifier in DR region"
  value       = var.enable_cross_region_backup ? aws_db_instance.dr_replica[0].identifier : null
}

output "dr_db_endpoint" {
  description = "Database endpoint in DR region"
  value       = var.enable_cross_region_backup ? aws_db_instance.dr_replica[0].endpoint : null
}

output "dr_backup_s3_bucket" {
  description = "S3 bucket for DR backups"
  value       = aws_s3_bucket.dr_backup.bucket
}

output "dr_region" {
  description = "Disaster recovery region"
  value       = var.dr_region
}