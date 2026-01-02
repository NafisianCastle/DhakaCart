module.exports = {
    ci: {
        collect: {
            url: [
                'http://localhost:3000',
                'http://localhost:3000/products',
                'http://localhost:3000/products/1'
            ],
            startServerCommand: 'npm run start',
            startServerReadyPattern: 'webpack compiled',
            startServerReadyTimeout: 30000,
            numberOfRuns: 3,
            settings: {
                chromeFlags: '--no-sandbox --headless',
                preset: 'desktop',
                onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
                skipAudits: ['uses-http2']
            }
        },
        assert: {
            assertions: {
                // Performance thresholds
                'categories:performance': ['error', { minScore: 0.8 }],
                'categories:accessibility': ['error', { minScore: 0.9 }],
                'categories:best-practices': ['error', { minScore: 0.8 }],
                'categories:seo': ['error', { minScore: 0.8 }],

                // Core Web Vitals
                'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
                'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
                'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
                'total-blocking-time': ['error', { maxNumericValue: 300 }],

                // Other performance metrics
                'speed-index': ['error', { maxNumericValue: 4000 }],
                'interactive': ['error', { maxNumericValue: 5000 }],
                'max-potential-fid': ['error', { maxNumericValue: 130 }]
            }
        },
        upload: {
            target: 'temporary-public-storage'
        },
        server: {
            port: 9001,
            storage: './lighthouse-reports'
        }
    }
};