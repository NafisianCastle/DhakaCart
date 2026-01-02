# IAM roles and policies for Kubernetes RBAC integration
# This file defines IAM roles that map to Kubernetes RBAC roles

# IAM role for developers (read-only access)
resource "aws_iam_role" "dhakacart_developer_role" {
  name = "${local.name_prefix}-developer-role"

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
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:dhakacart:developer-*"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Role = "developer"
  })
}

# IAM policy for developers (read-only EKS access)
resource "aws_iam_policy" "dhakacart_developer_policy" {
  name        = "${local.name_prefix}-developer-policy"
  description = "Policy for DhakaCart developers with read-only access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = aws_eks_cluster.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:GetLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/eks/${local.name_prefix}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "developer_policy_attachment" {
  role       = aws_iam_role.dhakacart_developer_role.name
  policy_arn = aws_iam_policy.dhakacart_developer_policy.arn
}

# IAM role for operators (full access)
resource "aws_iam_role" "dhakacart_operator_role" {
  name = "${local.name_prefix}-operator-role"

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
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:dhakacart:operator-*"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Role = "operator"
  })
}

# IAM policy for operators (full EKS and related services access)
resource "aws_iam_policy" "dhakacart_operator_policy" {
  name        = "${local.name_prefix}-operator-policy"
  description = "Policy for DhakaCart operators with full access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "eks:*"
        ]
        Resource = [
          aws_eks_cluster.main.arn,
          "${aws_eks_cluster.main.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:*"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/eks/${local.name_prefix}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:UpdateSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.app_secrets.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticache:DescribeCacheClusters",
          "elasticache:DescribeReplicationGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "operator_policy_attachment" {
  role       = aws_iam_role.dhakacart_operator_role.name
  policy_arn = aws_iam_policy.dhakacart_operator_policy.arn
}

# IAM role for CI/CD pipeline
resource "aws_iam_role" "dhakacart_cicd_role" {
  name = "${local.name_prefix}-cicd-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Role = "cicd"
  })
}

# IAM policy for CI/CD pipeline
resource "aws_iam_policy" "dhakacart_cicd_policy" {
  name        = "${local.name_prefix}-cicd-policy"
  description = "Policy for DhakaCart CI/CD pipeline"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = aws_eks_cluster.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = [
          aws_ecr_repository.frontend.arn,
          aws_ecr_repository.backend.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cicd_policy_attachment" {
  role       = aws_iam_role.dhakacart_cicd_role.name
  policy_arn = aws_iam_policy.dhakacart_cicd_policy.arn
}

# EKS cluster auth config map update
resource "kubernetes_config_map_v1_data" "aws_auth" {
  metadata {
    name      = "aws-auth"
    namespace = "kube-system"
  }

  data = {
    mapRoles = yamlencode([
      {
        rolearn  = aws_iam_role.eks_node_group.arn
        username = "system:node:{{EC2PrivateDNSName}}"
        groups = [
          "system:bootstrappers",
          "system:nodes"
        ]
      },
      {
        rolearn  = aws_iam_role.dhakacart_developer_role.arn
        username = "dhakacart-developer"
        groups = [
          "dhakacart-developers"
        ]
      },
      {
        rolearn  = aws_iam_role.dhakacart_operator_role.arn
        username = "dhakacart-operator"
        groups = [
          "dhakacart-operators"
        ]
      }
    ])
  }

  force = true

  depends_on = [
    aws_eks_cluster.main,
    aws_eks_node_group.main
  ]
}

# Outputs
output "iam_roles" {
  description = "IAM roles for different access levels"
  value = {
    developer_role_arn = aws_iam_role.dhakacart_developer_role.arn
    operator_role_arn  = aws_iam_role.dhakacart_operator_role.arn
    cicd_role_arn      = aws_iam_role.dhakacart_cicd_role.arn
  }
}