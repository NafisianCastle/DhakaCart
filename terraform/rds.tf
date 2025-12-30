# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private_db[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# RDS Parameter Group for PostgreSQL
resource "aws_db_parameter_group" "postgresql" {
  family = "postgres15"
  name   = "${local.name_prefix}-postgresql-params"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql-params"
  })
}

# RDS Option Group for PostgreSQL
resource "aws_db_option_group" "postgresql" {
  name                 = "${local.name_prefix}-postgresql-options"
  option_group_description = "Option group for PostgreSQL"
  engine_name          = "postgres"
  major_engine_version = "15"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql-options"
  })
}

# Random password for RDS master user
resource "random_password" "db_master_password" {
  length  = 32
  special = true
}

# AWS Secrets Manager secret for database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${local.name_prefix}-db-credentials"
  description = "Database credentials for DhakaCart PostgreSQL"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_master_password.result
    engine   = "postgres"
    host     = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    dbname   = aws_db_instance.main.db_name
  })
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgresql"

  # Engine configuration
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_master_password.result

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  port                   = 5432

  # Multi-AZ and availability
  multi_az               = var.db_multi_az
  availability_zone      = var.db_multi_az ? null : data.aws_availability_zones.available.names[0]

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.postgresql.name
  option_group_name    = aws_db_option_group.postgresql.name

  # Backup configuration
  backup_retention_period = var.db_backup_retention_period
  backup_window          = var.db_backup_window
  maintenance_window     = var.db_maintenance_window
  copy_tags_to_snapshot  = true
  delete_automated_backups = false

  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Security
  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "${local.name_prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  # Auto minor version upgrade
  auto_minor_version_upgrade = true
  allow_major_version_upgrade = false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql"
  })

  depends_on = [
    aws_cloudwatch_log_group.rds_postgresql,
    aws_cloudwatch_log_group.rds_upgrade
  ]
}

# Read Replica for PostgreSQL (only in production)
resource "aws_db_instance" "read_replica" {
  count = var.environment == "prod" && var.create_read_replica ? 1 : 0

  identifier = "${local.name_prefix}-postgresql-read-replica"

  # Replica configuration
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.db_replica_instance_class

  # Network configuration
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql-read-replica"
  })
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-kms-key"
  })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# IAM Role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${local.name_prefix}-rds-enhanced-monitoring"

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
    Name = "${local.name_prefix}-rds-enhanced-monitoring"
  })
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Log Groups for RDS
resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${local.name_prefix}-postgresql/postgresql"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-postgresql-logs"
  })
}

resource "aws_cloudwatch_log_group" "rds_upgrade" {
  name              = "/aws/rds/instance/${local.name_prefix}-postgresql/upgrade"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-upgrade-logs"
  })
}