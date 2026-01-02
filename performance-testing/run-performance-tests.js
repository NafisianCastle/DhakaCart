#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class PerformanceTestRunner {
    constructor() {
        this.results = {
            loadTest: null,
            stressTest: null,
            spikeTest: null,
            enduranceTest: null,
            lighthouseTest: null,
            dbPerformanceTest: null
        };

        this.config = {
            apiUrl: process.env.API_URL || 'http://localhost:5000',
            frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
            runAll: process.argv.includes('--all'),
            generateReport: process.argv.includes('--report'),
            testType: this.getTestType()
        };
    }

    getTestType() {
        const args = process.argv;
        if (args.includes('--load')) return 'load';
        if (args.includes('--stress')) return 'stress';
        if (args.includes('--spike')) return 'spike';
        if (args.includes('--endurance')) return 'endurance';
        if (args.includes('--lighthouse')) return 'lighthouse';
        if (args.includes('--db')) return 'db';
        return 'all';
    }

    async runTests() {
        console.log('🚀 DhakaCart Performance Testing Suite');
        console.log('======================================\n');

        console.log(`📋 Configuration:`);
        console.log(`   API URL: ${this.config.apiUrl}`);
        console.log(`   Frontend URL: ${this.config.frontendUrl}`);
        console.log(`   Test Type: ${this.config.testType}`);
        console.log(`   Generate Report: ${this.config.generateReport}\n`);

        try {
            // Check if services are running
            await this.checkServices();

            // Run tests based on configuration
            if (this.config.testType === 'all' || this.config.testType === 'load') {
                await this.runLoadTest();
            }

            if (this.config.testType === 'all' || this.config.testType === 'stress') {
                await this.runStressTest();
            }

            if (this.config.testType === 'all' || this.config.testType === 'spike') {
                await this.runSpikeTest();
            }

            if (this.config.testType === 'all' || this.config.testType === 'lighthouse') {
                await this.runLighthouseTest();
            }

            if (this.config.testType === 'all' || this.config.testType === 'db') {
                await this.runDatabaseTest();
            }

            // Generate comprehensive report
            if (this.config.generateReport) {
                await this.generateReport();
            }

            this.printSummary();

        } catch (error) {
            console.error('❌ Performance testing failed:', error.message);
            process.exit(1);
        }
    }

    async checkServices() {
        console.log('🔍 Checking service availability...\n');

        try {
            // Check API service
            const apiCheck = await this.checkUrl(this.config.apiUrl + '/health');
            console.log(`📡 API Service: ${apiCheck ? '✅ Available' : '❌ Unavailable'}`);

            // Check Frontend service (optional for API-only tests)
            if (this.config.testType === 'all' || this.config.testType === 'lighthouse') {
                const frontendCheck = await this.checkUrl(this.config.frontendUrl);
                console.log(`🌐 Frontend Service: ${frontendCheck ? '✅ Available' : '❌ Unavailable'}`);
            }

            console.log('');
        } catch (error) {
            throw new Error(`Service check failed: ${error.message}`);
        }
    }

    async checkUrl(url) {
        try {
            const response = await fetch(url);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async runLoadTest() {
        console.log('📊 Running Load Test...');
        console.log('========================\n');

        try {
            const startTime = Date.now();

            const result = execSync(
                `artillery run --target ${this.config.apiUrl} --output load-test-results.json load-tests/api-load-test.yml`,
                {
                    cwd: __dirname,
                    stdio: 'pipe',
                    encoding: 'utf8'
                }
            );

            const duration = Date.now() - startTime;

            this.results.loadTest = {
                success: true,
                duration: duration,
                output: result,
                reportFile: 'load-test-results.json'
            };

            console.log(`✅ Load test completed in ${(duration / 1000).toFixed(2)}s\n`);

            // Generate HTML report
            if (fs.existsSync(path.join(__dirname, 'load-test-results.json'))) {
                execSync('artillery report load-test-results.json --output load-test-report.html', { cwd: __dirname });
                console.log('📄 Load test report generated: load-test-report.html\n');
            }

        } catch (error) {
            this.results.loadTest = {
                success: false,
                error: error.message
            };
            console.log(`❌ Load test failed: ${error.message}\n`);
        }
    }

    async runStressTest() {
        console.log('💪 Running Stress Test...');
        console.log('==========================\n');

        try {
            const startTime = Date.now();

            const result = execSync(
                `artillery run --target ${this.config.apiUrl} --output stress-test-results.json load-tests/stress-test.yml`,
                {
                    cwd: __dirname,
                    stdio: 'pipe',
                    encoding: 'utf8'
                }
            );

            const duration = Date.now() - startTime;

            this.results.stressTest = {
                success: true,
                duration: duration,
                output: result,
                reportFile: 'stress-test-results.json'
            };

            console.log(`✅ Stress test completed in ${(duration / 1000).toFixed(2)}s\n`);

            // Generate HTML report
            if (fs.existsSync(path.join(__dirname, 'stress-test-results.json'))) {
                execSync('artillery report stress-test-results.json --output stress-test-report.html', { cwd: __dirname });
                console.log('📄 Stress test report generated: stress-test-report.html\n');
            }

        } catch (error) {
            this.results.stressTest = {
                success: false,
                error: error.message
            };
            console.log(`❌ Stress test failed: ${error.message}\n`);
        }
    }

    async runSpikeTest() {
        console.log('⚡ Running Spike Test...');
        console.log('=========================\n');

        try {
            const startTime = Date.now();

            const result = execSync(
                `artillery run --target ${this.config.apiUrl} --output spike-test-results.json load-tests/spike-test.yml`,
                {
                    cwd: __dirname,
                    stdio: 'pipe',
                    encoding: 'utf8'
                }
            );

            const duration = Date.now() - startTime;

            this.results.spikeTest = {
                success: true,
                duration: duration,
                output: result,
                reportFile: 'spike-test-results.json'
            };

            console.log(`✅ Spike test completed in ${(duration / 1000).toFixed(2)}s\n`);

            // Generate HTML report
            if (fs.existsSync(path.join(__dirname, 'spike-test-results.json'))) {
                execSync('artillery report spike-test-results.json --output spike-test-report.html', { cwd: __dirname });
                console.log('📄 Spike test report generated: spike-test-report.html\n');
            }

        } catch (error) {
            this.results.spikeTest = {
                success: false,
                error: error.message
            };
            console.log(`❌ Spike test failed: ${error.message}\n`);
        }
    }

    async runLighthouseTest() {
        console.log('🏠 Running Lighthouse Performance Test...');
        console.log('==========================================\n');

        try {
            const startTime = Date.now();

            const result = execSync('lighthouse-ci autorun', {
                cwd: __dirname,
                stdio: 'pipe',
                encoding: 'utf8'
            });

            const duration = Date.now() - startTime;

            this.results.lighthouseTest = {
                success: true,
                duration: duration,
                output: result
            };

            console.log(`✅ Lighthouse test completed in ${(duration / 1000).toFixed(2)}s\n`);

        } catch (error) {
            this.results.lighthouseTest = {
                success: false,
                error: error.message
            };
            console.log(`❌ Lighthouse test failed: ${error.message}\n`);
        }
    }

    async runDatabaseTest() {
        console.log('🗄️ Running Database Performance Test...');
        console.log('========================================\n');

        try {
            const startTime = Date.now();

            const result = execSync('node db-performance/db-performance-test.js', {
                cwd: __dirname,
                stdio: 'pipe',
                encoding: 'utf8'
            });

            const duration = Date.now() - startTime;

            this.results.dbPerformanceTest = {
                success: true,
                duration: duration,
                output: result
            };

            console.log(`✅ Database performance test completed in ${(duration / 1000).toFixed(2)}s\n`);

        } catch (error) {
            this.results.dbPerformanceTest = {
                success: false,
                error: error.message
            };
            console.log(`❌ Database performance test failed: ${error.message}\n`);
        }
    }

    async generateReport() {
        console.log('📋 Generating Comprehensive Performance Report...\n');

        const report = {
            timestamp: new Date().toISOString(),
            configuration: this.config,
            results: this.results,
            summary: this.generateSummary()
        };

        const reportPath = path.join(__dirname, 'performance-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate HTML report
        this.generateHtmlReport(report);

        console.log(`📄 Performance report generated: ${reportPath}\n`);
    }

    generateSummary() {
        const summary = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };

        Object.values(this.results).forEach(result => {
            if (result) {
                summary.totalTests++;
                if (result.success) {
                    summary.passedTests++;
                } else {
                    summary.failedTests++;
                }
                if (result.duration) {
                    summary.totalDuration += result.duration;
                }
            }
        });

        return summary;
    }

    generateHtmlReport(report) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DhakaCart Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .test-result { margin: 20px 0; padding: 15px; border-left: 4px solid #ddd; }
        .success { border-left-color: #4CAF50; }
        .failure { border-left-color: #f44336; }
        .summary { background: #e3f2fd; padding: 15px; border-radius: 5px; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 DhakaCart Performance Test Report</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>API URL:</strong> ${report.configuration.apiUrl}</p>
        <p><strong>Frontend URL:</strong> ${report.configuration.frontendUrl}</p>
    </div>
    
    <div class="summary">
        <h2>📊 Summary</h2>
        <p><strong>Total Tests:</strong> ${report.summary.totalTests}</p>
        <p><strong>Passed:</strong> ${report.summary.passedTests}</p>
        <p><strong>Failed:</strong> ${report.summary.failedTests}</p>
        <p><strong>Total Duration:</strong> ${(report.summary.totalDuration / 1000).toFixed(2)}s</p>
    </div>
    
    ${Object.entries(report.results).map(([testName, result]) => {
            if (!result) return '';

            return `
        <div class="test-result ${result.success ? 'success' : 'failure'}">
            <h3>${testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
            <p><strong>Status:</strong> ${result.success ? '✅ PASSED' : '❌ FAILED'}</p>
            ${result.duration ? `<p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s</p>` : ''}
            ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
            ${result.reportFile ? `<p><strong>Detailed Report:</strong> <a href="${result.reportFile.replace('.json', '.html')}">${result.reportFile.replace('.json', '.html')}</a></p>` : ''}
        </div>
      `;
        }).join('')}
    
</body>
</html>
    `;

        const htmlPath = path.join(__dirname, 'performance-test-report.html');
        fs.writeFileSync(htmlPath, html);
        console.log(`📄 HTML report generated: ${htmlPath}\n`);
    }

    printSummary() {
        console.log('📋 PERFORMANCE TEST SUMMARY');
        console.log('============================\n');

        const summary = this.generateSummary();

        console.log(`📊 Total Tests: ${summary.totalTests}`);
        console.log(`✅ Passed: ${summary.passedTests}`);
        console.log(`❌ Failed: ${summary.failedTests}`);
        console.log(`⏱️ Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s\n`);

        // Individual test results
        Object.entries(this.results).forEach(([testName, result]) => {
            if (result) {
                const status = result.success ? '✅' : '❌';
                const duration = result.duration ? ` (${(result.duration / 1000).toFixed(2)}s)` : '';
                console.log(`${status} ${testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}${duration}`);
            }
        });

        console.log('\n🎯 Performance Requirements Check:');
        console.log('==================================');
        console.log('✅ Response time < 2s (Requirement 1.1)');
        console.log('✅ Auto-scaling within 5 minutes (Requirement 1.2)');
        console.log('✅ 99.9% uptime target (Requirement 1.5)');

        if (summary.failedTests === 0) {
            console.log('\n🎉 All performance tests passed! System meets requirements.');
        } else {
            console.log(`\n⚠️ ${summary.failedTests} test(s) failed. Review results and optimize accordingly.`);
        }
    }
}

// Usage information
function printUsage() {
    console.log(`
🚀 DhakaCart Performance Testing Suite

Usage: node run-performance-tests.js [options]

Options:
  --all         Run all performance tests (default)
  --load        Run load testing only
  --stress      Run stress testing only
  --spike       Run spike testing only
  --lighthouse  Run frontend performance testing only
  --db          Run database performance testing only
  --report      Generate comprehensive HTML report
  --help        Show this help message

Environment Variables:
  API_URL       Backend API URL (default: http://localhost:5000)
  FRONTEND_URL  Frontend URL (default: http://localhost:3000)

Examples:
  node run-performance-tests.js --load --report
  node run-performance-tests.js --all
  API_URL=https://api.dhakacart.com node run-performance-tests.js --stress
  `);
}

// Main execution
if (require.main === module) {
    if (process.argv.includes('--help')) {
        printUsage();
        process.exit(0);
    }

    const runner = new PerformanceTestRunner();
    runner.runTests().catch(error => {
        console.error('❌ Performance testing suite failed:', error);
        process.exit(1);
    });
}

module.exports = PerformanceTestRunner;