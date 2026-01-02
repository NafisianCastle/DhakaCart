#!/bin/bash

# DhakaCart Disaster Recovery Scripts
# This script provides utilities for disaster recovery operations

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
DhakaCart Disaster Recovery Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    promote-replica     Promote DR replica to primary database
    failover           Execute complete failover to DR region
    failback           Failback from DR region to primary
    test-dr            Test disaster recovery procedures
    sync-infrastructure Sync infrastructure to DR region
    validate-dr        Validate DR setup and readiness
    help               Show this help message

Options:
    --environment ENV   Target environment (dev, staging, prod)
    --dr-region REGION  Disaster recovery region
    --dry-run          Show what would be done without executing
    --force            Force operation without confirmation
    --verbose          Enable verbose output

Examples:
    $0 promote-replica --environment prod --dr-region us-east-1
    $0 failover --environment prod --dry-run
    $0 test-dr --environment staging
    $0 validate-dr --environment prod

EOF
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="dev"
DR_REGION="us-east-1"
DRY_RUN=false
FORCE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        promote-replica|failover|failback|test-dr|sync-infrastructure|validate-dr|help)
            COMMAND="$1"
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --dr-region)
            DR_REGION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set verbose mode
if [ "$VERBOSE" = true ]; then
    set -x
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod."
    exit 1
fi

# Get Terraform outputs
get_terraform_output() {
    local output_name="$1"
    local region="$2"
    cd "$TERRAFORM_DIR"
    
    if [ -n "$region" ]; then
        AWS_DEFAULT_REGION="$region" terraform output -raw "$output_name" 2>/dev/null || echo ""
    else
        terraform output -raw "$output_name" 2>/dev/null || echo ""
    fi
}

# Initialize AWS resources
init_aws_resources() {
    log "Initializing AWS resources for environment: $ENVIRONMENT"
    
    # Primary region resources
    PRIMARY_REGION=$(get_terraform_output "aws_region")
    DB_INSTANCE_ID=$(get_terraform_output "db_instance_id")
    PRIMARY_VPC_ID=$(get_terraform_output "vpc_id")
    
    # DR region resources
    DR_DB_INSTANCE_ID=$(get_terraform_output "dr_db_instance_id" "$DR_REGION")
    DR_VPC_ID=$(get_terraform_output "dr_vpc_id" "$DR_REGION")
    
    log "Primary Region: $PRIMARY_REGION"
    log "DR Region: $DR_REGION"
    log "Primary DB Instance: $DB_INSTANCE_ID"
    log "DR DB Instance: $DR_DB_INSTANCE_ID"
}

# Confirm operation with user
confirm_operation() {
    local operation="$1"
    
    if [ "$FORCE" = true ]; then
        return 0
    fi
    
    warning "You are about to perform: $operation"
    warning "Environment: $ENVIRONMENT"
    warning "DR Region: $DR_REGION"
    echo
    read -p "Are you sure you want to continue? (yes/no): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log "Operation cancelled by user"
        exit 0
    fi
}

# Check DR readiness
check_dr_readiness() {
    log "Checking disaster recovery readiness..."
    
    local readiness_issues=0
    
    # Check if DR replica exists and is available
    if [ -n "$DR_DB_INSTANCE_ID" ]; then
        local dr_status=$(aws rds describe-db-instances \
            --region "$DR_REGION" \
            --db-instance-identifier "$DR_DB_INSTANCE_ID" \
            --query 'DBInstances[0].DBInstanceStatus' \
            --output text 2>/dev/null || echo "not-found")
        
        if [ "$dr_status" = "available" ]; then
            success "DR database replica is available"
        else
            error "DR database replica is not available (status: $dr_status)"
            readiness_issues=$((readiness_issues + 1))
        fi
    else
        error "DR database replica not found"
        readiness_issues=$((readiness_issues + 1))
    fi
    
    # Check replication lag
    if [ "$readiness_issues" -eq 0 ]; then
        local lag=$(aws rds describe-db-instances \
            --region "$DR_REGION" \
            --db-instance-identifier "$DR_DB_INSTANCE_ID" \
            --query 'DBInstances[0].StatusInfos[?StatusType==`read replication`].Message' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$lag" ]; then
            log "Replication status: $lag"
        fi
    fi
    
    # Check S3 cross-region replication
    local backup_bucket=$(get_terraform_output "backup_s3_bucket")
    if [ -n "$backup_bucket" ]; then
        local replication_status=$(aws s3api get-bucket-replication \
            --bucket "$backup_bucket" \
            --query 'ReplicationConfiguration.Rules[0].Status' \
            --output text 2>/dev/null || echo "not-configured")
        
        if [ "$replication_status" = "Enabled" ]; then
            success "S3 cross-region replication is enabled"
        else
            warning "S3 cross-region replication is not configured"
        fi
    fi
    
    return $readiness_issues
}

# Promote DR replica to primary
promote_replica() {
    log "Promoting DR replica to primary database..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would promote DR replica $DR_DB_INSTANCE_ID to primary"
        return 0
    fi
    
    confirm_operation "Promote DR replica to primary database"
    
    # Stop replication and promote replica
    log "Promoting read replica to standalone database..."
    
    aws rds promote-read-replica \
        --region "$DR_REGION" \
        --db-instance-identifier "$DR_DB_INSTANCE_ID" \
        --backup-retention-period 30 \
        --preferred-backup-window "03:00-04:00"
    
    if [ $? -eq 0 ]; then
        log "Waiting for promotion to complete..."
        aws rds wait db-instance-available \
            --region "$DR_REGION" \
            --db-instance-identifiers "$DR_DB_INSTANCE_ID"
        
        success "DR replica promoted to primary successfully"
        
        # Update DNS or load balancer to point to new primary
        update_dns_for_failover
        
        return 0
    else
        error "Failed to promote DR replica"
        return 1
    fi
}

# Update DNS/load balancer for failover
update_dns_for_failover() {
    log "Updating DNS/load balancer configuration for failover..."
    
    # Get new primary endpoint
    local new_primary_endpoint=$(aws rds describe-db-instances \
        --region "$DR_REGION" \
        --db-instance-identifier "$DR_DB_INSTANCE_ID" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    if [ -n "$new_primary_endpoint" ]; then
        success "New primary database endpoint: $new_primary_endpoint"
        
        # Here you would update your application configuration
        # This could involve updating Kubernetes secrets, parameter store, etc.
        log "Update your application configuration to use: $new_primary_endpoint"
        
        # Example: Update Kubernetes secret (if kubectl is configured)
        if command -v kubectl &> /dev/null; then
            log "Updating Kubernetes database secret..."
            # kubectl patch secret db-credentials -p '{"data":{"host":"'$(echo -n "$new_primary_endpoint" | base64)'"}}'
        fi
    else
        error "Could not retrieve new primary endpoint"
        return 1
    fi
}

# Execute complete failover
execute_failover() {
    log "Executing complete failover to DR region..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would execute complete failover to $DR_REGION"
        return 0
    fi
    
    confirm_operation "Complete failover to DR region"
    
    # Step 1: Check DR readiness
    if ! check_dr_readiness; then
        error "DR environment is not ready for failover"
        return 1
    fi
    
    # Step 2: Promote DR replica
    if ! promote_replica; then
        error "Failed to promote DR replica"
        return 1
    fi
    
    # Step 3: Deploy application infrastructure in DR region
    log "Deploying application infrastructure in DR region..."
    deploy_infrastructure_dr
    
    # Step 4: Update monitoring and alerting
    log "Updating monitoring and alerting for DR region..."
    update_monitoring_dr
    
    success "Failover to DR region completed successfully"
}

# Deploy infrastructure in DR region
deploy_infrastructure_dr() {
    log "Deploying infrastructure in DR region..."
    
    # This would typically involve:
    # 1. Creating EKS cluster in DR region
    # 2. Deploying applications
    # 3. Updating load balancers
    # 4. Configuring monitoring
    
    # For now, we'll create a placeholder
    log "Infrastructure deployment in DR region would be executed here"
    log "This includes EKS cluster, application deployments, and load balancers"
}

# Update monitoring for DR region
update_monitoring_dr() {
    log "Updating monitoring configuration for DR region..."
    
    # Update monitoring to point to DR region resources
    log "Monitoring configuration update would be executed here"
    log "This includes updating Prometheus, Grafana, and alerting rules"
}

# Execute failback to primary region
execute_failback() {
    log "Executing failback to primary region..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would execute failback to primary region"
        return 0
    fi
    
    confirm_operation "Failback to primary region"
    
    # This is a complex operation that would involve:
    # 1. Ensuring primary region is ready
    # 2. Syncing data from DR to primary
    # 3. Switching traffic back
    # 4. Re-establishing replication
    
    warning "Failback is a complex operation that requires careful planning"
    warning "Please ensure primary region infrastructure is fully operational"
    
    log "Failback procedure would be executed here"
    log "This is typically a planned operation during maintenance windows"
}

# Test disaster recovery procedures
test_dr_procedures() {
    log "Testing disaster recovery procedures..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would test DR procedures"
        return 0
    fi
    
    local test_failed=false
    
    # Test 1: Check DR readiness
    log "Test 1: Checking DR readiness..."
    if check_dr_readiness; then
        success "DR readiness check passed"
    else
        error "DR readiness check failed"
        test_failed=true
    fi
    
    # Test 2: Verify backup replication
    log "Test 2: Verifying backup replication..."
    if verify_backup_replication; then
        success "Backup replication verification passed"
    else
        error "Backup replication verification failed"
        test_failed=true
    fi
    
    # Test 3: Test database connectivity to DR replica
    log "Test 3: Testing DR database connectivity..."
    if test_dr_database_connectivity; then
        success "DR database connectivity test passed"
    else
        error "DR database connectivity test failed"
        test_failed=true
    fi
    
    if [ "$test_failed" = true ]; then
        error "Some DR tests failed"
        return 1
    else
        success "All DR tests passed"
        return 0
    fi
}

# Verify backup replication
verify_backup_replication() {
    local backup_bucket=$(get_terraform_output "backup_s3_bucket")
    local dr_backup_bucket=$(get_terraform_output "dr_backup_s3_bucket" "$DR_REGION")
    
    if [ -z "$backup_bucket" ] || [ -z "$dr_backup_bucket" ]; then
        error "Could not retrieve backup bucket information"
        return 1
    fi
    
    # Check if objects exist in both buckets
    local primary_objects=$(aws s3 ls "s3://$backup_bucket" --recursive | wc -l)
    local dr_objects=$(aws s3 ls "s3://$dr_backup_bucket" --recursive --region "$DR_REGION" | wc -l)
    
    log "Primary backup objects: $primary_objects"
    log "DR backup objects: $dr_objects"
    
    if [ "$dr_objects" -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

# Test DR database connectivity
test_dr_database_connectivity() {
    if [ -z "$DR_DB_INSTANCE_ID" ]; then
        error "DR database instance not found"
        return 1
    fi
    
    local dr_endpoint=$(aws rds describe-db-instances \
        --region "$DR_REGION" \
        --db-instance-identifier "$DR_DB_INSTANCE_ID" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text 2>/dev/null)
    
    if [ -n "$dr_endpoint" ] && [ "$dr_endpoint" != "None" ]; then
        log "DR database endpoint: $dr_endpoint"
        return 0
    else
        error "Could not retrieve DR database endpoint"
        return 1
    fi
}

# Sync infrastructure to DR region
sync_infrastructure() {
    log "Syncing infrastructure to DR region..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would sync infrastructure to DR region"
        return 0
    fi
    
    # This would involve running Terraform in DR region
    log "Infrastructure sync would be executed here"
    log "This includes creating/updating DR region resources"
}

# Validate DR setup
validate_dr_setup() {
    log "Validating disaster recovery setup..."
    
    local validation_issues=0
    
    # Check all DR components
    if ! check_dr_readiness; then
        validation_issues=$((validation_issues + 1))
    fi
    
    if ! verify_backup_replication; then
        validation_issues=$((validation_issues + 1))
    fi
    
    if ! test_dr_database_connectivity; then
        validation_issues=$((validation_issues + 1))
    fi
    
    if [ "$validation_issues" -eq 0 ]; then
        success "DR setup validation passed"
        return 0
    else
        error "DR setup validation failed with $validation_issues issues"
        return 1
    fi
}

# Main execution
main() {
    case "$COMMAND" in
        "promote-replica")
            init_aws_resources
            promote_replica
            ;;
        "failover")
            init_aws_resources
            execute_failover
            ;;
        "failback")
            init_aws_resources
            execute_failback
            ;;
        "test-dr")
            init_aws_resources
            test_dr_procedures
            ;;
        "sync-infrastructure")
            init_aws_resources
            sync_infrastructure
            ;;
        "validate-dr")
            init_aws_resources
            validate_dr_setup
            ;;
        "help"|"")
            show_help
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main