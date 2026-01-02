const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class DatabasePerformanceTest {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'dhakacart',
            port: process.env.DB_PORT || 5432,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.results = {
            connectionTest: null,
            insertPerformance: null,
            selectPerformance: null,
            updatePerformance: null,
            deletePerformance: null,
            complexQueryPerformance: null,
            concurrentOperations: null
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Database Performance Tests...\n');

        try {
            await this.testConnection();
            await this.testInsertPerformance();
            await this.testSelectPerformance();
            await this.testUpdatePerformance();
            await this.testDeletePerformance();
            await this.testComplexQueries();
            await this.testConcurrentOperations();

            this.printResults();
        } catch (error) {
            console.error('❌ Database performance test failed:', error);
        } finally {
            await this.pool.end();
        }
    }

    async testConnection() {
        console.log('📡 Testing database connection...');
        const start = Date.now();

        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW()');
            client.release();

            const duration = Date.now() - start;
            this.results.connectionTest = {
                success: true,
                duration: duration,
                timestamp: result.rows[0].now
            };

            console.log(`✅ Connection successful in ${duration}ms\n`);
        } catch (error) {
            this.results.connectionTest = {
                success: false,
                error: error.message,
                duration: Date.now() - start
            };
            console.log(`❌ Connection failed: ${error.message}\n`);
        }
    }

    async testInsertPerformance() {
        console.log('📝 Testing INSERT performance...');
        const iterations = 1000;
        const start = Date.now();

        try {
            const client = await this.pool.connect();

            // Batch insert test
            for (let i = 0; i < iterations; i++) {
                await client.query(
                    'INSERT INTO products (name, price, description, stock_quantity) VALUES ($1, $2, $3, $4)',
                    [`Test Product ${i}`, Math.random() * 1000, `Description ${i}`, Math.floor(Math.random() * 100)]
                );
            }

            client.release();
            const duration = Date.now() - start;

            this.results.insertPerformance = {
                success: true,
                iterations: iterations,
                totalDuration: duration,
                avgDuration: duration / iterations,
                insertsPerSecond: (iterations / duration) * 1000
            };

            console.log(`✅ Inserted ${iterations} records in ${duration}ms (${this.results.insertPerformance.insertsPerSecond.toFixed(2)} inserts/sec)\n`);
        } catch (error) {
            this.results.insertPerformance = {
                success: false,
                error: error.message
            };
            console.log(`❌ Insert test failed: ${error.message}\n`);
        }
    }

    async testSelectPerformance() {
        console.log('🔍 Testing SELECT performance...');
        const iterations = 1000;
        const start = Date.now();

        try {
            const client = await this.pool.connect();

            for (let i = 0; i < iterations; i++) {
                await client.query('SELECT * FROM products LIMIT 10');
            }

            client.release();
            const duration = Date.now() - start;

            this.results.selectPerformance = {
                success: true,
                iterations: iterations,
                totalDuration: duration,
                avgDuration: duration / iterations,
                selectsPerSecond: (iterations / duration) * 1000
            };

            console.log(`✅ Executed ${iterations} SELECT queries in ${duration}ms (${this.results.selectPerformance.selectsPerSecond.toFixed(2)} selects/sec)\n`);
        } catch (error) {
            this.results.selectPerformance = {
                success: false,
                error: error.message
            };
            console.log(`❌ Select test failed: ${error.message}\n`);
        }
    }

    async testUpdatePerformance() {
        console.log('✏️ Testing UPDATE performance...');
        const iterations = 500;
        const start = Date.now();

        try {
            const client = await this.pool.connect();

            for (let i = 0; i < iterations; i++) {
                await client.query(
                    'UPDATE products SET price = $1 WHERE id = $2',
                    [Math.random() * 1000, Math.floor(Math.random() * 100) + 1]
                );
            }

            client.release();
            const duration = Date.now() - start;

            this.results.updatePerformance = {
                success: true,
                iterations: iterations,
                totalDuration: duration,
                avgDuration: duration / iterations,
                updatesPerSecond: (iterations / duration) * 1000
            };

            console.log(`✅ Executed ${iterations} UPDATE queries in ${duration}ms (${this.results.updatePerformance.updatesPerSecond.toFixed(2)} updates/sec)\n`);
        } catch (error) {
            this.results.updatePerformance = {
                success: false,
                error: error.message
            };
            console.log(`❌ Update test failed: ${error.message}\n`);
        }
    }

    async testDeletePerformance() {
        console.log('🗑️ Testing DELETE performance...');
        const iterations = 100;
        const start = Date.now();

        try {
            const client = await this.pool.connect();

            for (let i = 0; i < iterations; i++) {
                await client.query(
                    'DELETE FROM products WHERE name LIKE $1',
                    [`Test Product ${i}`]
                );
            }

            client.release();
            const duration = Date.now() - start;

            this.results.deletePerformance = {
                success: true,
                iterations: iterations,
                totalDuration: duration,
                avgDuration: duration / iterations,
                deletesPerSecond: (iterations / duration) * 1000
            };

            console.log(`✅ Executed ${iterations} DELETE queries in ${duration}ms (${this.results.deletePerformance.deletesPerSecond.toFixed(2)} deletes/sec)\n`);
        } catch (error) {
            this.results.deletePerformance = {
                success: false,
                error: error.message
            };
            console.log(`❌ Delete test failed: ${error.message}\n`);
        }
    }

    async testComplexQueries() {
        console.log('🔬 Testing complex query performance...');
        const iterations = 100;
        const start = Date.now();

        try {
            const client = await this.pool.connect();

            for (let i = 0; i < iterations; i++) {
                // Complex query with joins, aggregations, and sorting
                await client.query(`
          SELECT 
            p.name,
            p.price,
            COUNT(*) as total_products,
            AVG(p.price) as avg_price,
            MAX(p.price) as max_price,
            MIN(p.price) as min_price
          FROM products p
          WHERE p.price > $1
          GROUP BY p.name, p.price
          ORDER BY p.price DESC
          LIMIT 20
        `, [Math.random() * 100]);
            }

            client.release();
            const duration = Date.now() - start;

            this.results.complexQueryPerformance = {
                success: true,
                iterations: iterations,
                totalDuration: duration,
                avgDuration: duration / iterations,
                queriesPerSecond: (iterations / duration) * 1000
            };

            console.log(`✅ Executed ${iterations} complex queries in ${duration}ms (${this.results.complexQueryPerformance.queriesPerSecond.toFixed(2)} queries/sec)\n`);
        } catch (error) {
            this.results.complexQueryPerformance = {
                success: false,
                error: error.message
            };
            console.log(`❌ Complex query test failed: ${error.message}\n`);
        }
    }

    async testConcurrentOperations() {
        console.log('⚡ Testing concurrent operations...');
        const concurrentConnections = 10;
        const operationsPerConnection = 50;
        const start = Date.now();

        try {
            const promises = [];

            for (let i = 0; i < concurrentConnections; i++) {
                promises.push(this.runConcurrentOperations(operationsPerConnection, i));
            }

            await Promise.all(promises);
            const duration = Date.now() - start;

            this.results.concurrentOperations = {
                success: true,
                concurrentConnections: concurrentConnections,
                operationsPerConnection: operationsPerConnection,
                totalOperations: concurrentConnections * operationsPerConnection,
                totalDuration: duration,
                operationsPerSecond: ((concurrentConnections * operationsPerConnection) / duration) * 1000
            };

            console.log(`✅ Executed ${concurrentConnections * operationsPerConnection} concurrent operations in ${duration}ms (${this.results.concurrentOperations.operationsPerSecond.toFixed(2)} ops/sec)\n`);
        } catch (error) {
            this.results.concurrentOperations = {
                success: false,
                error: error.message
            };
            console.log(`❌ Concurrent operations test failed: ${error.message}\n`);
        }
    }

    async runConcurrentOperations(operations, connectionId) {
        const client = await this.pool.connect();

        try {
            for (let i = 0; i < operations; i++) {
                // Mix of different operations
                const operation = i % 4;

                switch (operation) {
                    case 0:
                        await client.query('SELECT * FROM products LIMIT 5');
                        break;
                    case 1:
                        await client.query(
                            'INSERT INTO products (name, price, description, stock_quantity) VALUES ($1, $2, $3, $4)',
                            [`Concurrent Product ${connectionId}-${i}`, Math.random() * 1000, `Concurrent test`, Math.floor(Math.random() * 100)]
                        );
                        break;
                    case 2:
                        await client.query(
                            'UPDATE products SET price = $1 WHERE id = $2',
                            [Math.random() * 1000, Math.floor(Math.random() * 100) + 1]
                        );
                        break;
                    case 3:
                        await client.query('SELECT COUNT(*) FROM products');
                        break;
                }
            }
        } finally {
            client.release();
        }
    }

    printResults() {
        console.log('📊 DATABASE PERFORMANCE TEST RESULTS');
        console.log('=====================================\n');

        Object.entries(this.results).forEach(([testName, result]) => {
            if (result) {
                console.log(`${testName.toUpperCase()}:`);
                if (result.success) {
                    console.log(`  ✅ Status: PASSED`);
                    Object.entries(result).forEach(([key, value]) => {
                        if (key !== 'success') {
                            console.log(`  📈 ${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
                        }
                    });
                } else {
                    console.log(`  ❌ Status: FAILED`);
                    console.log(`  🚨 Error: ${result.error}`);
                }
                console.log('');
            }
        });

        // Performance summary
        console.log('PERFORMANCE SUMMARY:');
        console.log('===================');

        if (this.results.selectPerformance?.success) {
            const selectsPerSec = this.results.selectPerformance.selectsPerSecond;
            console.log(`📊 SELECT Performance: ${selectsPerSec.toFixed(2)} queries/sec ${selectsPerSec > 100 ? '✅' : '⚠️'}`);
        }

        if (this.results.insertPerformance?.success) {
            const insertsPerSec = this.results.insertPerformance.insertsPerSecond;
            console.log(`📊 INSERT Performance: ${insertsPerSec.toFixed(2)} inserts/sec ${insertsPerSec > 50 ? '✅' : '⚠️'}`);
        }

        if (this.results.concurrentOperations?.success) {
            const concurrentOpsPerSec = this.results.concurrentOperations.operationsPerSecond;
            console.log(`📊 Concurrent Performance: ${concurrentOpsPerSec.toFixed(2)} ops/sec ${concurrentOpsPerSec > 100 ? '✅' : '⚠️'}`);
        }
    }
}

// Run the tests
if (require.main === module) {
    const dbTest = new DatabasePerformanceTest();
    dbTest.runAllTests().catch(console.error);
}

module.exports = DatabasePerformanceTest;