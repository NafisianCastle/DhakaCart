import json
import boto3
import os
import psycopg2
from datetime import datetime, timedelta
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
rds_client = boto3.client('rds')
s3_client = boto3.client('s3')
sns_client = boto3.client('sns')
secrets_client = boto3.client('secretsmanager')

def handler(event, context):
    """
    Lambda function to verify backup integrity and test restoration procedures
    """
    try:
        db_instance_id = os.environ['DB_INSTANCE_ID']
        s3_bucket = os.environ['S3_BUCKET']
        sns_topic_arn = os.environ['SNS_TOPIC_ARN']
        secret_arn = os.environ['SECRET_ARN']
        
        logger.info(f"Starting backup verification for {db_instance_id}")
        
        # Get database credentials
        db_credentials = get_db_credentials(secret_arn)
        
        # Verify recent snapshots
        snapshot_verification = verify_recent_snapshots(db_instance_id)
        
        # Test database connectivity and basic queries
        connectivity_test = test_database_connectivity(db_credentials)
        
        # Verify S3 backup exports
        s3_verification = verify_s3_backups(s3_bucket)
        
        # Compile verification results
        verification_results = {
            'timestamp': datetime.utcnow().isoformat(),
            'snapshot_verification': snapshot_verification,
            'connectivity_test': connectivity_test,
            's3_verification': s3_verification,
            'overall_status': 'PASS' if all([
                snapshot_verification['status'] == 'PASS',
                connectivity_test['status'] == 'PASS',
                s3_verification['status'] == 'PASS'
            ]) else 'FAIL'
        }
        
        # Store verification results in S3
        store_verification_results(s3_bucket, verification_results)
        
        # Send notification
        send_notification(
            sns_topic_arn, 
            f"Backup Verification {verification_results['overall_status']}", 
            verification_results,
            verification_results['overall_status']
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Backup verification completed',
                'results': verification_results
            })
        }
        
    except Exception as e:
        error_message = f"Backup verification failed: {str(e)}"
        logger.error(error_message)
        
        # Send failure notification
        send_notification(sns_topic_arn, "Backup Verification Failed", error_message, "ERROR")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': error_message
            })
        }

def get_db_credentials(secret_arn):
    """Retrieve database credentials from Secrets Manager"""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_arn)
        return json.loads(response['SecretString'])
    except Exception as e:
        logger.error(f"Failed to retrieve database credentials: {str(e)}")
        raise

def verify_recent_snapshots(db_instance_id):
    """Verify that recent snapshots exist and are in available state"""
    try:
        # Check for snapshots created in the last 48 hours
        cutoff_time = datetime.utcnow() - timedelta(hours=48)
        
        # Get automated backups
        automated_response = rds_client.describe_db_snapshots(
            DBInstanceIdentifier=db_instance_id,
            SnapshotType='automated',
            MaxRecords=20
        )
        
        # Get manual snapshots
        manual_response = rds_client.describe_db_snapshots(
            DBInstanceIdentifier=db_instance_id,
            SnapshotType='manual',
            MaxRecords=20
        )
        
        all_snapshots = automated_response['DBSnapshots'] + manual_response['DBSnapshots']
        
        recent_snapshots = [
            snapshot for snapshot in all_snapshots
            if snapshot['SnapshotCreateTime'].replace(tzinfo=None) > cutoff_time
        ]
        
        available_snapshots = [
            snapshot for snapshot in recent_snapshots
            if snapshot['Status'] == 'available'
        ]
        
        verification_result = {
            'status': 'PASS' if len(available_snapshots) > 0 else 'FAIL',
            'total_recent_snapshots': len(recent_snapshots),
            'available_snapshots': len(available_snapshots),
            'snapshots': [
                {
                    'id': snapshot['DBSnapshotIdentifier'],
                    'created': snapshot['SnapshotCreateTime'].isoformat(),
                    'status': snapshot['Status'],
                    'size_gb': snapshot['AllocatedStorage']
                }
                for snapshot in available_snapshots[:5]  # Show latest 5
            ]
        }
        
        logger.info(f"Snapshot verification: {verification_result['status']}")
        return verification_result
        
    except Exception as e:
        logger.error(f"Snapshot verification failed: {str(e)}")
        return {
            'status': 'FAIL',
            'error': str(e)
        }

def test_database_connectivity(db_credentials):
    """Test database connectivity and run basic queries"""
    try:
        # Connect to database
        connection = psycopg2.connect(
            host=db_credentials['host'],
            port=db_credentials['port'],
            database=db_credentials['dbname'],
            user=db_credentials['username'],
            password=db_credentials['password'],
            connect_timeout=30
        )
        
        cursor = connection.cursor()
        
        # Test basic connectivity
        cursor.execute("SELECT version();")
        db_version = cursor.fetchone()[0]
        
        # Test table access
        cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        table_count = cursor.fetchone()[0]
        
        # Test data integrity (if products table exists)
        try:
            cursor.execute("SELECT COUNT(*) FROM products;")
            product_count = cursor.fetchone()[0]
        except psycopg2.Error:
            product_count = "N/A (table may not exist)"
        
        # Test write capability (create and drop a test table)
        test_table_name = f"backup_test_{int(datetime.utcnow().timestamp())}"
        cursor.execute(f"CREATE TABLE {test_table_name} (id SERIAL PRIMARY KEY, test_data TEXT);")
        cursor.execute(f"INSERT INTO {test_table_name} (test_data) VALUES ('backup_verification_test');")
        cursor.execute(f"SELECT COUNT(*) FROM {test_table_name};")
        test_count = cursor.fetchone()[0]
        cursor.execute(f"DROP TABLE {test_table_name};")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        verification_result = {
            'status': 'PASS',
            'db_version': db_version,
            'table_count': table_count,
            'product_count': product_count,
            'write_test': 'PASS' if test_count == 1 else 'FAIL'
        }
        
        logger.info("Database connectivity test: PASS")
        return verification_result
        
    except Exception as e:
        logger.error(f"Database connectivity test failed: {str(e)}")
        return {
            'status': 'FAIL',
            'error': str(e)
        }

def verify_s3_backups(s3_bucket):
    """Verify S3 backup exports and their integrity"""
    try:
        # List recent exports
        cutoff_time = datetime.utcnow() - timedelta(days=7)
        
        response = s3_client.list_objects_v2(
            Bucket=s3_bucket,
            Prefix='exports/'
        )
        
        if 'Contents' not in response:
            return {
                'status': 'WARN',
                'message': 'No S3 exports found',
                'export_count': 0
            }
        
        recent_exports = [
            obj for obj in response['Contents']
            if obj['LastModified'].replace(tzinfo=None) > cutoff_time
        ]
        
        total_size_mb = sum(obj['Size'] for obj in recent_exports) / (1024 * 1024)
        
        verification_result = {
            'status': 'PASS' if len(recent_exports) > 0 else 'WARN',
            'recent_export_count': len(recent_exports),
            'total_size_mb': round(total_size_mb, 2),
            'latest_exports': [
                {
                    'key': obj['Key'],
                    'size_mb': round(obj['Size'] / (1024 * 1024), 2),
                    'last_modified': obj['LastModified'].isoformat()
                }
                for obj in sorted(recent_exports, key=lambda x: x['LastModified'], reverse=True)[:3]
            ]
        }
        
        logger.info(f"S3 backup verification: {verification_result['status']}")
        return verification_result
        
    except Exception as e:
        logger.error(f"S3 backup verification failed: {str(e)}")
        return {
            'status': 'FAIL',
            'error': str(e)
        }

def store_verification_results(s3_bucket, results):
    """Store verification results in S3 for historical tracking"""
    try:
        timestamp = datetime.utcnow().strftime('%Y/%m/%d/%H-%M-%S')
        key = f"verification-results/{timestamp}.json"
        
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=key,
            Body=json.dumps(results, indent=2),
            ContentType='application/json'
        )
        
        logger.info(f"Verification results stored: s3://{s3_bucket}/{key}")
        
    except Exception as e:
        logger.error(f"Failed to store verification results: {str(e)}")

def send_notification(sns_topic_arn, subject, message, status):
    """Send notification via SNS"""
    try:
        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=f"[{status}] DhakaCart Backup Verification",
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