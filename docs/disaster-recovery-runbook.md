# DhakaCart Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for disaster recovery operations for the DhakaCart e-commerce platform. It covers both automated and manual recovery procedures for various failure scenarios.

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [Disaster Recovery Architecture](#disaster-recovery-architecture)
3. [Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)](#recovery-objectives)
4. [Failure Scenarios](#failure-scenarios)
5. [Automated Recovery Procedures](#automated-recovery-procedures)
6. [Manual Recovery Procedures](#manual-recovery-procedures)
7. [Testing Procedures](#testing-procedures)
8. [Post-Recovery Validation](#post-recovery-validation)
9. [Troubleshooting](#troubleshooting)

## Emergency Contacts

### Primary Contacts
- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Database Administrator**: [Name] - [Phone] - [Email]
- **Application Lead**: [Name] - [Phone] - [Email]
- **Security Officer**: [Name] - [Phone] - [Email]

### Escalation Contacts
- **CTO**: [Name] - [Phone] - [Email]
- **CEO**: [Name] - [Phone] - [Email]

### External Contacts
- **AWS Support**: [Support Case URL]
- **Third-party Vendors**: [Contact Information]

## Disaster Recovery Architecture

### Primary Region: us-west-2
- **EKS Cluster**: Production Kubernetes cluster
- **RDS PostgreSQL**: Primary database with Multi-AZ
- **ElastiCache Redis**: Primary cache cluster
- **S3 Buckets**: Application data and backups

### DR Region: us-east-1
- **RDS Read Replica**: Cross-region read replica
- **S3 Replication**: Cross-region backup replication
- **VPC Infrastructure**: Pre-configured DR VPC
- **EKS Cluster**: On-demand DR cluster deployment

### Data Flow
```
Primary Region (us-west-2)     →     DR Region (us-east-1)
├── RDS Primary                →     RDS Read Replica
├── S3 Backups                 →     S3 Replicated Backups
├── Application Logs           →     Centralized Logging
└── Monitoring Data            →     Cross-region Monitoring
```

## Recovery Objectives

### Recovery Time Objectives (RTO)
- **Database Failover**: 5 minutes
- **Application Recovery**: 30 minutes
- **Full Service Restoration**: 2 hours
- **Complete Infrastructure**: 4 hours

### Recovery Point Objectives (RPO)
- **Database**: 1 minute (continuous replication)
- **Application Data**: 15 minutes (backup frequency)
- **Configuration**: 0 minutes (version controlled)

## Failure Scenarios

### Scenario 1: Database Primary Failure
**Symptoms:**
- Database connection errors
- Application unable to read/write data
- RDS monitoring alerts

**Impact:** High - Application unavailable

**Recovery Procedure:** [Database Failover](#database-failover)

### Scenario 2: Application Tier Failure
**Symptoms:**
- HTTP 5xx errors
- Pod crash loops
- Load balancer health check failures

**Impact:** High - Service unavailable

**Recovery Procedure:** [Application Recovery](#application-recovery)

### Scenario 3: Complete Region Failure
**Symptoms:**
- All services in primary region unavailable
- AWS service health dashboard shows region issues
- Multiple monitoring alerts

**Impact:** Critical - Complete service outage

**Recovery Procedure:** [Full Region Failover](#full-region-failover)

### Scenario 4: Data Corruption
**Symptoms:**
- Inconsistent data in application
- Database integrity check failures
- User reports of data issues

**Impact:** Medium to High - Data integrity compromised

**Recovery Procedure:** [Point-in-Time Recovery](#point-in-time-recovery)

## Automated Recovery Procedures

### Database Failover

The system includes automated database failover capabilities:

1. **Multi-AZ Failover** (Primary Region)
   - Automatic failover within 60 seconds
   - No manual intervention required
   - Application automatically reconnects

2. **Cross-Region Failover** (DR Region)
   - Manual promotion of read replica
   - Use disaster recovery scripts

```bash
# Promote DR replica to primary
./scripts/disaster-recovery.sh promote-replica --environment prod --dr-region us-east-1

# Verify promotion
./scripts/disaster-recovery.sh validate-dr --environment prod
```

### Application Auto-Recovery

Kubernetes provides automatic application recovery:

1. **Pod Restart**: Automatic restart of failed pods
2. **Node Replacement**: Auto Scaling Group replaces failed nodes
3. **Health Checks**: Load balancer removes unhealthy instances

## Manual Recovery Procedures

### Database Failover

#### Step 1: Assess the Situation
```bash
# Check primary database status
aws rds describe-db-instances --db-instance-identifier dhakacart-prod-postgresql

# Check DR replica status
aws rds describe-db-instances --region us-east-1 --db-instance-identifier dhakacart-prod-dr-replica
```

#### Step 2: Promote DR Replica
```bash
# Execute failover to DR region
./scripts/disaster-recovery.sh failover --environment prod --dr-region us-east-1
```

#### Step 3: Update Application Configuration
```bash
# Update Kubernetes secrets with new database endpoint
kubectl patch secret db-credentials -p '{"data":{"host":"<new-endpoint-base64>"}}'

# Restart application pods to pick up new configuration
kubectl rollout restart deployment/dhakacart-backend
kubectl rollout restart deployment/dhakacart-frontend
```

#### Step 4: Verify Application Connectivity
```bash
# Test database connectivity
kubectl exec -it deployment/dhakacart-backend -- npm run db:test

# Check application health
curl -f https://api.dhakacart.com/health
```

### Application Recovery

#### Step 1: Identify Failed Components
```bash
# Check pod status
kubectl get pods -n dhakacart

# Check deployment status
kubectl get deployments -n dhakacart

# Check service endpoints
kubectl get endpoints -n dhakacart
```

#### Step 2: Restart Failed Components
```bash
# Restart specific deployment
kubectl rollout restart deployment/dhakacart-backend

# Scale deployment if needed
kubectl scale deployment/dhakacart-backend --replicas=5

# Check rollout status
kubectl rollout status deployment/dhakacart-backend
```

#### Step 3: Verify Load Balancer Health
```bash
# Check ALB target health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# Check ingress status
kubectl describe ingress dhakacart-ingress
```

### Full Region Failover

#### Step 1: Activate DR Region Infrastructure
```bash
# Deploy infrastructure in DR region
cd terraform
terraform workspace select prod-dr
terraform apply -var-file="terraform-dr.tfvars"
```

#### Step 2: Promote Database
```bash
# Promote DR database replica
./scripts/disaster-recovery.sh promote-replica --environment prod --dr-region us-east-1
```

#### Step 3: Deploy Applications
```bash
# Deploy applications to DR region EKS cluster
aws eks update-kubeconfig --region us-east-1 --name dhakacart-prod-dr-eks

# Apply Kubernetes manifests
kubectl apply -f kubernetes/deployments/
kubectl apply -f kubernetes/services/
kubectl apply -f kubernetes/ingress/
```

#### Step 4: Update DNS
```bash
# Update Route 53 records to point to DR region
aws route53 change-resource-record-sets --hosted-zone-id <zone-id> --change-batch file://dns-failover.json
```

### Point-in-Time Recovery

#### Step 1: Identify Recovery Point
```bash
# List available snapshots
aws rds describe-db-snapshots --db-instance-identifier dhakacart-prod-postgresql

# Check automated backups
aws rds describe-db-instances --db-instance-identifier dhakacart-prod-postgresql --query 'DBInstances[0].AutomatedBackupRetentionPeriod'
```

#### Step 2: Create Recovery Instance
```bash
# Restore from point-in-time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier dhakacart-prod-postgresql \
  --target-db-instance-identifier dhakacart-prod-recovery \
  --restore-time "2024-01-15T10:30:00.000Z"
```

#### Step 3: Validate Data Integrity
```bash
# Connect to recovery instance and validate data
psql -h <recovery-endpoint> -U dhakacart_admin -d dhakacart

# Run data validation queries
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders WHERE created_at > '2024-01-15';
```

#### Step 4: Switch to Recovery Instance
```bash
# Update application configuration
kubectl patch secret db-credentials -p '{"data":{"host":"<recovery-endpoint-base64>"}}'

# Restart applications
kubectl rollout restart deployment/dhakacart-backend
```

## Testing Procedures

### Monthly DR Test

Execute monthly disaster recovery tests to ensure procedures work correctly:

```bash
# Run comprehensive DR test
./scripts/disaster-recovery.sh test-dr --environment staging

# Test backup verification
./scripts/backup-testing.sh verify-backups --environment staging

# Test application deployment in DR region
./scripts/disaster-recovery.sh sync-infrastructure --environment staging --dr-region us-east-1
```

### Quarterly Full Failover Test

Perform quarterly full failover tests during maintenance windows:

1. **Pre-Test Checklist**
   - [ ] Notify stakeholders
   - [ ] Verify backup integrity
   - [ ] Check DR region readiness
   - [ ] Prepare rollback plan

2. **Execute Test**
   ```bash
   # Execute full failover test
   ./scripts/disaster-recovery.sh failover --environment staging --dr-region us-east-1
   ```

3. **Validate Services**
   - [ ] Database connectivity
   - [ ] Application functionality
   - [ ] Monitoring and alerting
   - [ ] Performance metrics

4. **Execute Failback**
   ```bash
   # Failback to primary region
   ./scripts/disaster-recovery.sh failback --environment staging
   ```

## Post-Recovery Validation

### Database Validation
```sql
-- Check database connectivity
SELECT version();

-- Validate data integrity
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM users;

-- Check recent transactions
SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour';
```

### Application Validation
```bash
# Health check endpoints
curl -f https://api.dhakacart.com/health
curl -f https://dhakacart.com/health

# Test critical user flows
curl -X POST https://api.dhakacart.com/api/products -H "Content-Type: application/json" -d '{"test": true}'

# Check monitoring dashboards
# - Grafana: https://monitoring.dhakacart.com
# - Kibana: https://logs.dhakacart.com
```

### Performance Validation
```bash
# Run load test to verify performance
artillery run load-test.yml

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.dhakacart.com/api/products

# Monitor resource utilization
kubectl top nodes
kubectl top pods
```

## Troubleshooting

### Common Issues

#### Database Connection Failures
**Symptoms:** Application cannot connect to database
**Causes:**
- Security group misconfiguration
- DNS resolution issues
- Credential problems

**Resolution:**
```bash
# Check security groups
aws ec2 describe-security-groups --group-ids <db-security-group-id>

# Test DNS resolution
nslookup <db-endpoint>

# Verify credentials
aws secretsmanager get-secret-value --secret-id dhakacart-prod-db-credentials
```

#### Application Pod Failures
**Symptoms:** Pods in CrashLoopBackOff state
**Causes:**
- Resource constraints
- Configuration errors
- Image pull failures

**Resolution:**
```bash
# Check pod logs
kubectl logs <pod-name> --previous

# Check resource usage
kubectl describe pod <pod-name>

# Check node resources
kubectl describe node <node-name>
```

#### Load Balancer Issues
**Symptoms:** 502/503 errors from load balancer
**Causes:**
- No healthy targets
- Health check failures
- Security group issues

**Resolution:**
```bash
# Check target group health
aws elbv2 describe-target-health --target-group-arn <arn>

# Check service endpoints
kubectl get endpoints

# Verify health check configuration
kubectl describe ingress dhakacart-ingress
```

### Emergency Escalation

If standard procedures fail:

1. **Immediate Actions**
   - Contact DevOps Lead
   - Create AWS Support case (if applicable)
   - Document all actions taken

2. **Communication**
   - Update status page
   - Notify stakeholders
   - Prepare customer communication

3. **Escalation Path**
   - DevOps Lead → CTO → CEO
   - Engage AWS Support (Enterprise)
   - Consider third-party assistance

## Recovery Checklist

### Pre-Recovery
- [ ] Assess impact and scope
- [ ] Notify stakeholders
- [ ] Gather relevant logs and metrics
- [ ] Identify root cause (if possible)
- [ ] Choose appropriate recovery procedure

### During Recovery
- [ ] Execute recovery procedure
- [ ] Monitor progress continuously
- [ ] Document all actions taken
- [ ] Communicate status updates
- [ ] Prepare for potential rollback

### Post-Recovery
- [ ] Validate all services
- [ ] Monitor for issues
- [ ] Update stakeholders
- [ ] Conduct post-mortem
- [ ] Update procedures if needed
- [ ] Schedule follow-up testing

## Contact Information

For questions about this runbook or disaster recovery procedures:

- **Documentation Owner**: DevOps Team
- **Last Updated**: [Date]
- **Next Review**: [Date + 3 months]
- **Version**: 1.0

## Appendix

### Useful Commands Reference

```bash
# AWS CLI
aws rds describe-db-instances
aws eks describe-cluster
aws s3 ls
aws logs describe-log-groups

# Kubernetes
kubectl get all -n dhakacart
kubectl describe pod <pod-name>
kubectl logs <pod-name> --follow
kubectl exec -it <pod-name> -- /bin/bash

# Terraform
terraform workspace list
terraform plan
terraform apply
terraform destroy

# Monitoring
curl -f <health-endpoint>
dig <domain-name>
telnet <host> <port>
```

### Configuration Files

- **Terraform Variables**: `terraform/terraform-dr.tfvars`
- **Kubernetes Manifests**: `kubernetes/`
- **Monitoring Config**: `kubernetes/monitoring/`
- **Backup Scripts**: `scripts/backup-testing.sh`
- **DR Scripts**: `scripts/disaster-recovery.sh`