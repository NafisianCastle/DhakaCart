# DhakaCart Performance Testing Suite

This comprehensive performance testing suite validates that the DhakaCart application meets the performance requirements specified in the cloud infrastructure migration specification.

## 🎯 Performance Requirements

Based on the requirements document, this suite validates:

- **Requirement 1.1**: Response times under 2 seconds for 100,000 concurrent visitors
- **Requirement 1.2**: Auto-scaling within 5 minutes during traffic surges
- **Requirement 1.5**: 99.9% uptime availability

## 🧪 Test Types

### 1. Load Testing (`api-load-test.yml`)
- **Purpose**: Validate normal operating conditions
- **Duration**: ~25 minutes
- **Peak Load**: 100 concurrent users
- **Scenarios**: Health checks, product operations, search functionality
- **Thresholds**: 95% requests < 2s, 95% success rate

### 2. Stress Testing (`stress-test.yml`)
- **Purpose**: Find system breaking point
- **Duration**: ~25 minutes
- **Peak Load**: 1000 concurrent users
- **Focus**: Heavy database operations and resource exhaustion
- **Thresholds**: 95% requests < 5s, 80% success rate

### 3. Spike Testing (`spike-test.yml`)
- **Purpose**: Validate sudden traffic surge handling
- **Duration**: ~9 minutes
- **Peak Load**: 1000 concurrent users (sudden spikes)
- **Scenarios**: Flash sale simulation, traffic bursts
- **Thresholds**: 95% requests < 8s, 70% success rate during spikes

### 4. Endurance Testing (`endurance-test.yml`)
- **Purpose**: Validate system stability over extended periods
- **Duration**: 2 hours
- **Load**: 30 concurrent users (sustained)
- **Focus**: Memory leaks, resource degradation
- **Thresholds**: Consistent performance over time

### 5. Frontend Performance Testing (Lighthouse CI)
- **Purpose**: Validate frontend performance and user experience
- **Metrics**: Core Web Vitals, accessibility, SEO
- **Thresholds**: Performance score > 80%, LCP < 4s, CLS < 0.1

### 6. Database Performance Testing
- **Purpose**: Validate database operations under load
- **Tests**: CRUD operations, complex queries, concurrent access
- **Metrics**: Operations per second, response times
- **Thresholds**: 100+ selects/sec, 50+ inserts/sec

## 🚀 Quick Start

### Prerequisites

1. **Install Dependencies**:
   ```bash
   cd performance-testing
   npm install
   ```

2. **Start Services**:
   ```bash
   # Backend (Terminal 1)
   cd backend
   npm start

   # Frontend (Terminal 2) - for Lighthouse tests
   cd frontend
   npm start
   ```

3. **Set Environment Variables** (optional):
   ```bash
   export API_URL=http://localhost:5000
   export FRONTEND_URL=http://localhost:3000
   ```

### Running Tests

#### Run All Tests
```bash
node run-performance-tests.js --all --report
```

#### Run Specific Test Types
```bash
# Load testing only
node run-performance-tests.js --load

# Stress testing only
node run-performance-tests.js --stress

# Frontend performance only
node run-performance-tests.js --lighthouse

# Database performance only
node run-performance-tests.js --db
```

#### Individual Artillery Tests
```bash
# Load test with custom target
artillery run --target http://localhost:5000 load-tests/api-load-test.yml

# Generate detailed report
artillery run --output results.json load-tests/api-load-test.yml
artillery report results.json --output report.html
```

## 📊 Understanding Results

### Artillery Metrics

- **Response Time**: 
  - p95 < 2000ms (95% of requests under 2s)
  - p99 < 5000ms (99% of requests under 5s)
- **Request Rate**: Requests per second
- **Success Rate**: Percentage of successful responses (2xx status codes)
- **Error Rate**: Percentage of failed responses (4xx/5xx status codes)

### Lighthouse Metrics

- **Performance Score**: Overall performance rating (0-100)
- **First Contentful Paint (FCP)**: Time to first content render
- **Largest Contentful Paint (LCP)**: Time to largest content render
- **Cumulative Layout Shift (CLS)**: Visual stability metric
- **Total Blocking Time (TBT)**: Main thread blocking time

### Database Metrics

- **Operations per Second**: Throughput for different operation types
- **Average Response Time**: Mean time per operation
- **Concurrent Performance**: Performance under concurrent load
- **Connection Performance**: Database connection establishment time

## 📈 Performance Thresholds

### Load Test Thresholds
```yaml
http.response_time.p95: 2000ms    # 95% under 2s (Requirement 1.1)
http.response_time.p99: 5000ms    # 99% under 5s
http.request_rate: 50             # Min 50 req/sec
http.codes.200: 95%               # 95% success rate
http.codes.5xx: 1%                # Max 1% server errors
```

### Lighthouse Thresholds
```javascript
'categories:performance': 0.8      // Performance score > 80%
'first-contentful-paint': 2000     // FCP < 2s
'largest-contentful-paint': 4000   // LCP < 4s
'cumulative-layout-shift': 0.1     // CLS < 0.1
'total-blocking-time': 300         // TBT < 300ms
```

### Database Thresholds
- **SELECT Performance**: > 100 queries/second
- **INSERT Performance**: > 50 inserts/second
- **Concurrent Operations**: > 100 operations/second
- **Connection Time**: < 100ms

## 🔧 Configuration

### Artillery Configuration
Edit `load-tests/*.yml` files to customize:
- Target URL
- Load phases (duration, arrival rate)
- Test scenarios and weights
- Performance thresholds

### Lighthouse Configuration
Edit `lighthouserc.js` to customize:
- URLs to test
- Performance thresholds
- Audit categories
- Chrome flags

### Database Configuration
Edit `db-performance/db-performance-test.js` to customize:
- Connection parameters
- Test iterations
- Query complexity
- Concurrent connections

## 📁 Output Files

After running tests, you'll find:

```
performance-testing/
├── load-test-results.json          # Raw Artillery results
├── load-test-report.html           # Artillery HTML report
├── stress-test-results.json        # Stress test results
├── stress-test-report.html         # Stress test HTML report
├── lighthouse-reports/             # Lighthouse CI reports
├── performance-test-report.json    # Comprehensive results
└── performance-test-report.html    # Summary HTML report
```

## 🚨 Troubleshooting

### Common Issues

1. **Services Not Running**:
   ```bash
   # Check if services are accessible
   curl http://localhost:5000/health
   curl http://localhost:3000
   ```

2. **High Error Rates**:
   - Check server logs for errors
   - Verify database connectivity
   - Ensure sufficient system resources

3. **Slow Response Times**:
   - Monitor system resources (CPU, memory)
   - Check database performance
   - Verify network connectivity

4. **Artillery Installation Issues**:
   ```bash
   # Install globally if needed
   npm install -g artillery
   
   # Or use npx
   npx artillery run load-tests/api-load-test.yml
   ```

### Performance Optimization Tips

1. **Database Optimization**:
   - Add indexes for frequently queried columns
   - Optimize query performance
   - Use connection pooling

2. **Application Optimization**:
   - Enable response compression
   - Implement caching strategies
   - Optimize API endpoints

3. **Infrastructure Optimization**:
   - Configure auto-scaling
   - Use load balancers
   - Implement CDN for static assets

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd performance-testing
          npm install
      
      - name: Start services
        run: |
          docker-compose up -d
          sleep 30
      
      - name: Run performance tests
        run: |
          cd performance-testing
          node run-performance-tests.js --load --report
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: performance-testing/*.html
```

## 📚 Additional Resources

- [Artillery.js Documentation](https://artillery.io/docs/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Performance Testing Best Practices](https://artillery.io/docs/guides/guides/test-script-examples.html)
- [Web Performance Metrics](https://web.dev/metrics/)

## 🤝 Contributing

When adding new performance tests:

1. Follow the existing naming conventions
2. Include appropriate thresholds based on requirements
3. Add documentation for new test scenarios
4. Update this README with new test descriptions
5. Ensure tests are deterministic and repeatable

## 📄 License

This performance testing suite is part of the DhakaCart project and follows the same license terms.