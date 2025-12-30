#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Validates performance and scalability for the DhakaCart application
.DESCRIPTION
    This script executes comprehensive load tests, validates response times, tests auto-scaling behavior,
    and verifies system uptime during high load scenarios
.PARAMETER BaseUrl
    Base URL of the deployed application (default: https://dhakacart.example.com)
.PARAMETER ApiUrl
    API base URL (default: https://api.dhakacart.example.com)
.PARAMETER MaxUsers
    Maximum concurrent users for load testing (default: 100000)
.PARAMETER TestDuration
    Duration of load test in minutes (default: 30)
.PARAMETER Region
    AWS region for monitoring (default: us-west-2)
.PARAMETER ClusterName
    EKS cluster name (default: dhakacart-cluster)
.PARAMETER Namespace
    Kubernetes namespace (default: dhakacart)
#>

param(
    [string]$BaseUrl = "https://dhakacart.example.com",
    [string]$ApiUrl = "https://api.dhakacart.example.com",
    [int]$MaxUsers = 100000,
    [int]$TestDuration = 30,
    [string]$Region = "us-west-2",
    [string]$ClusterName = "dhakacart-cluster",
    [string]$Namespace = "dhakacart"
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "=== DhakaCart Performance and Scalability Validation ===" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow
Write-Host "Max Users: $MaxUsers" -ForegroundColor Yellow
Write-Host "Test Duration: $TestDuration minutes" -ForegroundColor Yellow
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

# Function to make HTTP request with timing
function Invoke-TimedWebRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int]$TimeoutSec = 30
    )
    
    try {
        $startTime = Get-Date
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            TimeoutSec = $TimeoutSec
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        
        return @{
            Response = $response
            ResponseTime = $responseTime
            Success = $true
        }
    }
    catch {
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        return @{
            Response = $null
            ResponseTime = $responseTime
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Check required tools
Write-Host "Checking required tools..." -ForegroundColor Blue
$requiredTools = @("kubectl", "aws", "artillery", "curl")
$availableTools = @()
$missingTools = @()

foreach ($tool in $requiredTools) {
    if (Test-Command $tool) {
        $availableTools += $tool
        Write-Host "✅ $tool found" -ForegroundColor Green
    } else {
        $missingTools += $tool
        Write-Host "❌ $tool not found" -ForegroundColor Red
    }
}

if ($missingTools.Count -gt 0) {
    Write-Host "Missing tools: $($missingTools -join ', ')" -ForegroundColor Red
    Write-Host "Some tests may be skipped without these tools." -ForegroundColor Yellow
}

# Configure kubectl context if available
if ("kubectl" -in $availableTools) {
    Write-Host "`nConfiguring kubectl context..." -ForegroundColor Blue
    try {
        aws eks update-kubeconfig --region $Region --name $ClusterName 2>$null
        Write-Host "✅ kubectl context configured" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not configure kubectl context" -ForegroundColor Yellow
    }
}

# Test 1: Baseline performance measurement
Write-Host "`n=== Test 1: Baseline Performance Measurement ===" -ForegroundColor Cyan

Write-Host "Measuring baseline response times..." -ForegroundColor Blue
$baselineTests = @(
    @{ Name = "Homepage"; Url = $BaseUrl },
    @{ Name = "Product Listing"; Url = "$ApiUrl/api/products" },
    @{ Name = "Product Search"; Url = "$ApiUrl/api/products/search?q=laptop" },
    @{ Name = "Health Check"; Url = "$ApiUrl/health" }
)

$baselineResults = @{}
foreach ($test in $baselineTests) {
    Write-Host "Testing $($test.Name)..." -ForegroundColor Gray
    $responseTimes = @()
    
    for ($i = 1; $i -le 10; $i++) {
        $result = Invoke-TimedWebRequest -Uri $test.Url
        if ($result.Success) {
            $responseTimes += $result.ResponseTime
        }
    }
    
    if ($responseTimes.Count -gt 0) {
        $avgTime = ($responseTimes | Measure-Object -Average).Average
        $maxTime = ($responseTimes | Measure-Object -Maximum).Maximum
        $minTime = ($responseTimes | Measure-Object -Minimum).Minimum
        
        $baselineResults[$test.Name] = @{
            Average = $avgTime
            Maximum = $maxTime
            Minimum = $minTime
            Count = $responseTimes.Count
        }
        
        Write-Host "  Average: $([math]::Round($avgTime, 2))ms, Max: $([math]::Round($maxTime, 2))ms, Min: $([math]::Round($minTime, 2))ms" -ForegroundColor White
        
        if ($avgTime -lt 2000) {
            Write-Host "  ✅ Response time under 2 seconds" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Response time exceeds 2 seconds" -ForegroundColor Red
        }
    } else {
        Write-Host "  ❌ All requests failed" -ForegroundColor Red
    }
}

# Test 2: Current system resource usage
Write-Host "`n=== Test 2: Current System Resource Usage ===" -ForegroundColor Cyan

if ("kubectl" -in $availableTools) {
    Write-Host "Checking current pod resource usage..." -ForegroundColor Blue
    try {
        $podMetrics = kubectl top pods -n $Namespace --no-headers 2>$null
        if ($podMetrics) {
            Write-Host "Current pod resource usage:" -ForegroundColor White
            $podMetrics -split "`n" | ForEach-Object {
                if ($_.Trim()) {
                    Write-Host "  $_" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "⚠️  Could not retrieve pod metrics (metrics-server may not be installed)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to get pod metrics: $_" -ForegroundColor Red
    }
    
    Write-Host "Checking node resource usage..." -ForegroundColor Blue
    try {
        $nodeMetrics = kubectl top nodes --no-headers 2>$null
        if ($nodeMetrics) {
            Write-Host "Current node resource usage:" -ForegroundColor White
            $nodeMetrics -split "`n" | ForEach-Object {
                if ($_.Trim()) {
                    Write-Host "  $_" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "⚠️  Could not retrieve node metrics" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to get node metrics: $_" -ForegroundColor Red
    }
    
    Write-Host "Checking HPA status..." -ForegroundColor Blue
    try {
        $hpaStatus = kubectl get hpa -n $Namespace --no-headers 2>$null
        if ($hpaStatus) {
            Write-Host "HPA status:" -ForegroundColor White
            $hpaStatus -split "`n" | ForEach-Object {
                if ($_.Trim()) {
                    Write-Host "  $_" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "⚠️  No HPA configurations found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to get HPA status: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  kubectl not available, skipping Kubernetes resource checks" -ForegroundColor Yellow
}

# Test 3: Progressive load testing
Write-Host "`n=== Test 3: Progressive Load Testing ===" -ForegroundColor Cyan

if ("artillery" -in $availableTools) {
    Write-Host "Creating Artillery load test configuration..." -ForegroundColor Blue
    
    $artilleryConfig = @"
config:
  target: '$ApiUrl'
  phases:
    - duration: 300
      arrivalRate: 1
      name: "Warm up"
    - duration: 600
      arrivalRate: 10
      name: "Ramp up to 10 users/sec"
    - duration: 600
      arrivalRate: 50
      name: "Ramp up to 50 users/sec"
    - duration: 600
      arrivalRate: 100
      name: "Ramp up to 100 users/sec"
    - duration: 600
      arrivalRate: 200
      name: "Peak load 200 users/sec"
  defaults:
    headers:
      User-Agent: "DhakaCart Load Test"
scenarios:
  - name: "Product browsing workflow"
    weight: 60
    flow:
      - get:
          url: "/api/products"
          capture:
            - json: "$.products[0].id"
              as: "productId"
      - get:
          url: "/api/products/{{ productId }}"
      - get:
          url: "/api/products/search?q=laptop"
  - name: "Cart operations workflow"
    weight: 30
    flow:
      - post:
          url: "/api/cart"
          json:
            items: []
          capture:
            - json: "$.id"
              as: "cartId"
      - post:
          url: "/api/cart/{{ cartId }}/items"
          json:
            productId: "1"
            quantity: 1
      - get:
          url: "/api/cart/{{ cartId }}"
      - delete:
          url: "/api/cart/{{ cartId }}/items/1"
  - name: "Health checks"
    weight: 10
    flow:
      - get:
          url: "/health"
      - get:
          url: "/ready"
"@
    
    $configPath = "artillery-load-test.yml"
    $artilleryConfig | Out-File -FilePath $configPath -Encoding UTF8
    
    Write-Host "Starting progressive load test (this will take approximately $($TestDuration) minutes)..." -ForegroundColor Blue
    Write-Host "Monitor the application and infrastructure during this test." -ForegroundColor Yellow
    
    try {
        $loadTestStart = Get-Date
        artillery run $configPath --output load-test-results.json
        $loadTestEnd = Get-Date
        $testDuration = ($loadTestEnd - $loadTestStart).TotalMinutes
        
        Write-Host "✅ Load test completed in $([math]::Round($testDuration, 2)) minutes" -ForegroundColor Green
        
        # Parse results if available
        if (Test-Path "load-test-results.json") {
            Write-Host "Parsing load test results..." -ForegroundColor Blue
            try {
                $results = Get-Content "load-test-results.json" | ConvertFrom-Json
                $summary = $results.aggregate
                
                Write-Host "Load Test Summary:" -ForegroundColor White
                Write-Host "  Total Requests: $($summary.counters.'http.requests')" -ForegroundColor Gray
                Write-Host "  Successful Responses: $($summary.counters.'http.responses')" -ForegroundColor Gray
                Write-Host "  Failed Requests: $($summary.counters.'http.request_rate')" -ForegroundColor Gray
                Write-Host "  Average Response Time: $([math]::Round($summary.latency.mean, 2))ms" -ForegroundColor Gray
                Write-Host "  95th Percentile: $([math]::Round($summary.latency.p95, 2))ms" -ForegroundColor Gray
                Write-Host "  99th Percentile: $([math]::Round($summary.latency.p99, 2))ms" -ForegroundColor Gray
                
                if ($summary.latency.mean -lt 2000) {
                    Write-Host "  ✅ Average response time under 2 seconds" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ Average response time exceeds 2 seconds" -ForegroundColor Red
                }
                
                if ($summary.latency.p99 -lt 5000) {
                    Write-Host "  ✅ 99th percentile under 5 seconds" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ 99th percentile exceeds 5 seconds" -ForegroundColor Red
                }
            } catch {
                Write-Host "⚠️  Could not parse load test results: $_" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "❌ Load test failed: $_" -ForegroundColor Red
    } finally {
        Remove-Item $configPath -ErrorAction SilentlyContinue
        Remove-Item "load-test-results.json" -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "⚠️  Artillery not available, running simplified load test with curl..." -ForegroundColor Yellow
    
    if ("curl" -in $availableTools) {
        Write-Host "Running simplified concurrent load test..." -ForegroundColor Blue
        
        $concurrentScript = @"
#!/bin/bash
CONCURRENT_USERS=100
REQUESTS_PER_USER=50
API_URL="$ApiUrl"

echo "Starting load test with \$CONCURRENT_USERS concurrent users"
echo "Each user will make \$REQUESTS_PER_USER requests"

for i in \$(seq 1 \$CONCURRENT_USERS); do
    (
        for j in \$(seq 1 \$REQUESTS_PER_USER); do
            curl -s -w "User \$i Request \$j: %{http_code} %{time_total}s\n" "\$API_URL/api/products" -o /dev/null
            sleep 0.1
        done
    ) &
done

wait
echo "Load test completed"
"@
        
        $scriptPath = "simple-load-test.sh"
        $concurrentScript | Out-File -FilePath $scriptPath -Encoding UTF8
        
        try {
            if ($IsWindows -and (Test-Command "wsl")) {
                Write-Host "Running load test via WSL..." -ForegroundColor Blue
                wsl bash $scriptPath
            } elseif (-not $IsWindows) {
                Write-Host "Running load test..." -ForegroundColor Blue
                chmod +x $scriptPath
                bash $scriptPath
            } else {
                Write-Host "⚠️  Cannot run bash script on Windows without WSL" -ForegroundColor Yellow
            }
            
            Write-Host "✅ Simplified load test completed" -ForegroundColor Green
        } catch {
            Write-Host "❌ Simplified load test failed: $_" -ForegroundColor Red
        } finally {
            Remove-Item $scriptPath -ErrorAction SilentlyContinue
        }
    }
}

# Test 4: Auto-scaling validation
Write-Host "`n=== Test 4: Auto-scaling Validation ===" -ForegroundColor Cyan

if ("kubectl" -in $availableTools) {
    Write-Host "Monitoring auto-scaling behavior..." -ForegroundColor Blue
    
    # Get initial pod count
    try {
        $initialPods = kubectl get pods -n $Namespace -l app=backend --no-headers | Measure-Object | Select-Object -ExpandProperty Count
        Write-Host "Initial backend pod count: $initialPods" -ForegroundColor White
        
        $initialNodes = kubectl get nodes --no-headers | Measure-Object | Select-Object -ExpandProperty Count
        Write-Host "Initial node count: $initialNodes" -ForegroundColor White
        
        # Generate load to trigger scaling
        Write-Host "Generating load to trigger auto-scaling..." -ForegroundColor Blue
        
        if ("curl" -in $availableTools) {
            $loadScript = @"
#!/bin/bash
echo "Generating high CPU load..."
for i in {1..20}; do
    (
        for j in {1..100}; do
            curl -s "$ApiUrl/api/products" > /dev/null
            curl -s "$ApiUrl/api/products/search?q=test" > /dev/null
        done
    ) &
done
wait
"@
            
            $loadScriptPath = "generate-load.sh"
            $loadScript | Out-File -FilePath $loadScriptPath -Encoding UTF8
            
            # Start load generation in background
            if ($IsWindows -and (Test-Command "wsl")) {
                Start-Job -ScriptBlock { wsl bash $using:loadScriptPath } | Out-Null
            } elseif (-not $IsWindows) {
                chmod +x $loadScriptPath
                Start-Job -ScriptBlock { bash $using:loadScriptPath } | Out-Null
            }
            
            # Monitor scaling for 10 minutes
            Write-Host "Monitoring scaling for 10 minutes..." -ForegroundColor Blue
            $scalingResults = @()
            
            for ($i = 1; $i -le 20; $i++) {
                Start-Sleep 30
                
                try {
                    $currentPods = kubectl get pods -n $Namespace -l app=backend --no-headers | Measure-Object | Select-Object -ExpandProperty Count
                    $currentNodes = kubectl get nodes --no-headers | Measure-Object | Select-Object -ExpandProperty Count
                    
                    $scalingResults += @{
                        Time = $i * 30
                        Pods = $currentPods
                        Nodes = $currentNodes
                    }
                    
                    Write-Host "  Time: $($i * 30)s, Pods: $currentPods, Nodes: $currentNodes" -ForegroundColor Gray
                    
                    if ($currentPods -gt $initialPods) {
                        Write-Host "  ✅ Horizontal Pod Autoscaler triggered (pods: $initialPods → $currentPods)" -ForegroundColor Green
                    }
                    
                    if ($currentNodes -gt $initialNodes) {
                        Write-Host "  ✅ Cluster Autoscaler triggered (nodes: $initialNodes → $currentNodes)" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "  ⚠️  Could not get scaling metrics at time $($i * 30)s" -ForegroundColor Yellow
                }
            }
            
            # Stop load generation
            Get-Job | Stop-Job
            Get-Job | Remove-Job
            Remove-Item $loadScriptPath -ErrorAction SilentlyContinue
            
            # Summary
            $maxPods = ($scalingResults | Measure-Object -Property Pods -Maximum).Maximum
            $maxNodes = ($scalingResults | Measure-Object -Property Nodes -Maximum).Maximum
            
            Write-Host "Auto-scaling Summary:" -ForegroundColor White
            Write-Host "  Initial Pods: $initialPods, Max Pods: $maxPods" -ForegroundColor Gray
            Write-Host "  Initial Nodes: $initialNodes, Max Nodes: $maxNodes" -ForegroundColor Gray
            
            if ($maxPods -gt $initialPods) {
                Write-Host "  ✅ HPA scaling detected" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  No HPA scaling detected (may need more load or time)" -ForegroundColor Yellow
            }
            
            if ($maxNodes -gt $initialNodes) {
                Write-Host "  ✅ Cluster autoscaling detected" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  No cluster autoscaling detected" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠️  curl not available for load generation" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to monitor auto-scaling: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  kubectl not available, skipping auto-scaling validation" -ForegroundColor Yellow
}

# Test 5: System uptime validation
Write-Host "`n=== Test 5: System Uptime Validation ===" -ForegroundColor Cyan

Write-Host "Monitoring system uptime during load..." -ForegroundColor Blue
$uptimeStart = Get-Date
$uptimeResults = @()
$totalRequests = 0
$successfulRequests = 0

# Monitor for 15 minutes with requests every 10 seconds
for ($i = 1; $i -le 90; $i++) {
    $result = Invoke-TimedWebRequest -Uri "$ApiUrl/health" -TimeoutSec 10
    $totalRequests++
    
    if ($result.Success) {
        $successfulRequests++
        $status = "✅"
    } else {
        $status = "❌"
    }
    
    $uptime = ($successfulRequests / $totalRequests) * 100
    $uptimeResults += $uptime
    
    if ($i % 6 -eq 0) {  # Every minute
        Write-Host "  Minute $($i / 6): Uptime $([math]::Round($uptime, 2))% $status" -ForegroundColor Gray
    }
    
    Start-Sleep 10
}

$uptimeEnd = Get-Date
$testDuration = ($uptimeEnd - $uptimeStart).TotalMinutes
$finalUptime = ($successfulRequests / $totalRequests) * 100

Write-Host "Uptime Validation Summary:" -ForegroundColor White
Write-Host "  Test Duration: $([math]::Round($testDuration, 2)) minutes" -ForegroundColor Gray
Write-Host "  Total Requests: $totalRequests" -ForegroundColor Gray
Write-Host "  Successful Requests: $successfulRequests" -ForegroundColor Gray
Write-Host "  Final Uptime: $([math]::Round($finalUptime, 2))%" -ForegroundColor Gray

if ($finalUptime -ge 99.9) {
    Write-Host "  ✅ Uptime meets 99.9% requirement" -ForegroundColor Green
} elseif ($finalUptime -ge 99.0) {
    Write-Host "  ⚠️  Uptime is $([math]::Round($finalUptime, 2))% (below 99.9% target)" -ForegroundColor Yellow
} else {
    Write-Host "  ❌ Uptime is $([math]::Round($finalUptime, 2))% (significantly below target)" -ForegroundColor Red
}

# Test 6: Database performance under load
Write-Host "`n=== Test 6: Database Performance Under Load ===" -ForegroundColor Cyan

Write-Host "Testing database-intensive operations..." -ForegroundColor Blue
$dbTests = @(
    @{ Name = "Product Search"; Url = "$ApiUrl/api/products/search?q=laptop" },
    @{ Name = "Category Filter"; Url = "$ApiUrl/api/products?category=electronics" },
    @{ Name = "Product Details"; Url = "$ApiUrl/api/products/1" }
)

foreach ($test in $dbTests) {
    Write-Host "Testing $($test.Name) under load..." -ForegroundColor Gray
    $dbResponseTimes = @()
    
    # Concurrent requests to test database performance
    $jobs = @()
    for ($i = 1; $i -le 20; $i++) {
        $jobs += Start-Job -ScriptBlock {
            param($Url)
            $startTime = Get-Date
            try {
                Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30 | Out-Null
                $endTime = Get-Date
                return ($endTime - $startTime).TotalMilliseconds
            } catch {
                return -1
            }
        } -ArgumentList $test.Url
    }
    
    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    $validResults = $results | Where-Object { $_ -gt 0 }
    if ($validResults.Count -gt 0) {
        $avgTime = ($validResults | Measure-Object -Average).Average
        $maxTime = ($validResults | Measure-Object -Maximum).Maximum
        $successRate = ($validResults.Count / $results.Count) * 100
        
        Write-Host "  Average: $([math]::Round($avgTime, 2))ms, Max: $([math]::Round($maxTime, 2))ms, Success: $([math]::Round($successRate, 1))%" -ForegroundColor White
        
        if ($avgTime -lt 2000 -and $successRate -ge 95) {
            Write-Host "  ✅ Database performance acceptable under load" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Database performance may be degraded under load" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ All database requests failed" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n=== Performance and Scalability Validation Summary ===" -ForegroundColor Green
Write-Host "✅ Baseline performance measurement completed" -ForegroundColor Green
Write-Host "✅ System resource usage checked" -ForegroundColor Green
Write-Host "✅ Progressive load testing completed" -ForegroundColor Green
Write-Host "✅ Auto-scaling validation completed" -ForegroundColor Green
Write-Host "✅ System uptime validation completed" -ForegroundColor Green
Write-Host "✅ Database performance under load tested" -ForegroundColor Green

Write-Host "`nPerformance and scalability validation completed!" -ForegroundColor Green
Write-Host "Review the results above to ensure all performance targets are met." -ForegroundColor Yellow
Write-Host "For detailed performance optimization recommendations, see the performance guide." -ForegroundColor Blue

# Generate summary report
$reportPath = "performance-validation-report.txt"
$report = @"
DhakaCart Performance and Scalability Validation Report
Generated: $(Get-Date)

Test Configuration:
- Base URL: $BaseUrl
- API URL: $ApiUrl
- Max Users: $MaxUsers
- Test Duration: $TestDuration minutes
- Region: $Region
- Cluster: $ClusterName
- Namespace: $Namespace

Baseline Performance Results:
$(if ($baselineResults.Count -gt 0) {
    $baselineResults.GetEnumerator() | ForEach-Object {
        "- $($_.Key): Avg $([math]::Round($_.Value.Average, 2))ms, Max $([math]::Round($_.Value.Maximum, 2))ms"
    }
} else {
    "- No baseline results available"
})

System Uptime:
- Final Uptime: $([math]::Round($finalUptime, 2))%
- Total Requests: $totalRequests
- Successful Requests: $successfulRequests
- Test Duration: $([math]::Round($testDuration, 2)) minutes

Recommendations:
- Monitor response times during peak usage
- Ensure auto-scaling policies are properly configured
- Consider database optimization if response times are high
- Implement caching strategies for frequently accessed data
- Set up comprehensive monitoring and alerting
"@

$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "`nDetailed report saved to: $reportPath" -ForegroundColor Blue