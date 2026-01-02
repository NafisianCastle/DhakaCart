variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "dhakacart"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private application subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private database subnets"
  type        = list(string)
  default     = ["10.0.100.0/24", "10.0.200.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for cost optimization"
  type        = bool
  default     = false
}#
 EKS Cluster Variables
variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "List of CIDR blocks that can access the EKS cluster endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "Instance types for EKS node group"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "node_ami_type" {
  description = "AMI type for EKS node group"
  type        = string
  default     = "AL2_x86_64"
}

variable "node_capacity_type" {
  description = "Capacity type for EKS node group (ON_DEMAND or SPOT)"
  type        = string
  default     = "ON_DEMAND"
}

variable "node_disk_size" {
  description = "Disk size for EKS node group instances"
  type        = number
  default     = 50
}

variable "node_desired_size" {
  description = "Desired number of nodes in EKS node group"
  type        = number
  default     = 3
}

variable "node_max_size" {
  description = "Maximum number of nodes in EKS node group"
  type        = number
  default     = 10
}

variable "node_min_size" {
  description = "Minimum number of nodes in EKS node group"
  type        = number
  default     = 1
}

variable "node_ssh_key_name" {
  description = "SSH key name for EKS node group instances"
  type        = string
  default     = null
}

variable "enable_fargate" {
  description = "Enable Fargate profile for EKS cluster"
  type        = bool
  default     = false
}

# EKS Add-on Versions
variable "vpc_cni_version" {
  description = "Version of VPC CNI add-on"
  type        = string
  default     = null
}

variable "coredns_version" {
  description = "Version of CoreDNS add-on"
  type        = string
  default     = null
}

variable "kube_proxy_version" {
  description = "Version of kube-proxy add-on"
  type        = string
  default     = null
}

variable "ebs_csi_driver_version" {
  description = "Version of EBS CSI driver add-on"
  type        = string
  default     = null
}#
 GitHub Repository for CI/CD
variable "github_repository" {
  description = "GitHub repository in the format 'owner/repo-name' for OIDC trust"
  type        = string
  default     = "your-org/dhakacart"
}
# RDS Dat
abase Variables
variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "dhakacart"
}

variable "db_username" {
  description = "Username for the database"
  type        = string
  default     = "dhakacart_admin"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage in GB for autoscaling"
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "db_backup_window" {
  description = "Backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "create_read_replica" {
  description = "Create read replica for production"
  type        = bool
  default     = false
}

variable "db_replica_instance_class" {
  description = "RDS read replica instance class"
  type        = string
  default     = "db.t3.micro"
}#
 ElastiCache Redis Variables
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster"
  type        = number
  default     = 2
}

variable "redis_multi_az" {
  description = "Enable Multi-AZ for Redis cluster"
  type        = bool
  default     = true
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover for Redis cluster"
  type        = bool
  default     = true
}

variable "redis_snapshot_retention_limit" {
  description = "Number of days to retain Redis snapshots"
  type        = number
  default     = 7
}

variable "redis_snapshot_window" {
  description = "Daily time range for Redis snapshots (UTC)"
  type        = string
  default     = "05:00-06:00"
}

variable "redis_maintenance_window" {
  description = "Weekly time range for Redis maintenance (UTC)"
  type        = string
  default     = "sun:06:00-sun:07:00"
}

# Backup Variables
variable "backup_retention_days" {
  description = "Number of days to retain manual backups in S3"
  type        = number
  default     = 90
}
# Disaster Recovery Variables
variable "dr_region" {
  description = "AWS region for disaster recovery"
  type        = string
  default     = "us-east-1"
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup for disaster recovery"
  type        = bool
  default     = false
}

variable "dr_vpc_cidr" {
  description = "CIDR block for DR VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "dr_public_subnet_cidrs" {
  description = "CIDR blocks for DR public subnets"
  type        = list(string)
  default     = ["10.1.1.0/24", "10.1.2.0/24"]
}

variable "dr_private_db_subnet_cidrs" {
  description = "CIDR blocks for DR private database subnets"
  type        = list(string)
  default     = ["10.1.100.0/24", "10.1.200.0/24"]
}

variable "dr_db_instance_class" {
  description = "RDS instance class for disaster recovery replica"
  type        = string
  default     = "db.t3.micro"
}

variable "dr_backup_retention_period" {
  description = "Backup retention period in days for DR"
  type        = number
  default     = 30
}

variable "dr_backup_window" {
  description = "Backup window for DR (UTC)"
  type        = string
  default     = "05:00-06:00"
}

variable "dr_maintenance_window" {
  description = "Maintenance window for DR (UTC)"
  type        = string
  default     = "sun:06:00-sun:07:00"
}