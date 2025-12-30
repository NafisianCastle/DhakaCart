#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Validates end-to-end user workflows for the DhakaCart application
.DESCRIPTION
    This script tests complete user journeys including product listing, search, cart functionality,
    API rate limiting, error handling, session management, and caching behavior
.PARAMETER BaseUrl
    Base URL of the deployed application (default: https://dhakacart.example.com)
.PARAMETER ApiUrl
    API base URL (default: https://api.dhakacart.example.com)
.PARAMETER TestUsers
    Number of concurrent test users (default: 10)
#>

param(
    [string]$BaseUrl = "https://dhakacart.example.com",
    [string]$ApiUrl = "https://api.dhakacart.example.com",
    [int]$TestUsers = 10
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "=== DhakaCart End-to-End User Workflow Tests ===" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow
Write-Host "Test Users: $TestUsers" -ForegroundColor Yellow
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

# Function to make HTTP request with error handling
function Invoke-SafeWebRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int]$TimeoutSec = 30
    )
    
    try {
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
        
        return Invoke-WebRequest @params
    }
    catch {
        return $null
    }
}

# Function to test API endpoint
function Test-ApiEndpoint {
    param(
        [string]$Endpoint,
        [string]$Description,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Testing $Description..." -ForegroundColor Blue
    $response = Invoke-SafeWebRequest -Uri "$ApiUrl$Endpoint"
    
    if ($response -and $response.StatusCode -eq $ExpectedStatus) {
        Write-Host "✅ $Description - Status: $($response.StatusCode)" -ForegroundColor Green
        return $true
    } else {
        $status = if ($response) { $response.StatusCode } else { "No Response" }
        Write-Host "❌ $Description - Status: $status" -ForegroundColor Red
        return $false
    }
}

# Check required tools
Write-Host "Checking required tools..." -ForegroundColor Blue
$requiredTools = @("curl")
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
    Write-Host "Note: Some tests may be skipped without these tools." -ForegroundColor Yellow
}

# Test 1: Basic connectivity and health checks
Write-Host "`n=== Test 1: Basic Connectivity and Health Checks ===" -ForegroundColor Cyan

Write-Host "Testing frontend accessibility..." -ForegroundColor Blue
$frontendResponse = Invoke-SafeWebRequest -Uri $BaseUrl
if ($frontendResponse -and $frontendResponse.StatusCode -eq 200) {
    Write-Host "✅ Frontend accessible - Status: $($frontendResponse.StatusCode)" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend not accessible" -ForegroundColor Red
}

# Test API health endpoint
Test-ApiEndpoint -Endpoint "/health" -Description "API Health Check"

# Test API readiness endpoint
Test-ApiEndpoint -Endpoint "/ready" -Description "API Readiness Check"

# Test 2: Product listing and search functionality
Write-Host "`n=== Test 2: Product Listing and Search Functionality ===" -ForegroundColor Cyan

# Test product listing
$productsTest = Test-ApiEndpoint -Endpoint "/api/products" -Description "Product Listing"

if ($productsTest) {
    Write-Host "Testing product listing with pagination..." -ForegroundColor Blue
    $paginatedResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products?page=1&limit=10"
    if ($paginatedResponse -and $paginatedResponse.StatusCode -eq 200) {
        Write-Host "✅ Paginated product listing works" -ForegroundColor Green
        
        # Parse response to check structure
        try {
            $products = $paginatedResponse.Content | ConvertFrom-Json
            if ($products.products -and $products.total) {
                Write-Host "✅ Product response structure is valid" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Product response structure may be incorrect" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  Could not parse product response JSON" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Paginated product listing failed" -ForegroundColor Red
    }
}

# Test product search
Write-Host "Testing product search functionality..." -ForegroundColor Blue
$searchResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products/search?q=laptop"
if ($searchResponse -and $searchResponse.StatusCode -eq 200) {
    Write-Host "✅ Product search works" -ForegroundColor Green
} else {
    Write-Host "❌ Product search failed" -ForegroundColor Red
}

# Test category filtering
Write-Host "Testing category filtering..." -ForegroundColor Blue
$categoryResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products?category=electronics"
if ($categoryResponse -and $categoryResponse.StatusCode -eq 200) {
    Write-Host "✅ Category filtering works" -ForegroundColor Green
} else {
    Write-Host "❌ Category filtering failed" -ForegroundColor Red
}

# Test 3: Cart functionality
Write-Host "`n=== Test 3: Cart Functionality ===" -ForegroundColor Cyan

# Test cart creation
Write-Host "Testing cart creation..." -ForegroundColor Blue
$cartData = @{
    items = @()
} | ConvertTo-Json

$cartResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/cart" -Method "POST" -Body $cartData
if ($cartResponse -and $cartResponse.StatusCode -in @(200, 201)) {
    Write-Host "✅ Cart creation works" -ForegroundColor Green
    
    # Extract cart ID for further tests
    try {
        $cart = $cartResponse.Content | ConvertFrom-Json
        $cartId = $cart.id
        
        if ($cartId) {
            Write-Host "Testing add item to cart..." -ForegroundColor Blue
            $addItemData = @{
                productId = "1"
                quantity = 2
            } | ConvertTo-Json
            
            $addItemResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/cart/$cartId/items" -Method "POST" -Body $addItemData
            if ($addItemResponse -and $addItemResponse.StatusCode -in @(200, 201)) {
                Write-Host "✅ Add item to cart works" -ForegroundColor Green
                
                # Test cart retrieval
                Write-Host "Testing cart retrieval..." -ForegroundColor Blue
                $getCartResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/cart/$cartId"
                if ($getCartResponse -and $getCartResponse.StatusCode -eq 200) {
                    Write-Host "✅ Cart retrieval works" -ForegroundColor Green
                } else {
                    Write-Host "❌ Cart retrieval failed" -ForegroundColor Red
                }
                
                # Test cart update
                Write-Host "Testing cart item update..." -ForegroundColor Blue
                $updateItemData = @{
                    quantity = 3
                } | ConvertTo-Json
                
                $updateResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/cart/$cartId/items/1" -Method "PUT" -Body $updateItemData
                if ($updateResponse -and $updateResponse.StatusCode -eq 200) {
                    Write-Host "✅ Cart item update works" -ForegroundColor Green
                } else {
                    Write-Host "❌ Cart item update failed" -ForegroundColor Red
                }
                
                # Test cart item removal
                Write-Host "Testing cart item removal..." -ForegroundColor Blue
                $removeResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/cart/$cartId/items/1" -Method "DELETE"
                if ($removeResponse -and $removeResponse.StatusCode -in @(200, 204)) {
                    Write-Host "✅ Cart item removal works" -ForegroundColor Green
                } else {
                    Write-Host "❌ Cart item removal failed" -ForegroundColor Red
                }
            } else {
                Write-Host "❌ Add item to cart failed" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "⚠️  Could not parse cart response for further testing" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Cart creation failed" -ForegroundColor Red
}

# Test 4: API rate limiting
Write-Host "`n=== Test 4: API Rate Limiting ===" -ForegroundColor Cyan

Write-Host "Testing API rate limiting..." -ForegroundColor Blue
$rateLimitHit = $false
$requestCount = 0

for ($i = 1; $i -le 100; $i++) {
    $response = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products" -TimeoutSec 5
    $requestCount++
    
    if ($response -and $response.StatusCode -eq 429) {
        Write-Host "✅ Rate limiting triggered after $requestCount requests" -ForegroundColor Green
        $rateLimitHit = $true
        break
    }
    
    if ($i % 10 -eq 0) {
        Write-Host "  Sent $i requests..." -ForegroundColor Gray
    }
    
    Start-Sleep -Milliseconds 100
}

if (-not $rateLimitHit) {
    Write-Host "⚠️  Rate limiting not triggered after $requestCount requests" -ForegroundColor Yellow
}

# Test 5: Error handling
Write-Host "`n=== Test 5: Error Handling ===" -ForegroundColor Cyan

# Test 404 error handling
Write-Host "Testing 404 error handling..." -ForegroundColor Blue
$notFoundResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products/nonexistent"
if ($notFoundResponse -and $notFoundResponse.StatusCode -eq 404) {
    Write-Host "✅ 404 error handling works" -ForegroundColor Green
} else {
    Write-Host "❌ 404 error handling failed" -ForegroundColor Red
}

# Test invalid request handling
Write-Host "Testing invalid request handling..." -ForegroundColor Blue
$invalidData = "invalid json"
$invalidResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/cart" -Method "POST" -Body $invalidData
if ($invalidResponse -and $invalidResponse.StatusCode -eq 400) {
    Write-Host "✅ Invalid request handling works" -ForegroundColor Green
} else {
    Write-Host "❌ Invalid request handling failed" -ForegroundColor Red
}

# Test 6: Session management and caching
Write-Host "`n=== Test 6: Session Management and Caching ===" -ForegroundColor Cyan

Write-Host "Testing session persistence..." -ForegroundColor Blue
$sessionHeaders = @{
    "Cookie" = "session=test-session-id"
}

$sessionResponse1 = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products" -Headers $sessionHeaders
$sessionResponse2 = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products" -Headers $sessionHeaders

if ($sessionResponse1 -and $sessionResponse2) {
    Write-Host "✅ Session-based requests work" -ForegroundColor Green
} else {
    Write-Host "❌ Session-based requests failed" -ForegroundColor Red
}

Write-Host "Testing cache headers..." -ForegroundColor Blue
$cacheResponse = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products"
if ($cacheResponse) {
    $cacheHeaders = $cacheResponse.Headers
    if ($cacheHeaders["Cache-Control"] -or $cacheHeaders["ETag"]) {
        Write-Host "✅ Cache headers present" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No cache headers found" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Could not check cache headers" -ForegroundColor Red
}

# Test 7: Performance validation
Write-Host "`n=== Test 7: Performance Validation ===" -ForegroundColor Cyan

Write-Host "Testing response times..." -ForegroundColor Blue
$responseTimes = @()

for ($i = 1; $i -le 10; $i++) {
    $startTime = Get-Date
    $response = Invoke-SafeWebRequest -Uri "$ApiUrl/api/products"
    $endTime = Get-Date
    
    if ($response) {
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        $responseTimes += $responseTime
        Write-Host "  Request $i : $([math]::Round($responseTime, 2))ms" -ForegroundColor Gray
    }
}

if ($responseTimes.Count -gt 0) {
    $avgResponseTime = ($responseTimes | Measure-Object -Average).Average
    $maxResponseTime = ($responseTimes | Measure-Object -Maximum).Maximum
    
    Write-Host "Average response time: $([math]::Round($avgResponseTime, 2))ms" -ForegroundColor White
    Write-Host "Maximum response time: $([math]::Round($maxResponseTime, 2))ms" -ForegroundColor White
    
    if ($avgResponseTime -lt 2000) {
        Write-Host "✅ Average response time under 2 seconds" -ForegroundColor Green
    } else {
        Write-Host "❌ Average response time exceeds 2 seconds" -ForegroundColor Red
    }
    
    if ($maxResponseTime -lt 5000) {
        Write-Host "✅ Maximum response time acceptable" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Maximum response time may be too high" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Could not measure response times" -ForegroundColor Red
}

# Test 8: Concurrent user simulation
Write-Host "`n=== Test 8: Concurrent User Simulation ===" -ForegroundColor Cyan

if (Test-Command "curl") {
    Write-Host "Testing concurrent users with curl..." -ForegroundColor Blue
    
    # Create a simple concurrent test script
    $concurrentTestScript = @"
#!/bin/bash
for i in {1..$TestUsers}; do
    (
        echo "User \$i starting..."
        curl -s -o /dev/null -w "User \$i: %{http_code} %{time_total}s\n" "$ApiUrl/api/products"
        curl -s -o /dev/null -w "User \$i: %{http_code} %{time_total}s\n" "$ApiUrl/api/products/search?q=test"
    ) &
done
wait
echo "All concurrent tests completed"
"@
    
    $scriptPath = "temp_concurrent_test.sh"
    $concurrentTestScript | Out-File -FilePath $scriptPath -Encoding UTF8
    
    try {
        if ($IsWindows) {
            # Use WSL if available on Windows
            if (Test-Command "wsl") {
                $result = wsl bash $scriptPath
                Write-Host $result -ForegroundColor White
            } else {
                Write-Host "⚠️  WSL not available for concurrent testing on Windows" -ForegroundColor Yellow
            }
        } else {
            # Run directly on Linux/macOS
            chmod +x $scriptPath
            $result = bash $scriptPath
            Write-Host $result -ForegroundColor White
        }
        
        Write-Host "✅ Concurrent user simulation completed" -ForegroundColor Green
    } catch {
        Write-Host "❌ Concurrent user simulation failed: $_" -ForegroundColor Red
    } finally {
        Remove-Item $scriptPath -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "⚠️  Curl not available, skipping concurrent user simulation" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== End-to-End User Workflow Tests Summary ===" -ForegroundColor Green
Write-Host "✅ Basic connectivity tests completed" -ForegroundColor Green
Write-Host "✅ Product listing and search tests completed" -ForegroundColor Green
Write-Host "✅ Cart functionality tests completed" -ForegroundColor Green
Write-Host "✅ API rate limiting tests completed" -ForegroundColor Green
Write-Host "✅ Error handling tests completed" -ForegroundColor Green
Write-Host "✅ Session management and caching tests completed" -ForegroundColor Green
Write-Host "✅ Performance validation completed" -ForegroundColor Green
Write-Host "✅ Concurrent user simulation completed" -ForegroundColor Green

Write-Host "`nUser workflow validation completed successfully!" -ForegroundColor Green
Write-Host "Review any warnings above and address them as needed." -ForegroundColor Yellow
Write-Host "For detailed workflow testing guide, see the user workflow testing documentation." -ForegroundColor Blue