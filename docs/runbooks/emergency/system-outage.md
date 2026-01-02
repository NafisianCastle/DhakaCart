# System Outage Response Runbook

**Severity**: P0 (Critical)
**Last Updated**: 2024-12-30
**Owner**: DevOps Team
**Review Date**: 2025-03-30

## Overview
This runbook provides procedures for responding to complete or partial system outages affecting the DhakaCart e-commerce platform. A system outage is defined as any condition where users cannot access the application or complete transactions.

## Symptoms
- Application returns 5xx errors or timeouts
- Load balancer health checks failing
- Zero or significantly reduced traffic in monitoring dashboards
- Multiple alerts firing simultaneously
- Customer complaints about site unavailability
- Monitoring dashboards showing red status

## Immediate Actions (< 5 minutes)

### 1. Acknowledge the Incident
```bash
# Check overall system status
kubectl get nodes
kubectl get pods -n dhakacart
kubectl get svc -n dhakacart
kubectl get ingress -n dhakacart
```

### 2. Notify Stakeholders
- Post in #incidents Slack channel: "P0 INCIDENT: System outage detected. Investigating."
- Update status page if available
- Notify on-call manager if outage persists > 5 minutes

### 3. Quick Health Assessment
```bash
# Check application pods
kubectl get pods -n dhakacart -o wide

# Check recent events
kubectl get events -n dhakacart --sort-by='.lastTimestamp' | tail -20

# Check node status
kubectl describe nodes | grep -E "Ready|MemoryPressure|DiskPressure|PIDPressure"
```

### 4. Check External Dependencies
```bash
# Test database connectivity
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run db:check

# Test Redis connectivity
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- npm run redis:check

# Check AWS service status
aws service-health describe-events --regions us-west-2
```

## Investigation (5-15 minutes)

### 1. Application Layer Investigation
```bash
# Check application logs
kubectl logs deployment/dhakacart-backend -n dhakacart --tail=100
kubectl logs deployment/dhakacart-frontend -n dhakacart --tail=100

# Check for recent deployments
kubectl rollout history deployment/dhakacart-backend -n dhakacart
kubectl rollout history deployment/dhakacart-frontend -n dhakacart

# Check resource usage
kubectl top pods -n dhakacart
kubectl describe pods -n dhakacart | grep -E "Limits|Requests|Status"
```

### 2. Infrastructure Layer Investigation
```bash
# Check cluster health
kubectl get componentstatuses
kubectl cluster-info

# Check ingress controller
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=50

# Check DNS resolution
nslookup dhakacart.com
dig dhakacart.com
```

### 3. Database Investigation
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier dhakacart-db

# Check database connections
kubectl exec -it deployment/dhakacart-backend -n dhakacart -- bash
# Inside pod:
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM pg_stat_activity;"
```

### 4. Load Balancer Investigation
```bash
# Check ALB status
aws elbv2 describe-load-balancers --names dhakacart-alb
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# Check security groups
aws ec2 describe-security-groups --group-names dhakacart-alb-sg
```

## Resolution Procedures

### Scenario 1: Application Pod Failures
```bash
# If pods are in CrashLoopBackOff or Error state
kubectl describe pod <pod-name> -n dhakacart

# Check for resource constraints
kubectl top nodes
kubectl describe nodes | grep -A 5 "Allocated resources"

# Restart failed pods
kubectl delete pod <pod-name> -n dhakacart

# If persistent, rollback to previous version
kubectl rollout undo deployment/dhakacart-backend -n dhakacart
kubectl rollout undo deployment/dhakacart-frontend -n dhakacart

# Monitor rollback progress
kubectl rollout status deployment/dhakacart-backend -n dhakacart
```

### Scenario 2: Database Connectivity Issues
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier dhakacart-db

# If database is down, check for automated failover
aws rds describe-db-clusters --db-cluster-identifier dhakacart-cluster

# Force failover if needed (Multi-AZ)
aws rds failover-db-cluster --db-cluster-identifier dhakacart-cluster

# Update connection strings if endpoint changed
kubectl patch secret dhakacart-db-secret -n dhakacart -p '{"data":{"host":"<new-endpoint-base64>"}}'
kubectl rollout restart deployment/dhakacart-backend -n dhakacart
```

### Scenario 3: Load Balancer Issues
```bash
# Check ALB target health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# If targets are unhealthy, check security groups
aws ec2 describe-security-groups --group-ids <security-group-id>

# Recreate ingress if needed
kubectl delete ingress dhakacart-ingress -n dhakacart
kubectl apply -f kubernetes/ingress/dhakacart-ingress.yaml

# Monitor ingress creation
kubectl describe ingress dhakacart-ingress -n dhakacart
```

### Scenario 4: Cluster-Wide Issues
```bash
# Check cluster autoscaler
kubectl logs -n kube-system deployment/cluster-autoscaler --tail=50

# Check for node issues
kubectl get nodes -o wide
kubectl describe nodes | grep -E "Conditions|Taints"

# If nodes are NotReady, check AWS EC2 instances
aws ec2 describe-instances --filters "Name=tag:kubernetes.io/cluster/dhakacart-cluster,Values=owned"

# Scale up node group if needed
aws eks update-nodegroup-config --cluster-name dhakacart-cluster --nodegroup-name main --scaling-config minSize=3,maxSize=15,desiredSize=6
```

### Scenario 5: Network/DNS Issues
```bash
# Check Route 53 records
aws route53 list-resource-record-sets --hosted-zone-id <zone-id>

# Test DNS resolution
nslookup dhakacart.com 8.8.8.8
dig @8.8.8.8 dhakacart.com

# Check certificate status
aws acm describe-certificate --certificate-arn <cert-arn>

# If certificate expired, request new one
aws acm request-certificate --domain-name dhakacart.com --validation-method DNS
```

## Emergency Scaling Procedures

### Immediate Scale-Up
```bash
# Scale backend pods
kubectl scale deployment dhakacart-backend --replicas=10 -n dhakacart

# Scale frontend pods
kubectl scale deployment dhakacart-frontend --replicas=6 -n dhakacart

# Monitor scaling
kubectl get pods -n dhakacart -w
```

### Database Emergency Scaling
```bash
# Scale up RDS instance (requires downtime)
aws rds modify-db-instance --db-instance-identifier dhakacart-db --db-instance-class db.t3.large --apply-immediately

# Add read replica for read traffic
aws rds create-db-instance-read-replica --db-instance-identifier dhakacart-db-replica --source-db-instance-identifier dhakacart-db
```

## Communication Templates

### Initial Incident Notification
```
🚨 P0 INCIDENT - System Outage
Status: Investigating
Impact: Complete service unavailability
ETA: Investigating
Lead: @oncall-engineer

We are investigating reports of service unavailability. Updates every 15 minutes.
```

### Progress Update
```
🚨 P0 INCIDENT - System Outage UPDATE
Status: Root cause identified - [brief description]
Impact: Complete service unavailability
ETA: [estimated resolution time]
Lead: @oncall-engineer

Root cause: [detailed explanation]
Current actions: [what we're doing]
Next update: [time]
```

### Resolution Notification
```
✅ P0 INCIDENT - RESOLVED
Duration: [total time]
Root cause: [brief explanation]
Impact: Complete service unavailability for [duration]

Service has been restored. We will conduct a post-mortem within 24 hours.
```

## Post-Incident Actions

### Immediate (< 1 hour)
1. Verify full service restoration
2. Monitor for any recurring issues
3. Document timeline and actions taken
4. Notify stakeholders of resolution

### Short-term (< 24 hours)
1. Schedule post-mortem meeting
2. Gather all logs and metrics
3. Create incident report
4. Identify immediate preventive measures

### Long-term (< 1 week)
1. Conduct detailed post-mortem
2. Implement preventive measures
3. Update monitoring and alerting
4. Update runbooks based on lessons learned

## Prevention Measures

### Monitoring Improvements
- Implement synthetic monitoring for critical user journeys
- Add more granular health checks
- Set up predictive alerting for resource exhaustion
- Monitor external dependencies

### Infrastructure Improvements
- Implement chaos engineering testing
- Regular disaster recovery drills
- Automated failover testing
- Multi-region deployment consideration

### Process Improvements
- Regular runbook testing and updates
- Incident response training
- Automated incident response workflows
- Better change management processes

## Escalation Procedures

### Escalate to Management (> 30 minutes)
- Contact: DevOps Manager, CTO
- Information needed: Impact assessment, ETA, resource requirements

### Escalate to Vendor Support (> 60 minutes)
- AWS Support: Enterprise support case
- Third-party vendors: Based on SLA agreements
- Provide: Detailed timeline, error messages, attempted solutions

### External Communication (> 2 hours)
- Customer communication via status page
- Social media acknowledgment
- Press/media response if needed

## Related Documentation
- [Database Failure Recovery](database-failure.md)
- [Performance Issues Troubleshooting](../troubleshooting/performance-issues.md)
- [Scaling Procedures](../operations/scaling.md)
- [Deployment Rollback Procedures](../operations/deployment.md)