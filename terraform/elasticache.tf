# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private_app[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-subnet-group"
  })
}

# ElastiCache Parameter Group for Redis
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7.x"
  name   = "${local.name_prefix}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-params"
  })
}

# KMS Key for ElastiCache encryption
resource "aws_kms_key" "elasticache" {
  description             = "KMS key for ElastiCache encryption"
  deletion_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-elasticache-kms-key"
  })
}

resource "aws_kms_alias" "elasticache" {
  name          = "alias/${local.name_prefix}-elasticache"
  target_key_id = aws_kms_key.elasticache.key_id
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Redis cluster for DhakaCart caching"

  # Node configuration
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  # Cluster configuration
  num_cache_clusters = var.redis_num_cache_nodes
  
  # Multi-AZ configuration
  multi_az_enabled           = var.redis_multi_az
  automatic_failover_enabled = var.redis_automatic_failover

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Engine configuration
  engine         = "redis"
  engine_version = var.redis_engine_version

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result
  kms_key_id                = aws_kms_key.elasticache.arn

  # Backup configuration
  snapshot_retention_limit = var.redis_snapshot_retention_limit
  snapshot_window         = var.redis_snapshot_window
  maintenance_window      = var.redis_maintenance_window

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  # Notification configuration
  notification_topic_arn = aws_sns_topic.redis_notifications.arn

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-cluster"
  })

  depends_on = [
    aws_cloudwatch_log_group.redis_slow_log
  ]
}

# Random auth token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # Redis auth token cannot contain special characters
}

# AWS Secrets Manager secret for Redis credentials
resource "aws_secretsmanager_secret" "redis_credentials" {
  name        = "${local.name_prefix}-redis-credentials"
  description = "Redis credentials for DhakaCart cache"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth_token.result
    host       = aws_elasticache_replication_group.main.primary_endpoint_address
    port       = aws_elasticache_replication_group.main.port
    engine     = "redis"
  })
}

# CloudWatch Log Group for Redis slow logs
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/redis/${local.name_prefix}/slow-log"
  retention_in_days = 14

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-slow-log"
  })
}

# SNS Topic for Redis notifications
resource "aws_sns_topic" "redis_notifications" {
  name = "${local.name_prefix}-redis-notifications"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-notifications"
  })
}

# CloudWatch Alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu_utilization" {
  alarm_name          = "${local.name_prefix}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors redis cpu utilization"
  alarm_actions       = [aws_sns_topic.redis_notifications.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-cpu-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_utilization" {
  alarm_name          = "${local.name_prefix}-redis-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors redis memory utilization"
  alarm_actions       = [aws_sns_topic.redis_notifications.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-memory-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "${local.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors redis evictions"
  alarm_actions       = [aws_sns_topic.redis_notifications.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-evictions-alarm"
  })
}