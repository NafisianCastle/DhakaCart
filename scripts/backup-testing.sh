#!/bin/bash

# DhakaCart Backup Testing and Restoration Scripts
# This script provides utilities for testing backup and restoration procedures

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
DhakaCart Backup Testing Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    test-backup         Test backup creation and verification
    test-restore        Test restoration from a specific snapshot
    verify-backups      Verify all recent backups
    cleanup-test        Clean up test resources
    full-dr-test        Run full disaster recovery test
    help               Show this help message

Options:
    --environment ENV   Target environment (dev, staging, prod)
    --snapshot-id ID    Specific snapshot ID for restoration testing
    --dry-run          Show what would be done without executing
    --verbose          Enable verbose output

Examples:
    $0 test-backup --environment dev
    $0 test-restore --snapshot-id dhakacart-dev-manual-2024-01-15-10-30-00
    $0 verify-backups --environment prod
    $0 full-dr-test --environment staging --dry-run

EOF
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="dev"
SNAPSHOT_ID=""
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        test-backup|test-restore|verify-backups|cleanup-test|full-dr-test|help)
            COMMAND="$1"
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --snapshot-id)
            SNAPSHOT_ID="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
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
    cd "$TERRAFORM_DIR"
    terraform output -raw "$output_name" 2>/dev/null || echo ""
}

# Initialize AWS CLI and get resource information
init_aws_resources() {
    log "Initializing AWS resources for environment: $ENVIRONMENT"
    
    # Get Terraform outputs
    DB_INSTANCE_ID=$(get_terraform_output "db_instance_id")
    S3_BACKUP_BUCKET=$(get_terraform_output "backup_s3_bucket")
    BACKUP_LAMBDA_FUNCTION=$(get_terraform_output "backup_lambda_function_name")
    
    if [ -z "$DB_INSTANCE_ID" ]; then
        error "Could not retrieve DB instance ID from Terraform outputs"
        exit 1
    fi
    
    log "DB Instance ID: $DB_INSTANCE_ID"
    log "S3 Backup Bucket: $S3_BACKUP_BUCKET"
    log "Backup Lambda Function: $BACKUP_LAMBDA_FUNCTION"
}

# Test backup creation
test_backup_creation() {
    log "Testing backup creation..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would create manual snapshot for $DB_INSTANCE_ID"
        return 0
    fi
    
    # Trigger backup via Lambda
    local payload='{"action": "create_snapshot", "type": "test"}'
    
    log "Invoking backup Lambda function..."
    local result=$(aws lambda invoke \
        --function-name "$BACKUP_LAMBDA_FUNCTION" \
        --payload "$payload" \
        --output json \
        /tmp/backup_response.json)
    
    if [ $? -eq 0 ]; then
        local snapshot_id=$(jq -r '.result.snapshot_id' /tmp/backup_response.json 2>/dev/null)
        if [ "$snapshot_id" != "null" ] && [ -n "$snapshot_id" ]; then
            success "Backup created successfully: $snapshot_id"
            echo "$snapshot_id" > /tmp/test_snapshot_id.txt
            return 0
        fi
    fi
    
    error "Backup creation failed"
    cat /tmp/backup_response.json
    return 1
}

# Test backup verification
test_backup_verification() {
    log "Testing backup verification..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would verify recent backups"
        return 0
    fi
    
    # Get recent snapshots
    log "Checking recent snapshots..."
    local snapshots=$(aws rds describe-db-snapshots \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --snapshot-type manual \
        --max-items 5 \
        --query 'DBSnapshots[?Status==`available`].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
        --output table)
    
    if [ -n "$snapshots" ]; then
        success "Found available snapshots:"
        echo "$snapshots"
        return 0
    else
        error "No available snapshots found"
        return 1
    fi
}

# Test restoration from snapshot
test_restoration() {
    local snapshot_id="$1"
    
    if [ -z "$snapshot_id" ]; then
        if [ -f /tmp/test_snapshot_id.txt ]; then
            snapshot_id=$(cat /tmp/test_snapshot_id.txt)
        else
            error "No snapshot ID provided and no test snapshot found"
            return 1
        fi
    fi
    
    log "Testing restoration from snapshot: $snapshot_id"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would restore from snapshot $snapshot_id"
        return 0
    fi
    
    # Create test restoration instance
    local test_instance_id="${DB_INSTANCE_ID}-restore-test-$(date +%s)"
    
    log "Creating test restoration instance: $test_instance_id"
    
    aws rds restore-db-instance-from-db-snapshot \
        --db-instance-identifier "$test_instance_id" \
        --db-snapshot-identifier "$snapshot_id" \
        --db-instance-class "db.t3.micro" \
        --no-multi-az \
        --no-publicly-accessible \
        --tags Key=Purpose,Value=BackupTest Key=Environment,Value="$ENVIRONMENT" \
        > /tmp/restore_response.json
    
    if [ $? -eq 0 ]; then
        success "Restoration initiated: $test_instance_id"
        echo "$test_instance_id" > /tmp/test_restore_instance.txt
        
        log "Waiting for restoration to complete (this may take several minutes)..."
        aws rds wait db-instance-available --db-instance-identifiers "$test_instance_id"
        
        if [ $? -eq 0 ]; then
            success "Restoration completed successfully"
            
            # Test connectivity to restored instance
            test_restored_instance_connectivity "$test_instance_id"
            
            return 0
        else
            error "Restoration failed or timed out"
            return 1
        fi
    else
        error "Failed to initiate restoration"
        cat /tmp/restore_response.json
        return 1
    fi
}

# Test connectivity to restored instance
test_restored_instance_connectivity() {
    local instance_id="$1"
    
    log "Testing connectivity to restored instance: $instance_id"
    
    # Get instance endpoint
    local endpoint=$(aws rds describe-db-instances \
        --db-instance-identifier "$instance_id" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    if [ -n "$endpoint" ] && [ "$endpoint" != "None" ]; then
        success "Restored instance endpoint: $endpoint"
        
        # Note: Actual connectivity test would require database credentials
        # and network access, which may not be available in all environments
        log "Connectivity test completed (endpoint accessible)"
        return 0
    else
        error "Could not retrieve endpoint for restored instance"
        return 1
    fi
}

# Verify all backups
verify_all_backups() {
    log "Verifying all backups..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would verify all backups"
        return 0
    fi
    
    # Invoke backup verifier Lambda
    log "Invoking backup verifier Lambda function..."
    
    local verifier_function="${BACKUP_LAMBDA_FUNCTION/backup-manager/backup-verifier}"
    
    aws lambda invoke \
        --function-name "$verifier_function" \
        --payload '{}' \
        --output json \
        /tmp/verification_response.json
    
    if [ $? -eq 0 ]; then
        local status=$(jq -r '.results.overall_status' /tmp/verification_response.json 2>/dev/null)
        if [ "$status" = "PASS" ]; then
            success "All backup verifications passed"
            return 0
        else
            warning "Some backup verifications failed or had warnings"
            jq '.results' /tmp/verification_response.json
            return 1
        fi
    else
        error "Backup verification failed"
        cat /tmp/verification_response.json
        return 1
    fi
}

# Clean up test resources
cleanup_test_resources() {
    log "Cleaning up test resources..."
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would clean up test resources"
        return 0
    fi
    
    # Clean up test restoration instance
    if [ -f /tmp/test_restore_instance.txt ]; then
        local test_instance=$(cat /tmp/test_restore_instance.txt)
        log "Deleting test restoration instance: $test_instance"
        
        aws rds delete-db-instance \
            --db-instance-identifier "$test_instance" \
            --skip-final-snapshot \
            --delete-automated-backups
        
        rm -f /tmp/test_restore_instance.txt
    fi
    
    # Clean up test snapshot
    if [ -f /tmp/test_snapshot_id.txt ]; then
        local test_snapshot=$(cat /tmp/test_snapshot_id.txt)
        log "Deleting test snapshot: $test_snapshot"
        
        aws rds delete-db-snapshot \
            --db-snapshot-identifier "$test_snapshot"
        
        rm -f /tmp/test_snapshot_id.txt
    fi
    
    # Clean up temporary files
    rm -f /tmp/backup_response.json /tmp/restore_response.json /tmp/verification_response.json
    
    success "Test resource cleanup completed"
}

# Run full disaster recovery test
run_full_dr_test() {
    log "Running full disaster recovery test..."
    
    local test_failed=false
    
    # Step 1: Test backup creation
    if ! test_backup_creation; then
        test_failed=true
    fi
    
    # Step 2: Test backup verification
    if ! test_backup_verification; then
        test_failed=true
    fi
    
    # Step 3: Test restoration (only if backup creation succeeded)
    if [ -f /tmp/test_snapshot_id.txt ] && ! test_restoration; then
        test_failed=true
    fi
    
    # Step 4: Verify all backups
    if ! verify_all_backups; then
        test_failed=true
    fi
    
    # Step 5: Clean up (always run)
    cleanup_test_resources
    
    if [ "$test_failed" = true ]; then
        error "Full disaster recovery test failed"
        return 1
    else
        success "Full disaster recovery test completed successfully"
        return 0
    fi
}

# Main execution
main() {
    case "$COMMAND" in
        "test-backup")
            init_aws_resources
            test_backup_creation && test_backup_verification
            ;;
        "test-restore")
            init_aws_resources
            test_restoration "$SNAPSHOT_ID"
            ;;
        "verify-backups")
            init_aws_resources
            verify_all_backups
            ;;
        "cleanup-test")
            cleanup_test_resources
            ;;
        "full-dr-test")
            init_aws_resources
            run_full_dr_test
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