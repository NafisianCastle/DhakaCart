# Disaster Recovery Configuration
# This file contains resources for cross-region disaster recovery

# Data source for secondary region
data "aws_region" "secondary" {
  provider = aws.secondary
}

# Provider for secondary region (disaster recovery)
provider "aws" {
  alias  = "secondary"
  region = var.dr_region
}

# VPC in secondary region for disaster recovery
resource "aws_vpc" "dr" {
  provider   = aws.secondary
  cidr_block = var.dr_vpc_cidr

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-vpc"
    Type = "disaster-recovery"
  })
}

# Internet Gateway for DR VPC
resource "aws_internet_gateway" "dr" {
  provider = aws.secondary
  vpc_id   = aws_vpc.dr.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-igw"
  })
}

# Public subnets in DR region
resource "aws_subnet" "dr_public" {
  provider = aws.secondary
  count    = length(var.dr_public_subnet_cidrs)

  vpc_id                  = aws_vpc.dr.id
  cidr_block              = var.dr_public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.dr_available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-public-subnet-${count.index + 1}"
    Type = "public"
  })
}

# Private subnets for database in DR region
resource "aws_subnet" "dr_private_db" {
  provider = aws.secondary
  count    = length(var.dr_private_db_subnet_cidrs)

  vpc_id            = aws_vpc.dr.id
  cidr_block        = var.dr_private_db_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.dr_available.names[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-private-db-subnet-${count.index + 1}"
    Type = "private-db"
  })
}

# Route table for DR public subnets
resource "aws_route_table" "dr_public" {
  provider = aws.secondary
  vpc_id   = aws_vpc.dr.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dr.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-public-rt"
  })
}

# Route table associations for DR public subnets
resource "aws_route_table_association" "dr_public" {
  provider = aws.secondary
  count    = length(aws_subnet.dr_public)

  subnet_id      = aws_subnet.dr_public[count.index].id
  route_table_id = aws_route_table.dr_public.id
}

# Route table for DR private subnets
resource "aws_route_table" "dr_private_db" {
  provider = aws.secondary
  vpc_id   = aws_vpc.dr.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-private-db-rt"
  })
}

# Route table associations for DR private subnets
resource "aws_route_table_association" "dr_private_db" {
  provider = aws.secondary
  count    = length(aws_subnet.dr_private_db)

  subnet_id      = aws_subnet.dr_private_db[count.index].id
  route_table_id = aws_route_table.dr_private_db.id
}

# Data source for DR availability zones
data "aws_availability_zones" "dr_available" {
  provider = aws.secondary
  state    = "available"
}

# Security group for DR RDS instance
resource "aws_security_group" "dr_rds" {
  provider    = aws.secondary
  name        = "${local.name_prefix}-dr-rds-sg"
  description = "Security group for DR RDS PostgreSQL instance"
  vpc_id      = aws_vpc.dr.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.dr.cidr_block]
    description = "PostgreSQL access from DR VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-rds-sg"
  })
}

# DB subnet group for DR region
resource "aws_db_subnet_group" "dr" {
  provider   = aws.secondary
  name       = "${local.name_prefix}-dr-db-subnet-group"
  subnet_ids = aws_subnet.dr_private_db[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-db-subnet-group"
  })
}

# KMS Key for DR RDS encryption
resource "aws_kms_key" "dr_rds" {
  provider                = aws.secondary
  description             = "KMS key for DR RDS encryption"
  deletion_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-rds-kms-key"
  })
}

resource "aws_kms_alias" "dr_rds" {
  provider      = aws.secondary
  name          = "alias/${local.name_prefix}-dr-rds"
  target_key_id = aws_kms_key.dr_rds.key_id
}

# Cross-region automated backup for disaster recovery
resource "aws_db_instance" "dr_replica" {
  provider = aws.secondary
  count    = var.enable_cross_region_backup ? 1 : 0

  identifier = "${local.name_prefix}-dr-replica"

  # Replica configuration - this will be a cross-region read replica
  replicate_source_db = aws_db_instance.main.arn
  instance_class      = var.dr_db_instance_class

  # Storage configuration
  storage_encrypted = true
  kms_key_id       = aws_kms_key.dr_rds.arn

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.dr.name
  vpc_security_group_ids = [aws_security_group.dr_rds.id]
  publicly_accessible    = false

  # Backup configuration for DR
  backup_retention_period = var.dr_backup_retention_period
  backup_window          = var.dr_backup_window
  maintenance_window     = var.dr_maintenance_window
  copy_tags_to_snapshot  = true

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id      = aws_kms_key.dr_rds.arn

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.dr_rds_enhanced_monitoring[0].arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-replica"
    Type = "disaster-recovery"
  })

  depends_on = [
    aws_cloudwatch_log_group.dr_rds_postgresql,
    aws_cloudwatch_log_group.dr_rds_upgrade
  ]
}

# IAM Role for DR RDS Enhanced Monitoring
resource "aws_iam_role" "dr_rds_enhanced_monitoring" {
  provider = aws.secondary
  count    = var.enable_cross_region_backup ? 1 : 0
  name     = "${local.name_prefix}-dr-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-rds-enhanced-monitoring"
  })
}

resource "aws_iam_role_policy_attachment" "dr_rds_enhanced_monitoring" {
  provider   = aws.secondary
  count      = var.enable_cross_region_backup ? 1 : 0
  role       = aws_iam_role.dr_rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Log Groups for DR RDS
resource "aws_cloudwatch_log_group" "dr_rds_postgresql" {
  provider          = aws.secondary
  name              = "/aws/rds/instance/${local.name_prefix}-dr-replica/postgresql"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-rds-postgresql-logs"
  })
}

resource "aws_cloudwatch_log_group" "dr_rds_upgrade" {
  provider          = aws.secondary
  name              = "/aws/rds/instance/${local.name_prefix}-dr-replica/upgrade"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-rds-upgrade-logs"
  })
}

# S3 bucket for DR backups in secondary region
resource "aws_s3_bucket" "dr_backup" {
  provider = aws.secondary
  bucket   = "${local.name_prefix}-dr-backups-${random_id.dr_bucket_suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dr-backups"
    Type = "disaster-recovery"
  })
}

resource "random_id" "dr_bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "dr_backup" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.dr_backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "dr_backup" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.dr_backup.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.dr_rds.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

# Cross-region replication for primary backup bucket
resource "aws_s3_bucket_replication_configuration" "backup_replication" {
  role   = aws_iam_role.s3_replication.arn
  bucket = aws_s3_bucket.backup.id

  rule {
    id     = "backup_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.dr_backup.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.dr_rds.arn
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.backup]
}

# IAM role for S3 cross-region replication
resource "aws_iam_role" "s3_replication" {
  name = "${local.name_prefix}-s3-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-s3-replication-role"
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name = "${local.name_prefix}-s3-replication-policy"
  role = aws_iam_role.s3_replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.backup.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.dr_backup.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = [
          aws_kms_key.backup.arn,
          aws_kms_key.dr_rds.arn
        ]
      }
    ]
  })
}