# AWS Certificate Manager configuration for SSL/TLS certificates
# This file manages SSL certificates for DhakaCart domains

# Variables for domain configuration
variable "domain_name" {
  description = "Primary domain name for DhakaCart"
  type        = string
  default     = "dhakacart.com"
}

variable "subdomain_names" {
  description = "List of subdomain names"
  type        = list(string)
  default     = ["www", "api", "admin"]
}

# Data source for existing hosted zone (if it exists)
data "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 0 : 1
  name  = var.domain_name
}

# Route53 hosted zone (create if needed)
resource "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain_name

  tags = merge(local.common_tags, {
    Name = var.domain_name
    Type = "primary"
  })
}

# Local values for zone reference
locals {
  zone_id = var.create_route53_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.main[0].zone_id
  
  # Generate all domain names (primary + subdomains)
  all_domain_names = concat(
    [var.domain_name],
    [for subdomain in var.subdomain_names : "${subdomain}.${var.domain_name}"]
  )
}

# ACM certificate for the primary domain and subdomains
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = [for subdomain in var.subdomain_names : "${subdomain}.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ssl-certificate"
    Type = "wildcard"
  })
}

# Route53 records for certificate validation
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# Wildcard certificate for additional flexibility
resource "aws_acm_certificate" "wildcard" {
  domain_name       = "*.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-wildcard-certificate"
    Type = "wildcard"
  })
}

# Route53 records for wildcard certificate validation
resource "aws_route53_record" "wildcard_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.wildcard.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

# Wildcard certificate validation
resource "aws_acm_certificate_validation" "wildcard" {
  certificate_arn         = aws_acm_certificate.wildcard.arn
  validation_record_fqdns = [for record in aws_route53_record.wildcard_cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# Variable for Route53 zone creation
variable "create_route53_zone" {
  description = "Whether to create a new Route53 hosted zone"
  type        = bool
  default     = false
}

# Outputs
output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "wildcard_certificate_arn" {
  description = "ARN of the wildcard ACM certificate"
  value       = aws_acm_certificate_validation.wildcard.certificate_arn
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = local.zone_id
}

output "domain_names" {
  description = "All configured domain names"
  value       = local.all_domain_names
}