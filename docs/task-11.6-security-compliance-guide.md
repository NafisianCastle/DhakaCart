# Task 11.6: Security and Compliance Validation Guide

## Overview

This guide provides comprehensive instructions for validating security and compliance configurations in the DhakaCart cloud infrastructure deployment. It covers secrets management, RBAC policies, network security, container security scanning, and SSL/TLS encryption validation.

## Prerequisites

### Required Tools
- AWS CLI (configured with appropriate permissions)
- kubectl (configured for EKS cluster access)
- Helm 3.x
- Trivy (container security scanner)
- PowerShell 7+ (for Windows) or Bash (for Linux/macOS)

### Required Permissions
- AWS IAM permissions for:
  - Secrets Manager read access
  - EKS cluster access
  - EC2 security groups read access
  - ACM certificates read access
  - RDS and ElastiCache read access
  - ELB read access
- Kubernetes RBAC permissions for cluster-wide resource inspection

## Security Validation Components

### 1. Secrets Management Validation

#### AWS Secrets Manager Integration
```powershell
# Check secrets in AWS Secrets Manager
aws secretsmanager list-secrets --region us-west-2 --query 'SecretList[?contains(Name, `dhakacart`)].Name'

# Validate secret rotation configuration
aws secretsmanager describe-secret --secret-id dhakacart/database/credentials --region us-west-2
```

#### External Secrets Operator
```bash
# Check External Secrets Operator deployment
kubectl get deployment -n external-secrets external-secrets-operator

# Validate SecretStore configurations
kubectl get secretstore -A

# Check ExternalSecret resources
kubectl get externalsecret -A
```

#### Application Secret Usage
```bash
# Verify secrets are mounted in application pods
kubectl describe pod -n dhakacart -l app=backend | grep -A 10 "Mounts:"

# Check secret environment variables
kubectl exec -n dhakacart deployment/backend -- env | grep -E "(DB_|REDIS_)"
```

### 2. RBAC Policies Validation

#### Kubernetes RBAC
```bash
# List all roles in the namespace
kubectl get roles -n dhakacart

# List all rolebindings
kubectl get rolebindings -n dhakacart

# Check cluster-wide roles
kubectl get clusterroles | grep dhakacart

# Validate service account permissions
kubectl auth can-i --list --as=system:serviceaccount:dhakacart:backend-sa
```

#### AWS IAM Integration
```bash
# Check EKS service account annotations
kubectl get serviceaccount -n dhakacart -o yaml

# Validate IRSA (IAM Roles for Service Accounts)
aws iam list-roles --query 'Roles[?contains(RoleName, `dhakacart`)].RoleName'
```

### 3. Network Security Configuration

#### Network Policies
```bash
# Check network policies
kubectl get networkpolicies -n dhakacart

# Validate network policy rules
kubectl describe networkpolicy -n dhakacart
```

#### Pod Security Standards
```bash
# Check namespace security labels
kubectl get namespace dhakacart -o yaml | grep -A 5 labels

# Validate pod security context
kubectl get pods -n dhakacart -o jsonpath='{.items[*].spec.securityContext}'
```

#### AWS Security Groups
```bash
# List security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*dhakacart*"

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx --query 'SecurityGroups[0].IpPermissions'
```

### 4. Container Security Scanning

#### Image Vulnerability Scanning
```bash
# Scan images with Trivy
trivy image --severity HIGH,CRITICAL 123456789012.dkr.ecr.us-west-2.amazonaws.com/dhakacart-frontend:latest

# Scan for secrets in images
trivy image --scanners secret 123456789012.dkr.ecr.us-west-2.amazonaws.com/dhakacart-backend:latest

# Generate detailed report
trivy image --format json --output report.json 123456789012.dkr.ecr.us-west-2.amazonaws.com/dhakacart-frontend:latest
```

#### Runtime Security
```bash
# Check for privileged containers
kubectl get pods -n dhakacart -o jsonpath='{.items[*].spec.containers[*].securityContext.privileged}'

# Validate resource limits
kubectl describe pods -n dhakacart | grep -A 5 "Limits:"

# Check for root user usage
kubectl exec -n dhakacart deployment/backend -- whoami
```

### 5. SSL/TLS Encryption Validation

#### Certificate Management
```bash
# List ACM certificates
aws acm list-certificates --region us-west-2

# Check certificate details
aws acm describe-certificate --certificate-arn arn:aws:acm:us-west-2:123456789012:certificate/xxxxxxxx

# Validate certificate chain
openssl s_client -connect your-domain.com:443 -showcerts
```

#### Ingress TLS Configuration
```bash
# Check ingress TLS settings
kubectl get ingress -n dhakacart -o yaml | grep -A 10 tls

# Validate TLS secrets
kubectl get secrets -n dhakacart | grep tls

# Test HTTPS redirect
curl -I http://your-domain.com
```

#### Load Balancer SSL Policies
```bash
# List load balancers
aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s`)].LoadBalancerArn'

# Check SSL policies
aws elbv2 describe-listeners --load-balancer-arn arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/k8s-dhakacart/xxxxxxxxx
```

### 6. Database Encryption Validation

#### RDS Encryption
```bash
# Check RDS encryption status
aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `dhakacart`)].{Name:DBInstanceIdentifier,Encrypted:StorageEncrypted}'

# Validate encryption key
aws rds describe-db-instances --db-instance-identifier dhakacart-postgres --query 'DBInstances[0].KmsKeyId'
```

#### ElastiCache Encryption
```bash
# Check ElastiCache encryption
aws elasticache describe-cache-clusters --query 'CacheClusters[?contains(CacheClusterId, `dhakacart`)].{Name:CacheClusterId,TransitEncryption:TransitEncryptionEnabled}'

# Check at-rest encryption
aws elasticache describe-replication-groups --query 'ReplicationGroups[?contains(ReplicationGroupId, `dhakacart`)].AtRestEncryptionEnabled'
```

## Automated Validation Script

### Running the Validation Script
```powershell
# Run the complete security validation
./scripts/validate-security-compliance.ps1 -Region us-west-2 -ClusterName dhakacart-cluster -Namespace dhakacart

# Run with custom parameters
./scripts/validate-security-compliance.ps1 -Region eu-west-1 -ClusterName my-cluster -Namespace production
```

### Script Output Interpretation
- ✅ Green checkmarks indicate successful validation
- ⚠️ Yellow warnings indicate potential security improvements
- ❌ Red errors indicate security issues that need immediate attention

## Security Best Practices Checklist

### Secrets Management
- [ ] All sensitive data stored in AWS Secrets Manager
- [ ] Secrets rotation enabled where applicable
- [ ] No hardcoded secrets in container images
- [ ] External Secrets Operator properly configured
- [ ] Least privilege access to secrets

### Access Control
- [ ] RBAC policies follow principle of least privilege
- [ ] Service accounts use IRSA for AWS access
- [ ] No overly permissive cluster roles
- [ ] Regular access review and cleanup
- [ ] Multi-factor authentication enabled

### Network Security
- [ ] Network policies restrict pod-to-pod communication
- [ ] Security groups follow least privilege principle
- [ ] No unnecessary open ports
- [ ] Private subnets for application workloads
- [ ] WAF configured for public endpoints

### Container Security
- [ ] Regular vulnerability scanning
- [ ] No HIGH or CRITICAL vulnerabilities in production
- [ ] Non-root user in containers
- [ ] Read-only root filesystem where possible
- [ ] Resource limits configured

### Encryption
- [ ] TLS 1.2+ for all communications
- [ ] Database encryption at rest enabled
- [ ] Backup encryption enabled
- [ ] Secrets encrypted in transit and at rest
- [ ] Valid SSL certificates with proper chain

## Compliance Frameworks

### SOC 2 Type II
- Access controls and authentication
- System monitoring and logging
- Data encryption and protection
- Incident response procedures
- Change management processes

### PCI DSS (if handling payments)
- Network segmentation
- Strong access controls
- Regular security testing
- Secure development practices
- Vulnerability management

### GDPR (if handling EU data)
- Data encryption and pseudonymization
- Access controls and audit trails
- Data retention and deletion policies
- Privacy by design principles
- Breach notification procedures

## Troubleshooting Common Issues

### External Secrets Operator Issues
```bash
# Check operator logs
kubectl logs -n external-secrets deployment/external-secrets-operator

# Validate AWS permissions
aws sts get-caller-identity
aws secretsmanager list-secrets --region us-west-2
```

### Certificate Issues
```bash
# Check certificate status
kubectl describe certificate -n dhakacart

# Validate cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### Network Policy Issues
```bash
# Test connectivity between pods
kubectl exec -n dhakacart deployment/frontend -- curl backend-service:3000/health

# Check network policy logs (if supported by CNI)
kubectl logs -n kube-system daemonset/aws-node
```

## Security Monitoring and Alerting

### Key Security Metrics
- Failed authentication attempts
- Privilege escalation attempts
- Unusual network traffic patterns
- Certificate expiration warnings
- Vulnerability scan results

### Recommended Alerts
- High/Critical vulnerabilities detected
- Certificate expiring within 30 days
- Unusual API access patterns
- Failed secret retrieval attempts
- Network policy violations

## Regular Security Tasks

### Daily
- Monitor security alerts and logs
- Review failed authentication attempts
- Check for new vulnerability reports

### Weekly
- Run container vulnerability scans
- Review access logs and patterns
- Update security patches

### Monthly
- Conduct access review and cleanup
- Test disaster recovery procedures
- Review and update security policies
- Rotate long-term credentials

### Quarterly
- Conduct penetration testing
- Review compliance requirements
- Update security training
- Audit third-party integrations

## Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
- [Kubernetes Security Documentation](https://kubernetes.io/docs/concepts/security/)
- [OWASP Container Security Guide](https://owasp.org/www-project-container-security/)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)