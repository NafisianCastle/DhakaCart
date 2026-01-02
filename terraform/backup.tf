# Enhanced RDS Backup Configuration
# This extends the existing RDS configuration with advanced backup features

# KMS Key for backup encryption
resource "aws_kms_key" "backup" {
  description             = "KMS key for backup encryption"
  deletion_window_in_days = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda and RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "rds.amazonaws.com"
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-kms-key"
  })
}

resource "aws_kms_alias" "backup" {
  name          = "alias/${local.name_prefix}-backup"
  target_key_id = aws_kms_key.backup.key_id
}

# S3 Bucket for manual backups and exports
resource "aws_s3_bucket" "backup" {
  bucket = "${local.name_prefix}-database-backups-${random_id.bucket_suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-backups"
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "backup" {
  bucket = aws_s3_bucket.backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "backup" {
  bucket = aws_s3_bucket.backup.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.backup.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id

  rule {
    id     = "backup_lifecycle"
    status = "Enabled"

    expiration {
      days = var.backup_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backup" {
  bucket = aws_s3_bucket.backup.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for Lambda backup functions
resource "aws_iam_role" "backup_lambda" {
  name = "${local.name_prefix}-backup-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-lambda-role"
  })
}

resource "aws_iam_role_policy" "backup_lambda" {
  name = "${local.name_prefix}-backup-lambda-policy"
  role = aws_iam_role.backup_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:CreateDBSnapshot",
          "rds:DeleteDBSnapshot",
          "rds:DescribeDBSnapshots",
          "rds:DescribeDBInstances",
          "rds:CopyDBSnapshot",
          "rds:ModifyDBSnapshot",
          "rds:RestoreDBInstanceFromDBSnapshot"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.backup.arn,
          "${aws_s3_bucket.backup.arn}/*"
        ]
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
          aws_kms_key.rds.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.db_credentials.arn
      }
    ]
  })
}

# SNS Topic for backup notifications
resource "aws_sns_topic" "backup_notifications" {
  name = "${local.name_prefix}-backup-notifications"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-notifications"
  })
}

# Lambda function for automated backup management
resource "aws_lambda_function" "backup_manager" {
  filename         = "backup_manager.zip"
  function_name    = "${local.name_prefix}-backup-manager"
  role            = aws_iam_role.backup_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 900
  memory_size     = 256

  environment {
    variables = {
      DB_INSTANCE_ID = aws_db_instance.main.identifier
      S3_BUCKET     = aws_s3_bucket.backup.bucket
      SNS_TOPIC_ARN = aws_sns_topic.backup_notifications.arn
      KMS_KEY_ID    = aws_kms_key.backup.key_id
      RETENTION_DAYS = var.backup_retention_days
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-manager"
  })

  depends_on = [data.archive_file.backup_manager_zip]
}

# Lambda function for backup verification
resource "aws_lambda_function" "backup_verifier" {
  filename         = "backup_verifier.zip"
  function_name    = "${local.name_prefix}-backup-verifier"
  role            = aws_iam_role.backup_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 900
  memory_size     = 512

  environment {
    variables = {
      DB_INSTANCE_ID = aws_db_instance.main.identifier
      S3_BUCKET     = aws_s3_bucket.backup.bucket
      SNS_TOPIC_ARN = aws_sns_topic.backup_notifications.arn
      SECRET_ARN    = aws_secretsmanager_secret.db_credentials.arn
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-verifier"
  })

  depends_on = [data.archive_file.backup_verifier_zip]
}

# EventBridge rules for scheduled backups
resource "aws_cloudwatch_event_rule" "daily_backup" {
  name                = "${local.name_prefix}-daily-backup"
  description         = "Trigger daily backup"
  schedule_expression = "cron(0 2 * * ? *)"  # Daily at 2 AM UTC

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-daily-backup"
  })
}

resource "aws_cloudwatch_event_target" "daily_backup" {
  rule      = aws_cloudwatch_event_rule.daily_backup.name
  target_id = "BackupManagerTarget"
  arn       = aws_lambda_function.backup_manager.arn

  input = jsonencode({
    action = "create_snapshot"
    type   = "daily"
  })
}

resource "aws_lambda_permission" "allow_eventbridge_daily" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup_manager.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_backup.arn
}

# Weekly backup verification
resource "aws_cloudwatch_event_rule" "weekly_verification" {
  name                = "${local.name_prefix}-weekly-verification"
  description         = "Trigger weekly backup verification"
  schedule_expression = "cron(0 4 ? * SUN *)"  # Weekly on Sunday at 4 AM UTC

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-weekly-verification"
  })
}

resource "aws_cloudwatch_event_target" "weekly_verification" {
  rule      = aws_cloudwatch_event_rule.weekly_verification.name
  target_id = "BackupVerifierTarget"
  arn       = aws_lambda_function.backup_verifier.arn
}

resource "aws_lambda_permission" "allow_eventbridge_weekly" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup_verifier.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_verification.arn
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "backup_manager" {
  name              = "/aws/lambda/${aws_lambda_function.backup_manager.function_name}"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-manager-logs"
  })
}

resource "aws_cloudwatch_log_group" "backup_verifier" {
  name              = "/aws/lambda/${aws_lambda_function.backup_verifier.function_name}"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backup-verifier-logs"
  })
}

# Data sources for Lambda deployment packages
data "archive_file" "backup_manager_zip" {
  type        = "zip"
  output_path = "backup_manager.zip"
  source_dir  = "${path.module}/lambda/backup_manager"
}

data "archive_file" "backup_verifier_zip" {
  type        = "zip"
  output_path = "backup_verifier.zip"
  source_dir  = "${path.module}/lambda/backup_verifier"
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}