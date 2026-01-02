import json
import boto3
import os
from datetime import datetime, timedelta
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
rds_client = boto3.client('rds')
s3_client = boto3.client('s3')
sns_client = boto3.client('sns')

def handler(event, context):
    """
    Lambda function to manage RDS backups
    Supports creating snapshots, cleaning up old snapshots, and managing retention
    """
    try:
        action = event.get('action', 'create_snapshot')
        backup_type = event.get('type', 'manual')
        
        db_instance_id = os.environ['DB_INSTANCE_ID']
        s3_bucket = os.environ['S3_BUCKET']
        sns_topic_arn = os.environ['SNS_TOPIC_ARN']
        kms_key_id = os.environ['KMS_KEY_ID']
        retention_days = int(os.environ['RETENTION_DAYS'])
        
        logger.info(f"Starting backup operation: {action} for {db_instance_id}")
        
        if action == 'create_snapshot':
            result = create_snapshot(db_instance_id, backup_type, kms_key_id)
        elif action == 'cleanup_snapshots':
            result = cleanup_old_snapshots(db_instance_id, retention_days)
        elif action == 'export_snapshot':
            snapshot_id = event.get('snapshot_id')
            result = export_snapshot_to_s3(snapshot_id, s3_bucket, kms_key_id)
        else:
            raise ValueError(f"Unknown action: {action}")
        
        # Send success notification
        send_notification(sns_topic_arn, f"Backup operation successful: {action}", result, "SUCCESS")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Backup operation {action} completed successfully',
                'result': result
            })
        }
        
    except Exception as e:
        error_message = f"Backup operation failed: {str(e)}"
        logger.error(error_message)
        
        # Send failure notification
        send_notification(sns_topic_arn, "Backup operation failed", error_message, "ERROR")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': error_message
            })
        }

def create_snapshot(db_instance_id, backup_type, kms_key_id):
    """Create a manual snapshot of the RDS instance"""
    timestamp = datetime.utcnow().strftime('%Y-%m-%d-%H-%M-%S')
    snapshot_id = f"{db_instance_id}-{backup_type}-{timestamp}"
    
    logger.info(f"Creating snapshot: {snapshot_id}")
    
    response = rds_client.create_db_snapshot(
        DBSnapshotIdentifier=snapshot_id,
        DBInstanceIdentifier=db_instance_id,
        Tags=[
            {
                'Key': 'BackupType',
                'Value': backup_type
            },
            {
                'Key': 'CreatedBy',
                'Value': 'automated-backup-system'
            },
            {
                'Key': 'Timestamp',
                'Value': timestamp
            }
        ]
    )
    
    # Wait for snapshot to be available (for verification)
    waiter = rds_client.get_waiter('db_snapshot_completed')
    waiter.wait(
        DBSnapshotIdentifier=snapshot_id,
        WaiterConfig={
            'Delay': 30,
            'MaxAttempts': 120  # Wait up to 1 hour
        }
    )
    
    logger.info(f"Snapshot created successfully: {snapshot_id}")
    return {
        'snapshot_id': snapshot_id,
        'status': response['DBSnapshot']['Status'],
        'size': response['DBSnapshot']['AllocatedStorage']
    }

def cleanup_old_snapshots(db_instance_id, retention_days):
    """Clean up snapshots older than retention period"""
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    logger.info(f"Cleaning up snapshots older than {cutoff_date}")
    
    # Get all manual snapshots for this instance
    response = rds_client.describe_db_snapshots(
        DBInstanceIdentifier=db_instance_id,
        SnapshotType='manual'
    )
    
    deleted_snapshots = []
    
    for snapshot in response['DBSnapshots']:
        snapshot_time = snapshot['SnapshotCreateTime'].replace(tzinfo=None)
        
        if snapshot_time < cutoff_date:
            snapshot_id = snapshot['DBSnapshotIdentifier']
            
            # Check if this is an automated backup system snapshot
            tags_response = rds_client.list_tags_for_resource(
                ResourceName=snapshot['DBSnapshotArn']
            )
            
            is_automated = any(
                tag['Key'] == 'CreatedBy' and tag['Value'] == 'automated-backup-system'
                for tag in tags_response['TagList']
            )
            
            if is_automated:
                logger.info(f"Deleting old snapshot: {snapshot_id}")
                rds_client.delete_db_snapshot(DBSnapshotIdentifier=snapshot_id)
                deleted_snapshots.append(snapshot_id)
    
    logger.info(f"Deleted {len(deleted_snapshots)} old snapshots")
    return {
        'deleted_count': len(deleted_snapshots),
        'deleted_snapshots': deleted_snapshots
    }

def export_snapshot_to_s3(snapshot_id, s3_bucket, kms_key_id):
    """Export a snapshot to S3 for long-term storage"""
    timestamp = datetime.utcnow().strftime('%Y-%m-%d-%H-%M-%S')
    export_task_id = f"{snapshot_id}-export-{timestamp}"
    
    logger.info(f"Starting snapshot export: {export_task_id}")
    
    # Get snapshot ARN
    response = rds_client.describe_db_snapshots(
        DBSnapshotIdentifier=snapshot_id
    )
    snapshot_arn = response['DBSnapshots'][0]['DBSnapshotArn']
    
    # Start export task
    export_response = rds_client.start_export_task(
        ExportTaskIdentifier=export_task_id,
        SourceArn=snapshot_arn,
        S3BucketName=s3_bucket,
        S3Prefix=f"exports/{datetime.utcnow().strftime('%Y/%m/%d')}/",
        KmsKeyId=kms_key_id,
        ExportOnly=[
            # Export specific tables if needed, or leave empty for full export
        ]
    )
    
    logger.info(f"Export task started: {export_task_id}")
    return {
        'export_task_id': export_task_id,
        'status': export_response['Status'],
        's3_location': f"s3://{s3_bucket}/exports/{datetime.utcnow().strftime('%Y/%m/%d')}/"
    }

def send_notification(sns_topic_arn, subject, message, status):
    """Send notification via SNS"""
    try:
        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=f"[{status}] DhakaCart Backup Notification",
            Message=json.dumps({
                'subject': subject,
                'message': message,
                'timestamp': datetime.utcnow().isoformat(),
                'status': status
            }, indent=2)
        )
        logger.info(f"Notification sent: {subject}")
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")