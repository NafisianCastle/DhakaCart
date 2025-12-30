# Task 11.7: End-to-End User Workflow Testing Guide

## Overview

This guide provides comprehensive instructions for testing complete user journeys in the DhakaCart application, including product listing, search, cart functionality, API rate limiting, error handling, session management, and caching behavior.

## Prerequisites

### Required Tools
- PowerShell 7+ (Windows) or Bash (Linux/macOS)
- curl (for HTTP requests and concurrent testing)
- Web browser (for manual testing)
- Artillery.js or similar load testing tool (optional)

### Test Environment Setup
- Deployed DhakaCart application with accessible URLs
- Valid SSL certificates (for HTTPS testing)
- Database with sample product data
- Redis cache configured and running

## User Workflow Test Components

### 1. Basic Connectivity and Health Checks

#### Frontend Accessibility
```powershell
# Test frontend homepage
Invoke-WebRequest -Uri "https://dhakacart.example.com" -UseBasicParsing

# Check for proper HTML response
$response = Invoke-WebRequest -Uri "https://dhakacart.example.com"
$response.Content -match "<title>.*DhakaCart.*</title>"
```

#### API Health Endpoints
```bash
# Health check endpoint
curl -f https://api.dhakacart.example.com/health

# Readiness check endpoint
curl -f https://api.dhakacart.example.com/ready

# Check response format
curl -s https://api.dhakacart.example.com/health | jq '.'
```

#### SSL/TLS Validation
```bash
# Check SSL certificate
openssl s_client -connect dhakacart.example.com:443 -servername dhakacart.example.com

# Verify certificate chain
curl -vI https://dhakacart.example.com 2>&1 | grep -E "(SSL|TLS|certificate)"
```

### 2. Product Listing and Search Functionality

#### Product Listing Tests
```bash
# Basic product listing
curl -s "https://api.dhakacart.example.com/api/products" | jq '.products | length'

# Paginated listing
curl -s "https://api.dhakacart.example.com/api/products?page=1&limit=10" | jq '.'

# Category filtering
curl -s "https://api.dhakacart.example.com/api/products?category=electronics" | jq '.products[0].category'

# Sorting options
curl -s "https://api.dhakacart.example.com/api/products?sort=price&order=asc" | jq '.'
```

#### Search Functionality Tests
```bash
# Text search
curl -s "https://api.dhakacart.example.com/api/products/search?q=laptop" | jq '.products | length'

# Search with filters
curl -s "https://api.dhakacart.example.com/api/products/search?q=phone&category=electronics&minPrice=100" | jq '.'

# Empty search results
curl -s "https://api.dhakacart.example.com/api/products/search?q=nonexistentproduct" | jq '.products | length'

# Special characters in search
curl -s "https://api.dhakacart.example.com/api/products/search?q=test%20product" | jq '.'
```

#### Product Details Tests
```bash
# Get specific product
curl -s "https://api.dhakacart.example.com/api/products/1" | jq '.'

# Product not found
curl -w "%{http_code}" -s "https://api.dhakacart.example.com/api/products/999999" -o /dev/null

# Product images and metadata
curl -s "https://api.dhakacart.example.com/api/products/1" | jq '.images, .specifications'
```

### 3. Cart Functionality Tests

#### Cart Creation and Management
```bash
# Create new cart
CART_RESPONSE=$(curl -s -X POST "https://api.dhakacart.example.com/api/cart" \
  -H "Content-Type: application/json" \
  -d '{"items": []}')

CART_ID=$(echo $CART_RESPONSE | jq -r '.id')
echo "Created cart: $CART_ID"

# Add item to cart
curl -X POST "https://api.dhakacart.example.com/api/cart/$CART_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"productId": "1", "quantity": 2}'

# Get cart contents
curl -s "https://api.dhakacart.example.com/api/cart/$CART_ID" | jq '.'
```

#### Cart Operations
```bash
# Update item quantity
curl -X PUT "https://api.dhakacart.example.com/api/cart/$CART_ID/items/1" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 3}'

# Remove item from cart
curl -X DELETE "https://api.dhakacart.example.com/api/cart/$CART_ID/items/1"

# Clear entire cart
curl -X DELETE "https://api.dhakacart.example.com/api/cart/$CART_ID"

# Cart persistence test
curl -s "https://api.dhakacart.example.com/api/cart/$CART_ID" | jq '.items | length'
```

#### Cart Validation Tests
```bash
# Add invalid product
curl -w "%{http_code}" -X POST "https://api.dhakacart.example.com/api/cart/$CART_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"productId": "invalid", "quantity": 1}' -o /dev/null

# Negative quantity
curl -w "%{http_code}" -X POST "https://api.dhakacart.example.com/api/cart/$CART_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"productId": "1", "quantity": -1}' -o /dev/null

# Excessive quantity
curl -w "%{http_code}" -X POST "https://api.dhakacart.example.com/api/cart/$CART_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"productId": "1", "quantity": 10000}' -o /dev/null
```

### 4. API Rate Limiting Tests

#### Rate Limit Detection
```bash
# Rapid requests to trigger rate limiting
for i in {1..100}; do
  RESPONSE=$(curl -w "%{http_code}" -s "https://api.dhakacart.example.com/api/products" -o /dev/null)
  echo "Request $i: $RESPONSE"
  
  if [ "$RESPONSE" = "429" ]; then
    echo "Rate limit triggered at request $i"
    break
  fi
  
  sleep 0.1
done
```

#### Rate Limit Headers
```bash
# Check rate limit headers
curl -I "https://api.dhakacart.example.com/api/products" | grep -E "(X-RateLimit|Retry-After)"

# Test rate limit reset
curl -s -I "https://api.dhakacart.example.com/api/products" | grep "X-RateLimit-Reset"
```

#### Different Endpoint Rate Limits
```bash
# Test different endpoints for varying rate limits
endpoints=("/api/products" "/api/products/search" "/api/cart")

for endpoint in "${endpoints[@]}"; do
  echo "Testing rate limit for $endpoint"
  for i in {1..50}; do
    RESPONSE=$(curl -w "%{http_code}" -s "https://api.dhakacart.example.com$endpoint" -o /dev/null)
    if [ "$RESPONSE" = "429" ]; then
      echo "$endpoint: Rate limit at request $i"
      break
    fi
  done
done
```

### 5. Error Handling Tests

#### HTTP Error Codes
```bash
# 404 Not Found
curl -w "%{http_code}" -s "https://api.dhakacart.example.com/api/nonexistent" -o /dev/null

# 400 Bad Request
curl -w "%{http_code}" -X POST "https://api.dhakacart.example.com/api/cart" \
  -H "Content-Type: application/json" \
  -d 'invalid json' -o /dev/null

# 405 Method Not Allowed
curl -w "%{http_code}" -X DELETE "https://api.dhakacart.example.com/api/products" -o /dev/null

# 500 Internal Server Error (if applicable)
curl -w "%{http_code}" -s "https://api.dhakacart.example.com/api/error-test" -o /dev/null
```

#### Error Response Format
```bash
# Check error response structure
curl -s "https://api.dhakacart.example.com/api/nonexistent" | jq '.'

# Validate error message format
ERROR_RESPONSE=$(curl -s "https://api.dhakacart.example.com/api/nonexistent")
echo $ERROR_RESPONSE | jq -e '.error, .message' > /dev/null && echo "Error format valid"
```

#### Timeout Handling
```bash
# Test connection timeout
curl --connect-timeout 1 "https://api.dhakacart.example.com/api/products"

# Test read timeout
curl --max-time 5 "https://api.dhakacart.example.com/api/products"
```

### 6. Session Management and Caching Tests

#### Session Persistence
```bash
# Create session with cookie
SESSION_COOKIE="session=test-session-$(date +%s)"

# Make requests with session
curl -b "$SESSION_COOKIE" "https://api.dhakacart.example.com/api/products"
curl -b "$SESSION_COOKIE" "https://api.dhakacart.example.com/api/cart"

# Verify session persistence
curl -b "$SESSION_COOKIE" -c cookies.txt "https://api.dhakacart.example.com/api/products"
cat cookies.txt
```

#### Cache Headers Validation
```bash
# Check cache control headers
curl -I "https://api.dhakacart.example.com/api/products" | grep -i cache

# ETag validation
ETAG=$(curl -I "https://api.dhakacart.example.com/api/products" | grep -i etag | cut -d' ' -f2)
curl -H "If-None-Match: $ETAG" -w "%{http_code}" "https://api.dhakacart.example.com/api/products"

# Last-Modified validation
LAST_MODIFIED=$(curl -I "https://api.dhakacart.example.com/api/products" | grep -i last-modified | cut -d' ' -f2-)
curl -H "If-Modified-Since: $LAST_MODIFIED" -w "%{http_code}" "https://api.dhakacart.example.com/api/products"
```

#### Redis Cache Testing
```bash
# Test cache hit/miss (requires Redis CLI access)
redis-cli -h redis-host FLUSHALL
curl "https://api.dhakacart.example.com/api/products" # Cache miss
curl "https://api.dhakacart.example.com/api/products" # Cache hit

# Check cache keys
redis-cli -h redis-host KEYS "*products*"
```

### 7. Performance Validation Tests

#### Response Time Measurement
```bash
# Single request timing
curl -w "Time: %{time_total}s\n" -s "https://api.dhakacart.example.com/api/products" -o /dev/null

# Multiple requests for average
for i in {1..10}; do
  curl -w "Request $i: %{time_total}s\n" -s "https://api.dhakacart.example.com/api/products" -o /dev/null
done
```

#### Throughput Testing
```bash
# Concurrent requests
seq 1 10 | xargs -n1 -P10 -I{} curl -w "Request {}: %{time_total}s %{http_code}\n" -s "https://api.dhakacart.example.com/api/products" -o /dev/null
```

#### Load Testing with Artillery
```javascript
// artillery-config.yml
config:
  target: 'https://api.dhakacart.example.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Product browsing"
    flow:
      - get:
          url: "/api/products"
      - get:
          url: "/api/products/search?q=laptop"
      - post:
          url: "/api/cart"
          json:
            items: []
```

```bash
# Run Artillery test
artillery run artillery-config.yml
```

### 8. Concurrent User Simulation

#### Bash Concurrent Testing
```bash
#!/bin/bash
# concurrent-test.sh

USER_COUNT=50
API_BASE="https://api.dhakacart.example.com"

simulate_user() {
    local user_id=$1
    echo "User $user_id: Starting session"
    
    # Browse products
    curl -s "$API_BASE/api/products" > /dev/null
    
    # Search for products
    curl -s "$API_BASE/api/products/search?q=test" > /dev/null
    
    # Create cart
    CART_RESPONSE=$(curl -s -X POST "$API_BASE/api/cart" -H "Content-Type: application/json" -d '{"items": []}')
    CART_ID=$(echo $CART_RESPONSE | jq -r '.id')
    
    # Add items to cart
    curl -s -X POST "$API_BASE/api/cart/$CART_ID/items" \
        -H "Content-Type: application/json" \
        -d '{"productId": "1", "quantity": 1}' > /dev/null
    
    echo "User $user_id: Session completed"
}

# Run concurrent users
for i in $(seq 1 $USER_COUNT); do
    simulate_user $i &
done

wait
echo "All $USER_COUNT users completed"
```

#### PowerShell Concurrent Testing
```powershell
# Concurrent user simulation in PowerShell
$UserCount = 20
$ApiBase = "https://api.dhakacart.example.com"

$Jobs = @()
for ($i = 1; $i -le $UserCount; $i++) {
    $Jobs += Start-Job -ScriptBlock {
        param($UserId, $ApiBase)
        
        # Simulate user workflow
        Invoke-WebRequest -Uri "$ApiBase/api/products" -UseBasicParsing | Out-Null
        Invoke-WebRequest -Uri "$ApiBase/api/products/search?q=test" -UseBasicParsing | Out-Null
        
        $CartData = '{"items": []}' 
        $CartResponse = Invoke-WebRequest -Uri "$ApiBase/api/cart" -Method POST -Body $CartData -ContentType "application/json" -UseBasicParsing
        
        Write-Output "User $UserId completed"
    } -ArgumentList $i, $ApiBase
}

# Wait for all jobs to complete
$Jobs | Wait-Job | Receive-Job
$Jobs | Remove-Job
```

## Automated Testing Script

### Running the Complete Test Suite
```powershell
# Run all user workflow tests
./scripts/validate-user-workflows.ps1 -BaseUrl "https://dhakacart.example.com" -ApiUrl "https://api.dhakacart.example.com" -TestUsers 10

# Run with custom parameters
./scripts/validate-user-workflows.ps1 -BaseUrl "https://staging.dhakacart.com" -ApiUrl "https://api-staging.dhakacart.com" -TestUsers 5
```

### Test Result Interpretation
- ✅ Green checkmarks indicate successful tests
- ⚠️ Yellow warnings indicate potential issues or missing features
- ❌ Red errors indicate test failures that need attention

## Manual Testing Checklist

### Frontend User Journey
- [ ] Homepage loads correctly
- [ ] Product listing displays properly
- [ ] Search functionality works
- [ ] Product details page accessible
- [ ] Add to cart functionality works
- [ ] Cart page displays items correctly
- [ ] Checkout process (if implemented)
- [ ] User registration/login (if implemented)

### Mobile Responsiveness
- [ ] Homepage responsive on mobile
- [ ] Product listing mobile-friendly
- [ ] Search works on mobile
- [ ] Cart functionality on mobile
- [ ] Touch interactions work properly

### Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

## Performance Benchmarks

### Response Time Targets
- Product listing: < 500ms
- Product search: < 1000ms
- Cart operations: < 300ms
- Static assets: < 200ms

### Throughput Targets
- Concurrent users: 100+
- Requests per second: 1000+
- 99th percentile response time: < 2000ms

### Resource Usage
- CPU utilization: < 70%
- Memory usage: < 80%
- Database connections: < 80% of pool

## Troubleshooting Common Issues

### Connection Issues
```bash
# Test DNS resolution
nslookup dhakacart.example.com

# Test network connectivity
ping dhakacart.example.com

# Check SSL certificate
curl -vI https://dhakacart.example.com
```

### API Issues
```bash
# Check API health
curl -f https://api.dhakacart.example.com/health

# Validate API response format
curl -s https://api.dhakacart.example.com/api/products | jq '.'

# Check for CORS issues
curl -H "Origin: https://dhakacart.example.com" -I https://api.dhakacart.example.com/api/products
```

### Performance Issues
```bash
# Check response times
curl -w "@curl-format.txt" -s https://api.dhakacart.example.com/api/products

# Monitor resource usage
kubectl top pods -n dhakacart

# Check database performance
kubectl logs -n dhakacart deployment/backend | grep -i "slow query"
```

## Continuous Testing Integration

### GitHub Actions Workflow
```yaml
name: User Workflow Tests
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  user-workflow-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run workflow tests
        run: |
          chmod +x scripts/validate-user-workflows.ps1
          pwsh scripts/validate-user-workflows.ps1 -BaseUrl ${{ secrets.PROD_BASE_URL }} -ApiUrl ${{ secrets.PROD_API_URL }}
```

### Monitoring Integration
- Set up alerts for test failures
- Track test execution metrics
- Monitor user workflow success rates
- Create dashboards for test results

## Additional Resources

- [API Testing Best Practices](https://restfulapi.net/api-testing/)
- [Load Testing Guidelines](https://artillery.io/docs/guides/getting-started/core-concepts.html)
- [Web Performance Testing](https://web.dev/performance/)
- [User Experience Testing](https://www.nngroup.com/articles/usability-testing-101/)