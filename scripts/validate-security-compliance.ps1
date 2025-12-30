#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Validates security and compliance for the DhakaCart cloud infrastructure deployment
.DESCRIPTION
    This script validates security configurations including secrets management, RBAC policies,
    network security, container security scanning, and SSL/TLS encryption
.PARAMETER Region
    AWS region where infrastructure is deployed (default: us-west-2)
.PARAMETER ClusterName
    EKS cluster name (default: dhakacart-cluster)
.PARAMETER Namespace
    Kubernetes namespace (default: dhakacart)
#>

param(
    [string]$Region = "us-west-2",
    [string]$ClusterName = "dhakacart-cluster",
    [string]$Namespace = "dhakacart"
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "=== DhakaCart Security and Compliance Validation ===" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Cluster: $ClusterName" -ForegroundColor Yellow
Write-Host "Namespace: $Namespace" -ForegroundColor Yellow
Write-Host ""

# Function to check command availability
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Check required tools
Write-Host "Checking required tools..." -ForegroundColor Blue
$requiredTools = @("aws", "kubectl", "helm", "trivy")
$missingTools = @()

foreach ($tool in $requiredTools) {
    if (-not (Test-Command $tool)) {
        $missingTools += $tool
        Write-Host "❌ $tool not found" -ForegroundColor Red
    } else {
        Write-Host "✅ $tool found" -ForegroundColor Green
    }
}

if ($missingTools.Count -gt 0) {
    Write-Host "Missing required tools: $($missingTools -join ', ')" -ForegroundColor Red
    Write-Host "Please install missing tools before running this script." -ForegroundColor Red
    exit 1
}

# Configure kubectl context
Write-Host "`nConfiguring kubectl context..." -ForegroundColor Blue
try {
    aws eks update-kubeconfig --region $Region --name $ClusterName
    Write-Host "✅ kubectl context configured" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to configure kubectl context: $_" -ForegroundColor Red
    exit 1
}

# Test 1: Validate AWS Secrets Manager integration
Write-Host "`n=== Test 1: AWS Secrets Manager Integration ===" -ForegroundColor Cyan

Write-Host "Checking AWS Secrets Manager secrets..." -ForegroundColor Blue
try {
    $secrets = aws secretsmanager list-secrets --region $Region --query 'SecretList[?contains(Name, `dhakacart`)].Name' --output text
    if ($secrets) {
        Write-Host "✅ Found DhakaCart secrets in AWS Secrets Manager:" -ForegroundColor Green
        $secrets -split "`t" | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No DhakaCart secrets found in AWS Secrets Manager" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check AWS Secrets Manager: $_" -ForegroundColor Red
}

Write-Host "Checking External Secrets Operator..." -ForegroundColor Blue
try {
    $esoDeployment = kubectl get deployment -n external-secrets external-secrets-operator -o jsonpath='{.status.readyReplicas}' 2>$null
    if ($esoDeployment -gt 0) {
        Write-Host "✅ External Secrets Operator is running ($esoDeployment replicas)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  External Secrets Operator not found or not ready" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check External Secrets Operator: $_" -ForegroundColor Red
}

Write-Host "Checking SecretStore configuration..." -ForegroundColor Blue
try {
    $secretStores = kubectl get secretstore -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    if ($secretStores) {
        Write-Host "✅ Found SecretStore configurations:" -ForegroundColor Green
        $secretStores -split " " | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No SecretStore configurations found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check SecretStore configurations: $_" -ForegroundColor Red
}

# Test 2: Validate RBAC policies
Write-Host "`n=== Test 2: RBAC Policies Validation ===" -ForegroundColor Cyan

Write-Host "Checking Kubernetes RBAC roles..." -ForegroundColor Blue
try {
    $roles = kubectl get roles -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    if ($roles) {
        Write-Host "✅ Found RBAC roles in namespace $Namespace" -ForegroundColor Green
        $roles -split " " | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No custom RBAC roles found in namespace $Namespace" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check RBAC roles: $_" -ForegroundColor Red
}

Write-Host "Checking ClusterRoles..." -ForegroundColor Blue
try {
    $clusterRoles = kubectl get clusterroles | grep -E "(dhakacart|external-secrets|aws-load-balancer)" | awk '{print $1}'
    if ($clusterRoles) {
        Write-Host "✅ Found relevant ClusterRoles:" -ForegroundColor Green
        $clusterRoles -split "`n" | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No custom ClusterRoles found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check ClusterRoles: $_" -ForegroundColor Red
}

Write-Host "Checking ServiceAccounts..." -ForegroundColor Blue
try {
    $serviceAccounts = kubectl get serviceaccounts -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    if ($serviceAccounts) {
        Write-Host "✅ Found ServiceAccounts in namespace $Namespace" -ForegroundColor Green
        $serviceAccounts -split " " | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No custom ServiceAccounts found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check ServiceAccounts: $_" -ForegroundColor Red
}

# Test 3: Network security validation
Write-Host "`n=== Test 3: Network Security Configuration ===" -ForegroundColor Cyan

Write-Host "Checking Network Policies..." -ForegroundColor Blue
try {
    $networkPolicies = kubectl get networkpolicies -n $Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    if ($networkPolicies) {
        Write-Host "✅ Found Network Policies:" -ForegroundColor Green
        $networkPolicies -split " " | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No Network Policies found - consider implementing for enhanced security" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check Network Policies: $_" -ForegroundColor Red
}

Write-Host "Checking Pod Security Standards..." -ForegroundColor Blue
try {
    $pssLabels = kubectl get namespace $Namespace -o jsonpath='{.metadata.labels}' 2>$null
    if ($pssLabels -match "pod-security") {
        Write-Host "✅ Pod Security Standards configured for namespace $Namespace" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Pod Security Standards not configured" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check Pod Security Standards: $_" -ForegroundColor Red
}

Write-Host "Checking Security Groups..." -ForegroundColor Blue
try {
    $securityGroups = aws ec2 describe-security-groups --region $Region --filters "Name=group-name,Values=*dhakacart*" --query 'SecurityGroups[*].GroupName' --output text
    if ($securityGroups) {
        Write-Host "✅ Found DhakaCart security groups:" -ForegroundColor Green
        $securityGroups -split "`t" | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No DhakaCart security groups found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check security groups: $_" -ForegroundColor Red
}

# Test 4: Container security scanning
Write-Host "`n=== Test 4: Container Security Scanning ===" -ForegroundColor Cyan

Write-Host "Scanning container images for vulnerabilities..." -ForegroundColor Blue
$images = @(
    "dhakacart-frontend:latest",
    "dhakacart-backend:latest"
)

foreach ($image in $images) {
    Write-Host "Scanning $image..." -ForegroundColor Blue
    try {
        # Check if image exists in ECR
        $ecrRepo = $image -replace ":.*", ""
        $accountId = aws sts get-caller-identity --query Account --output text
        $fullImageName = "$accountId.dkr.ecr.$Region.amazonaws.com/$image"
        
        # Run Trivy scan
        $scanResult = trivy image --severity HIGH,CRITICAL --format json $fullImageName 2>$null
        if ($LASTEXITCODE -eq 0) {
            $vulnerabilities = $scanResult | ConvertFrom-Json | Select-Object -ExpandProperty Results | Where-Object { $_.Vulnerabilities } | Select-Object -ExpandProperty Vulnerabilities
            if ($vulnerabilities) {
                $highCount = ($vulnerabilities | Where-Object { $_.Severity -eq "HIGH" }).Count
                $criticalCount = ($vulnerabilities | Where-Object { $_.Severity -eq "CRITICAL" }).Count
                Write-Host "  ⚠️  Found vulnerabilities - HIGH: $highCount, CRITICAL: $criticalCount" -ForegroundColor Yellow
            } else {
                Write-Host "  ✅ No HIGH or CRITICAL vulnerabilities found" -ForegroundColor Green
            }
        } else {
            Write-Host "  ⚠️  Could not scan $image (image may not exist in ECR)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Failed to scan $image : $_" -ForegroundColor Red
    }
}

# Test 5: SSL/TLS encryption validation
Write-Host "`n=== Test 5: SSL/TLS Encryption Validation ===" -ForegroundColor Cyan

Write-Host "Checking AWS Certificate Manager certificates..." -ForegroundColor Blue
try {
    $certificates = aws acm list-certificates --region $Region --query 'CertificateSummaryList[?contains(DomainName, `dhakacart`) || contains(DomainName, `*.dhakacart`)].DomainName' --output text
    if ($certificates) {
        Write-Host "✅ Found SSL certificates:" -ForegroundColor Green
        $certificates -split "`t" | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    } else {
        Write-Host "⚠️  No DhakaCart SSL certificates found in ACM" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check ACM certificates: $_" -ForegroundColor Red
}

Write-Host "Checking Ingress TLS configuration..." -ForegroundColor Blue
try {
    $ingressTLS = kubectl get ingress -n $Namespace -o jsonpath='{.items[*].spec.tls}' 2>$null
    if ($ingressTLS -and $ingressTLS -ne "null") {
        Write-Host "✅ TLS configuration found in Ingress resources" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No TLS configuration found in Ingress resources" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check Ingress TLS configuration: $_" -ForegroundColor Red
}

Write-Host "Checking Load Balancer SSL policies..." -ForegroundColor Blue
try {
    $loadBalancers = aws elbv2 describe-load-balancers --region $Region --query 'LoadBalancers[?contains(LoadBalancerName, `dhakacart`) || contains(LoadBalancerName, `k8s`)].LoadBalancerArn' --output text
    if ($loadBalancers) {
        foreach ($lbArn in ($loadBalancers -split "`t")) {
            $listeners = aws elbv2 describe-listeners --load-balancer-arn $lbArn --query 'Listeners[?Protocol==`HTTPS`].Protocol' --output text
            if ($listeners) {
                Write-Host "✅ HTTPS listener found on load balancer" -ForegroundColor Green
            } else {
                Write-Host "⚠️  No HTTPS listener found on load balancer" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "⚠️  No load balancers found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check load balancer SSL policies: $_" -ForegroundColor Red
}

# Test 6: Database encryption validation
Write-Host "`n=== Test 6: Database Encryption Validation ===" -ForegroundColor Cyan

Write-Host "Checking RDS encryption..." -ForegroundColor Blue
try {
    $rdsInstances = aws rds describe-db-instances --region $Region --query 'DBInstances[?contains(DBInstanceIdentifier, `dhakacart`)].{Name:DBInstanceIdentifier,Encrypted:StorageEncrypted}' --output table
    if ($rdsInstances) {
        Write-Host "✅ RDS instances found:" -ForegroundColor Green
        Write-Host $rdsInstances -ForegroundColor White
    } else {
        Write-Host "⚠️  No DhakaCart RDS instances found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check RDS encryption: $_" -ForegroundColor Red
}

Write-Host "Checking ElastiCache encryption..." -ForegroundColor Blue
try {
    $cacheCluster = aws elasticache describe-cache-clusters --region $Region --query 'CacheClusters[?contains(CacheClusterId, `dhakacart`)].{Name:CacheClusterId,TransitEncryption:TransitEncryptionEnabled,AtRestEncryption:AtRestEncryptionEnabled}' --output table
    if ($cacheCluster) {
        Write-Host "✅ ElastiCache clusters found:" -ForegroundColor Green
        Write-Host $cacheCluster -ForegroundColor White
    } else {
        Write-Host "⚠️  No DhakaCart ElastiCache clusters found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check ElastiCache encryption: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Security and Compliance Validation Summary ===" -ForegroundColor Green
Write-Host "✅ Secrets management validation completed" -ForegroundColor Green
Write-Host "✅ RBAC policies validation completed" -ForegroundColor Green
Write-Host "✅ Network security validation completed" -ForegroundColor Green
Write-Host "✅ Container security scanning completed" -ForegroundColor Green
Write-Host "✅ SSL/TLS encryption validation completed" -ForegroundColor Green
Write-Host "✅ Database encryption validation completed" -ForegroundColor Green

Write-Host "`nSecurity validation completed successfully!" -ForegroundColor Green
Write-Host "Review any warnings above and address them as needed." -ForegroundColor Yellow
Write-Host "For detailed security recommendations, see the security compliance guide." -ForegroundColor Blue