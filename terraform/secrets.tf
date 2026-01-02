# AWS Secrets Manager configuration for DhakaCart
# This file manages all sensitive configuration data

# Random password generation for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Database credentials secret
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}-db-credentials"
  description             = "Database credentials for DhakaCart application"
  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-credentials"
    Type = "database"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    dbname   = var.db_name
    database_url = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.main.endpoint}:${aws_db_instance.main.port}/${var.db_name}"
  })
}

# Redis credentials secret
resource "aws_secretsmanager_secret" "redis_credentials" {
  name                    = "${local.name_prefix}-redis-credentials"
  description             = "Redis credentials for DhakaCart application"
  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-credentials"
    Type = "cache"
  })
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    host     = aws_elasticache_replication_group.main.primary_endpoint_address
    port     = aws_elasticache_replication_group.main.port
    redis_url = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:${aws_elasticache_replication_group.main.port}"
  })
}

# Application secrets (JWT, API keys, etc.)
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${local.name_prefix}-app-secrets"
  description             = "Application secrets for DhakaCart"
  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-secrets"
    Type = "application"
  })
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    jwt_secret = random_password.jwt_secret.result
    session_secret = random_password.jwt_secret.result
    encryption_key = random_password.jwt_secret.result
  })
}

# IAM role for External Secrets Operator
resource "aws_iam_role" "external_secrets_role" {
  name = "${local.name_prefix}-external-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:external-secrets:external-secrets"
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM policy for External Secrets Operator to access Secrets Manager
resource "aws_iam_policy" "external_secrets_policy" {
  name        = "${local.name_prefix}-external-secrets-policy"
  description = "Policy for External Secrets Operator to access AWS Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.app_secrets.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_secrets_policy_attachment" {
  role       = aws_iam_role.external_secrets_role.name
  policy_arn = aws_iam_policy.external_secrets_policy.arn
}

# Service account for applications to access secrets
resource "aws_iam_role" "dhakacart_app_role" {
  name = "${local.name_prefix}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:dhakacart:dhakacart-backend"
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

# Outputs for use in Kubernetes configurations
output "secrets_manager_arns" {
  description = "ARNs of created secrets"
  value = {
    db_credentials    = aws_secretsmanager_secret.db_credentials.arn
    redis_credentials = aws_secretsmanager_secret.redis_credentials.arn
    app_secrets       = aws_secretsmanager_secret.app_secrets.arn
  }
}

output "external_secrets_role_arn" {
  description = "ARN of the External Secrets Operator IAM role"
  value       = aws_iam_role.external_secrets_role.arn
}

output "dhakacart_app_role_arn" {
  description = "ARN of the DhakaCart application IAM role"
  value       = aws_iam_role.dhakacart_app_role.arn
}