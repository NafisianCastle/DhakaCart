# Infrastructure Validation Script for DhakaCart Cloud Migration (PowerShell)
# This script validates the deployment and functionality of all infrastructure components

param(
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }),
    [string]$Environment = $(if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }),
    [string]$ProjectName = $(if ($env:PROJECT_NAME) { $env:PROJECT_NAME } else { "dhakacart" })
)

# Configuration
$TerraformDir = "terraform"
$ErrorActionPreference = "Stop"

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    try {
        aws --version | Out-Null
    }
    catch {
        Write-Error "AWS CLI is not installed"
        exit 1
    }
    
    # Check if Terraform is installed
    try {
        terraform version | Out-Null
    }
    catch {
        Write-Error "Terraform is not installed"
        exit 1
    }
    
    # Check if kubectl is installed
    try {
        kubectl version --client | Out-Null
    }
    catch {
        Write-Error "kubectl is not installed"
        exit 1
    }
    
    # Check AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
    }
    catch {
        Write-Error "AWS credentials not configured or invalid"
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
}

# Initialize and plan Terraform
function Initialize-Terraform {
    Write-Log "Initializing Terraform..."
    Push-Location $TerraformDir
    
    try {
        # Initialize Terraform
        terraform init
        
        # Create terraform.tfvars if it doesn't exist
        if (-not (Test-Path "terraform.tfvars")) {
            Write-Warning "terraform.tfvars not found, creating from example..."
            Copy-Item "terraform.tfvars.example" "terraform.tfvars"
            Write-Warning "Please review and update terraform.tfvars with your specific values"
        }
        
        # Validate Terraform configuration
        terraform validate
        Write-Success "Terraform configuration is valid"
        
        # Plan Terraform deployment
        Write-Log "Creating Terraform plan..."
        terraform plan -out=tfplan
        Write-Success "Terraform plan created successfully"
    }
    finally {
        Pop-Location
    }
}

# Deploy infrastructure
function Deploy-Infrastructure {
    Write-Log "Deploying infrastructure with Terraform..."
    Push-Location $TerraformDir
    
    try {
        # Apply Terraform configuration
        terraform apply tfplan
        Write-Success "Infrastructure deployed successfully"
        
        # Save outputs to file for later use
        terraform output -json | Out-File -FilePath "../terraform-outputs.json" -Encoding UTF8
        Write-Success "Terraform outputs saved"
    }
    finally {
        Pop-Location
    }
}

# Validate VPC and networking
function Test-VpcNetworking {
    Write-Log "Validating VPC and networking configuration..."
    
    # Get VPC ID from Terraform outputs
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $vpcId = $outputs.vpc_id.value
    
    if (-not $vpcId -or $vpcId -eq "null") {
        Write-Error "VPC ID not found in Terraform outputs"
        return $false
    }
    
    # Check VPC exists
    try {
        aws ec2 describe-vpcs --vpc-ids $vpcId --region $Region | Out-Null
        Write-Success "VPC $vpcId exists and is accessible"
    }
    catch {
        Write-Error "VPC $vpcId not found or not accessible"
        return $false
    }
    
    # Check subnets
    $publicSubnets = $outputs.public_subnet_ids.value
    $privateAppSubnets = $outputs.private_app_subnet_ids.value
    $privateDbSubnets = $outputs.private_db_subnet_ids.value
    
    foreach ($subnet in $publicSubnets) {
        try {
            aws ec2 describe-subnets --subnet-ids $subnet --region $Region | Out-Null
            Write-Success "Public subnet $subnet exists"
        }
        catch {
            Write-Error "Public subnet $subnet not found"
            return $false
        }
    }
    
    foreach ($subnet in $privateAppSubnets) {
        try {
            aws ec2 describe-subnets --subnet-ids $subnet --region $Region | Out-Null
            Write-Success "Private app subnet $subnet exists"
        }
        catch {
            Write-Error "Private app subnet $subnet not found"
            return $false
        }
    }
    
    foreach ($subnet in $privateDbSubnets) {
        try {
            aws ec2 describe-subnets --subnet-ids $subnet --region $Region | Out-Null
            Write-Success "Private DB subnet $subnet exists"
        }
        catch {
            Write-Error "Private DB subnet $subnet not found"
            return $false
        }
    }
    
    # Check NAT Gateways
    if ($outputs.nat_gateway_ids.value) {
        foreach ($nat in $outputs.nat_gateway_ids.value) {
            try {
                aws ec2 describe-nat-gateways --nat-gateway-ids $nat --region $Region | Out-Null
                Write-Success "NAT Gateway $nat exists"
            }
            catch {
                Write-Error "NAT Gateway $nat not found"
                return $false
            }
        }
    }
    
    Write-Success "VPC and networking validation completed"
    return $true
}

# Validate EKS cluster
function Test-EksCluster {
    Write-Log "Validating EKS cluster..."
    
    # Get cluster name from Terraform outputs
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $clusterName = $outputs.eks_cluster_id.value
    
    if (-not $clusterName -or $clusterName -eq "null") {
        Write-Error "EKS cluster name not found in Terraform outputs"
        return $false
    }
    
    # Check if cluster exists and is active
    try {
        $clusterStatus = aws eks describe-cluster --name $clusterName --region $Region --query 'cluster.status' --output text
        
        if ($clusterStatus -eq "ACTIVE") {
            Write-Success "EKS cluster $clusterName is active"
        }
        else {
            Write-Error "EKS cluster $clusterName status: $clusterStatus"
            return $false
        }
    }
    catch {
        Write-Error "EKS cluster $clusterName not found"
        return $false
    }
    
    # Update kubeconfig
    Write-Log "Updating kubeconfig for EKS cluster..."
    aws eks update-kubeconfig --region $Region --name $clusterName
    Write-Success "Kubeconfig updated"
    
    # Check node group
    try {
        $nodeGroups = aws eks list-nodegroups --cluster-name $clusterName --region $Region --query 'nodegroups' --output text
        
        if ($nodeGroups) {
            foreach ($nodegroup in $nodeGroups.Split()) {
                $nodeStatus = aws eks describe-nodegroup --cluster-name $clusterName --nodegroup-name $nodegroup --region $Region --query 'nodegroup.status' --output text
                if ($nodeStatus -eq "ACTIVE") {
                    Write-Success "Node group $nodegroup is active"
                }
                else {
                    Write-Error "Node group $nodegroup status: $nodeStatus"
                    return $false
                }
            }
        }
        else {
            Write-Error "No node groups found for cluster $clusterName"
            return $false
        }
    }
    catch {
        Write-Error "Failed to check node groups"
        return $false
    }
    
    # Check if nodes are ready
    Write-Log "Checking if Kubernetes nodes are ready..."
    try {
        $nodes = kubectl get nodes --no-headers
        $readyNodes = ($nodes | Select-String "Ready" | Measure-Object).Count
        $totalNodes = ($nodes | Measure-Object).Count
        
        if ($readyNodes -gt 0 -and $readyNodes -eq $totalNodes) {
            Write-Success "$readyNodes/$totalNodes nodes are ready"
        }
        else {
            Write-Error "Only $readyNodes/$totalNodes nodes are ready"
            kubectl get nodes
            return $false
        }
    }
    catch {
        Write-Error "Failed to check node status"
        return $false
    }
    
    Write-Success "EKS cluster validation completed"
    return $true
}

# Validate RDS PostgreSQL
function Test-Rds {
    Write-Log "Validating RDS PostgreSQL..."
    
    # Get RDS instance ID from Terraform outputs
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $rdsInstanceId = $outputs.rds_instance_id.value
    $rdsEndpoint = $outputs.rds_instance_endpoint.value
    
    if (-not $rdsInstanceId -or $rdsInstanceId -eq "null") {
        Write-Error "RDS instance ID not found in Terraform outputs"
        return $false
    }
    
    # Check RDS instance status
    try {
        $rdsStatus = aws rds describe-db-instances --db-instance-identifier $rdsInstanceId --region $Region --query 'DBInstances[0].DBInstanceStatus' --output text
        
        if ($rdsStatus -eq "available") {
            Write-Success "RDS instance $rdsInstanceId is available"
            Write-Success "RDS endpoint: $rdsEndpoint"
        }
        else {
            Write-Error "RDS instance $rdsInstanceId status: $rdsStatus"
            return $false
        }
    }
    catch {
        Write-Error "RDS instance $rdsInstanceId not found"
        return $false
    }
    
    # Check if Multi-AZ is enabled
    try {
        $multiAz = aws rds describe-db-instances --db-instance-identifier $rdsInstanceId --region $Region --query 'DBInstances[0].MultiAZ' --output text
        
        if ($multiAz -eq "True") {
            Write-Success "Multi-AZ is enabled for RDS instance"
        }
        else {
            Write-Warning "Multi-AZ is not enabled for RDS instance"
        }
    }
    catch {
        Write-Warning "Could not check Multi-AZ status"
    }
    
    # Check backup configuration
    try {
        $backupRetention = aws rds describe-db-instances --db-instance-identifier $rdsInstanceId --region $Region --query 'DBInstances[0].BackupRetentionPeriod' --output text
        
        if ([int]$backupRetention -gt 0) {
            Write-Success "Automated backups enabled with $backupRetention days retention"
        }
        else {
            Write-Warning "Automated backups are not enabled"
        }
    }
    catch {
        Write-Warning "Could not check backup configuration"
    }
    
    Write-Success "RDS validation completed"
    return $true
}

# Validate ElastiCache Redis
function Test-Redis {
    Write-Log "Validating ElastiCache Redis..."
    
    # Get Redis replication group ID from Terraform outputs
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $redisGroupId = $outputs.redis_replication_group_id.value
    $redisEndpoint = $outputs.redis_primary_endpoint_address.value
    
    if (-not $redisGroupId -or $redisGroupId -eq "null") {
        Write-Error "Redis replication group ID not found in Terraform outputs"
        return $false
    }
    
    # Check Redis replication group status
    try {
        $redisStatus = aws elasticache describe-replication-groups --replication-group-id $redisGroupId --region $Region --query 'ReplicationGroups[0].Status' --output text
        
        if ($redisStatus -eq "available") {
            Write-Success "Redis replication group $redisGroupId is available"
            Write-Success "Redis endpoint: $redisEndpoint"
        }
        else {
            Write-Error "Redis replication group $redisGroupId status: $redisStatus"
            return $false
        }
    }
    catch {
        Write-Error "Redis replication group $redisGroupId not found"
        return $false
    }
    
    # Check if automatic failover is enabled
    try {
        $autoFailover = aws elasticache describe-replication-groups --replication-group-id $redisGroupId --region $Region --query 'ReplicationGroups[0].AutomaticFailover' --output text
        
        if ($autoFailover -eq "enabled") {
            Write-Success "Automatic failover is enabled for Redis"
        }
        else {
            Write-Warning "Automatic failover is not enabled for Redis"
        }
    }
    catch {
        Write-Warning "Could not check automatic failover status"
    }
    
    Write-Success "Redis validation completed"
    return $true
}

# Validate ECR repositories
function Test-Ecr {
    Write-Log "Validating ECR repositories..."
    
    # Get ECR repository URLs from Terraform outputs
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $frontendRepo = $outputs.ecr_frontend_repository_url.value
    $backendRepo = $outputs.ecr_backend_repository_url.value
    
    if (-not $frontendRepo -or $frontendRepo -eq "null") {
        Write-Error "Frontend ECR repository URL not found in Terraform outputs"
        return $false
    }
    
    if (-not $backendRepo -or $backendRepo -eq "null") {
        Write-Error "Backend ECR repository URL not found in Terraform outputs"
        return $false
    }
    
    # Extract repository names
    $frontendRepoName = $frontendRepo.Split('/')[1]
    $backendRepoName = $backendRepo.Split('/')[1]
    
    # Check if repositories exist
    try {
        aws ecr describe-repositories --repository-names $frontendRepoName --region $Region | Out-Null
        Write-Success "Frontend ECR repository exists: $frontendRepo"
    }
    catch {
        Write-Error "Frontend ECR repository not found: $frontendRepoName"
        return $false
    }
    
    try {
        aws ecr describe-repositories --repository-names $backendRepoName --region $Region | Out-Null
        Write-Success "Backend ECR repository exists: $backendRepo"
    }
    catch {
        Write-Error "Backend ECR repository not found: $backendRepoName"
        return $false
    }
    
    Write-Success "ECR validation completed"
    return $true
}

# Test database connectivity from within the cluster
function Test-DatabaseConnectivity {
    Write-Log "Testing database connectivity from within the cluster..."
    
    # Get database connection details
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $dbEndpoint = $outputs.rds_instance_endpoint.value
    $dbName = $outputs.rds_db_name.value
    
    # Create a temporary pod to test database connectivity
    $podManifest = @"
apiVersion: v1
kind: Pod
metadata:
  name: db-test-pod
  namespace: default
spec:
  containers:
  - name: postgres-client
    image: postgres:15-alpine
    command: ['sleep', '300']
    env:
    - name: PGHOST
      value: "$dbEndpoint"
    - name: PGDATABASE
      value: "$dbName"
  restartPolicy: Never
"@
    
    try {
        $podManifest | kubectl apply -f -
        
        # Wait for pod to be ready
        kubectl wait --for=condition=Ready pod/db-test-pod --timeout=60s
        
        # Test connection
        $result = kubectl exec db-test-pod -- pg_isready -h $dbEndpoint -d $dbName
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database is reachable from within the cluster"
        }
        else {
            Write-Error "Database is not reachable from within the cluster"
            return $false
        }
    }
    catch {
        Write-Error "Failed to test database connectivity"
        return $false
    }
    finally {
        # Clean up test pod
        kubectl delete pod db-test-pod --ignore-not-found=true | Out-Null
    }
    
    Write-Success "Database connectivity test completed"
    return $true
}

# Test Redis connectivity from within the cluster
function Test-RedisConnectivity {
    Write-Log "Testing Redis connectivity from within the cluster..."
    
    # Get Redis connection details
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    $redisEndpoint = $outputs.redis_primary_endpoint_address.value
    $redisPort = $outputs.redis_port.value
    
    # Create a temporary pod to test Redis connectivity
    $podManifest = @"
apiVersion: v1
kind: Pod
metadata:
  name: redis-test-pod
  namespace: default
spec:
  containers:
  - name: redis-client
    image: redis:7-alpine
    command: ['sleep', '300']
  restartPolicy: Never
"@
    
    try {
        $podManifest | kubectl apply -f -
        
        # Wait for pod to be ready
        kubectl wait --for=condition=Ready pod/redis-test-pod --timeout=60s
        
        # Test connection
        $result = kubectl exec redis-test-pod -- redis-cli -h $redisEndpoint -p $redisPort ping
        if ($result -match "PONG") {
            Write-Success "Redis is reachable from within the cluster"
        }
        else {
            Write-Error "Redis is not reachable from within the cluster"
            return $false
        }
    }
    catch {
        Write-Error "Failed to test Redis connectivity"
        return $false
    }
    finally {
        # Clean up test pod
        kubectl delete pod redis-test-pod --ignore-not-found=true | Out-Null
    }
    
    Write-Success "Redis connectivity test completed"
    return $true
}

# Generate validation report
function New-ValidationReport {
    Write-Log "Generating validation report..."
    
    $reportFile = "infrastructure-validation-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    $outputs = Get-Content "terraform-outputs.json" | ConvertFrom-Json
    
    $reportContent = @"
DhakaCart Infrastructure Validation Report
==========================================
Generated: $(Get-Date)
Region: $Region
Environment: $Environment

Infrastructure Components:
- VPC ID: $($outputs.vpc_id.value)
- EKS Cluster: $($outputs.eks_cluster_id.value)
- RDS Instance: $($outputs.rds_instance_id.value)
- Redis Group: $($outputs.redis_replication_group_id.value)
- Frontend ECR: $($outputs.ecr_frontend_repository_url.value)
- Backend ECR: $($outputs.ecr_backend_repository_url.value)

Validation Status: PASSED
All infrastructure components have been successfully deployed and validated.

Next Steps:
1. Deploy applications (Task 11.2)
2. Configure load balancing and auto-scaling (Task 11.3)
3. Set up monitoring and alerting (Task 11.4)
4. Test backup and disaster recovery (Task 11.5)
5. Validate security and compliance (Task 11.6)
6. Execute end-to-end user workflow tests (Task 11.7)
7. Perform performance and scalability validation (Task 11.8)
"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Success "Validation report generated: $reportFile"
}

# Main execution
function Main {
    Write-Log "Starting DhakaCart infrastructure validation..."
    
    Test-Prerequisites
    Initialize-Terraform
    
    # Ask for confirmation before deploying
    Write-Host ""
    Write-Warning "This will deploy infrastructure to AWS which may incur costs."
    $confirmation = Read-Host "Do you want to proceed with deployment? (y/N)"
    
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Log "Deployment cancelled by user"
        exit 0
    }
    
    $success = $true
    
    try {
        Deploy-Infrastructure
        $success = $success -and (Test-VpcNetworking)
        $success = $success -and (Test-EksCluster)
        $success = $success -and (Test-Rds)
        $success = $success -and (Test-Redis)
        $success = $success -and (Test-Ecr)
        $success = $success -and (Test-DatabaseConnectivity)
        $success = $success -and (Test-RedisConnectivity)
        
        if ($success) {
            New-ValidationReport
            Write-Success "Infrastructure validation completed successfully!"
            Write-Log "All infrastructure components are deployed and operational."
        }
        else {
            Write-Error "Infrastructure validation failed. Please check the errors above."
            exit 1
        }
    }
    catch {
        Write-Error "An error occurred during validation: $_"
        exit 1
    }
}

# Run main function
Main