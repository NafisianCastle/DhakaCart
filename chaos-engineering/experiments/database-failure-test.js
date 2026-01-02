const axios = require('axios');

class DatabaseFailureExperiment {
    constructor(k8sApi, config, logger) {
        this.k8sApi = k8sApi;
        this.config = config;
        this.logger = logger;
    }

    async run() {
        const startTime = Date.now();

        try {
            this.logger.info('🗄️ Starting Database Failure Experiment', {
                namespace: this.config.namespace,
                duration: this.config.experimentDuration
            });

            // Step 1: Validate initial database connectivity
            await this.validateDatabaseConnectivity();

            // Step 2: Start monitoring application behavior
            const healthMonitor = this.startHealthMonitoring();

            // Step 3: Simulate database failure
            const failureResult = await this.simulateDatabaseFailure();

            // Step 4: Monitor application resilience during failure
            await this.monitorDuringFailure();

            // Step 5: Restore database connectivity
            await this.restoreDatabaseConnectivity(failureResult);

            // Step 6: Monitor recovery
            await this.monitorRecovery();

            // Step 7: Stop monitoring and collect metrics
            const healthMetrics = await this.stopHealthMonitoring(healthMonitor);

            const duration = Date.now() - startTime;

            return {
                success: true,
                duration: duration,
                timestamp: new Date().toISOString(),
                metrics: {
                    failureResult: failureResult,
                    healthMetrics: healthMetrics,
                    failureDuration: this.config.experimentDuration
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            this.logger.error('❌ Database Failure Experiment failed', {
                error: error.message,
                duration: duration
            });

            return {
                success: false,
                duration: duration,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    async validateDatabaseConnectivity() {
        try {
            // Test database-dependent endpoint
            const response = await axios.get(`${this.config.apiUrl}/api/products`, { timeout: 5000 });

            if (response.status !== 200) {
                throw new Error(`Database connectivity test failed: ${response.status}`);
            }

            this.logger.info('✅ Initial database connectivity validated');
            return true;

        } catch (error) {
            throw new Error(`Database connectivity validation failed: ${error.message}`);
        }
    }

    async simulateDatabaseFailure() {
        this.logger.info('💀 Simulating database failure...');

        try {
            // Method 1: Try to scale down database pods (if running in Kubernetes)
            const dbScaleResult = await this.scaleDatabasePods(0);

            if (dbScaleResult.success) {
                return {
                    method: 'pod-scaling',
                    success: true,
                    details: dbScaleResult
                };
            }

            // Method 2: Use network policy to block database access
            const networkBlockResult = await this.blockDatabaseNetwork();

            if (networkBlockResult.success) {
                return {
                    method: 'network-blocking',
                    success: true,
                    details: networkBlockResult
                };
            }

            // Method 3: Simulate by overloading database with connections
            const overloadResult = await this.overloadDatabase();

            return {
                method: 'connection-overload',
                success: overloadResult.success,
                details: overloadResult
            };

        } catch (error) {
            this.logger.error('❌ Failed to simulate database failure', { error: error.message });

            return {
                method: 'simulation-failed',
                success: false,
                error: error.message
            };
        }
    }

    async scaleDatabasePods(replicas) {
        try {
            const k8s = require('@kubernetes/client-node');
            const appsV1Api = this.k8sApi.kc?.makeApiClient(k8s.AppsV1Api);

            // Look for database deployments
            const deployments = await appsV1Api.listNamespacedDeployment(this.config.namespace);
            const dbDeployments = deployments.body.items.filter(deployment =>
                deployment.metadata.name.includes('postgres') ||
                deployment.metadata.name.includes('database') ||
                deployment.metadata.name.includes('db')
            );

            if (dbDeployments.length === 0) {
                return { success: false, reason: 'No database deployments found' };
            }

            const scalingResults = [];

            for (const deployment of dbDeployments) {
                const originalReplicas = deployment.spec.replicas;

                // Scale deployment
                const patchBody = {
                    spec: {
                        replicas: replicas
                    }
                };

                await appsV1Api.patchNamespacedDeployment(
                    deployment.metadata.name,
                    this.config.namespace,
                    patchBody,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    { headers: { 'Content-Type': 'application/merge-patch+json' } }
                );

                scalingResults.push({
                    deploymentName: deployment.metadata.name,
                    originalReplicas: originalReplicas,
                    newReplicas: replicas,
                    timestamp: new Date().toISOString()
                });

                this.logger.info('📉 Database deployment scaled', {
                    deployment: deployment.metadata.name,
                    from: originalReplicas,
                    to: replicas
                });
            }

            // Wait for scaling to take effect
            await this.sleep(30000);

            return {
                success: true,
                scalingResults: scalingResults
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async blockDatabaseNetwork() {
        try {
            const k8s = require('@kubernetes/client-node');
            const networkingV1Api = this.k8sApi.kc?.makeApiClient(k8s.NetworkingV1Api);

            const networkPolicyName = `chaos-db-block-${Date.now()}`;

            const networkPolicy = {
                apiVersion: 'networking.k8s.io/v1',
                kind: 'NetworkPolicy',
                metadata: {
                    name: networkPolicyName,
                    namespace: this.config.namespace,
                    labels: {
                        'chaos-experiment': 'database-failure',
                        'created-by': 'dhakacart-chaos-engineering'
                    }
                },
                spec: {
                    podSelector: {
                        matchLabels: {
                            app: 'dhakacart-backend'
                        }
                    },
                    policyTypes: ['Egress'],
                    egress: [
                        {
                            // Block egress to database port
                            to: [],
                            ports: [
                                {
                                    protocol: 'TCP',
                                    port: 5432
                                }
                            ]
                        },
                        {
                            // Allow other egress traffic
                            to: [{}],
                            ports: [
                                {
                                    protocol: 'TCP',
                                    port: 80
                                },
                                {
                                    protocol: 'TCP',
                                    port: 443
                                },
                                {
                                    protocol: 'TCP',
                                    port: 6379
                                }
                            ]
                        }
                    ]
                }
            };

            await networkingV1Api.createNamespacedNetworkPolicy(
                this.config.namespace,
                networkPolicy
            );

            this.logger.info('🚧 Database network access blocked', {
                policyName: networkPolicyName
            });

            return {
                success: true,
                policyName: networkPolicyName,
                method: 'network-policy'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async overloadDatabase() {
        // Simulate database overload by creating many connections
        this.logger.info('⚡ Simulating database overload...');

        const connections = [];
        const maxConnections = 50;

        try {
            // Create multiple concurrent requests to exhaust database connections
            for (let i = 0; i < maxConnections; i++) {
                const connectionPromise = this.createSlowDatabaseRequest(i);
                connections.push(connectionPromise);
            }

            // Don't wait for all to complete, just start them
            setTimeout(() => {
                this.logger.info('🔥 Database overload simulation started', {
                    connections: maxConnections
                });
            }, 1000);

            return {
                success: true,
                connections: maxConnections,
                method: 'connection-overload'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createSlowDatabaseRequest(index) {
        try {
            // Create a slow request that holds database connections
            await axios.get(`${this.config.apiUrl}/api/products?slow=true&connection=${index}`, {
                timeout: this.config.experimentDuration * 1000
            });
        } catch (error) {
            // Expected to fail or timeout
            this.logger.debug('Slow database request completed/failed', { index, error: error.message });
        }
    }

    startHealthMonitoring() {
        const metrics = {
            healthChecks: [],
            databaseChecks: [],
            errors: [],
            startTime: Date.now()
        };

        const interval = setInterval(async () => {
            try {
                // Test general health endpoint
                const healthStart = Date.now();
                const healthResponse = await axios.get(`${this.config.apiUrl}/health`, { timeout: 3000 });
                const healthDuration = Date.now() - healthStart;

                metrics.healthChecks.push({
                    timestamp: Date.now(),
                    duration: healthDuration,
                    status: healthResponse.status,
                    success: true
                });

                // Test database-dependent endpoint
                try {
                    const dbStart = Date.now();
                    const dbResponse = await axios.get(`${this.config.apiUrl}/api/products`, { timeout: 3000 });
                    const dbDuration = Date.now() - dbStart;

                    metrics.databaseChecks.push({
                        timestamp: Date.now(),
                        duration: dbDuration,
                        status: dbResponse.status,
                        success: true
                    });

                } catch (dbError) {
                    metrics.databaseChecks.push({
                        timestamp: Date.now(),
                        error: dbError.message,
                        success: false
                    });
                }

            } catch (error) {
                metrics.errors.push({
                    timestamp: Date.now(),
                    error: error.message,
                    endpoint: '/health'
                });
            }
        }, 3000); // Check every 3 seconds

        return { interval, metrics };
    }

    async monitorDuringFailure() {
        this.logger.info('👀 Monitoring application behavior during database failure...');

        // Wait for the failure to take effect and monitor for a portion of the experiment
        const monitorDuration = Math.min(this.config.experimentDuration * 0.6, 180); // 60% of experiment or max 3 minutes
        await this.sleep(monitorDuration * 1000);
    }

    async restoreDatabaseConnectivity(failureResult) {
        this.logger.info('🔧 Restoring database connectivity...');

        try {
            if (failureResult.method === 'pod-scaling' && failureResult.success) {
                // Restore database pods
                await this.restoreDatabasePods(failureResult.details.scalingResults);
            }

            if (failureResult.method === 'network-blocking' && failureResult.success) {
                // Remove network policy
                await this.removeNetworkPolicy(failureResult.details.policyName);
            }

            if (failureResult.method === 'connection-overload') {
                // Connection overload will naturally resolve when requests timeout
                this.logger.info('⏳ Waiting for connection overload to resolve...');
                await this.sleep(30000);
            }

            this.logger.info('✅ Database connectivity restoration initiated');

        } catch (error) {
            this.logger.error('❌ Failed to restore database connectivity', { error: error.message });
            throw error;
        }
    }

    async restoreDatabasePods(scalingResults) {
        const k8s = require('@kubernetes/client-node');
        const appsV1Api = this.k8sApi.kc?.makeApiClient(k8s.AppsV1Api);

        for (const result of scalingResults) {
            try {
                const patchBody = {
                    spec: {
                        replicas: result.originalReplicas
                    }
                };

                await appsV1Api.patchNamespacedDeployment(
                    result.deploymentName,
                    this.config.namespace,
                    patchBody,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    { headers: { 'Content-Type': 'application/merge-patch+json' } }
                );

                this.logger.info('📈 Database deployment restored', {
                    deployment: result.deploymentName,
                    replicas: result.originalReplicas
                });

            } catch (error) {
                this.logger.error('❌ Failed to restore database deployment', {
                    deployment: result.deploymentName,
                    error: error.message
                });
            }
        }

        // Wait for pods to come back online
        await this.sleep(60000);
    }

    async removeNetworkPolicy(policyName) {
        try {
            const k8s = require('@kubernetes/client-node');
            const networkingV1Api = this.k8sApi.kc?.makeApiClient(k8s.NetworkingV1Api);

            await networkingV1Api.deleteNamespacedNetworkPolicy(
                policyName,
                this.config.namespace
            );

            this.logger.info('🧹 Network policy removed', { policyName });

        } catch (error) {
            this.logger.error('❌ Failed to remove network policy', {
                policyName,
                error: error.message
            });
        }
    }

    async monitorRecovery() {
        const recoveryStart = Date.now();
        const maxWaitTime = 180000; // 3 minutes recovery time
        let recovered = false;

        this.logger.info('⏳ Monitoring database recovery...');

        while (Date.now() - recoveryStart < maxWaitTime && !recovered) {
            try {
                // Test database connectivity recovery
                const response = await axios.get(`${this.config.apiUrl}/api/products`, { timeout: 5000 });

                if (response.status === 200) {
                    recovered = true;
                    const recoveryTime = Date.now() - recoveryStart;

                    this.logger.info('✅ Database recovery successful', {
                        recoveryTime: recoveryTime
                    });

                    // Validate recovery meets requirement (60 seconds - Requirement 5.3)
                    if (recoveryTime > 60000) {
                        this.logger.warn('⚠️ Database recovery time exceeds requirement', {
                            recoveryTime: recoveryTime,
                            requirement: '60 seconds'
                        });
                    }
                }

            } catch (error) {
                // Continue monitoring
                await this.sleep(5000);
            }
        }

        if (!recovered) {
            this.logger.warn('⚠️ Database recovery not detected within timeout');
        }

        return recovered;
    }

    async stopHealthMonitoring(healthMonitor) {
        clearInterval(healthMonitor.interval);

        const totalDuration = Date.now() - healthMonitor.metrics.startTime;
        const healthChecks = healthMonitor.metrics.healthChecks;
        const databaseChecks = healthMonitor.metrics.databaseChecks;

        const healthSuccessRate = healthChecks.length > 0 ?
            (healthChecks.filter(h => h.success).length / healthChecks.length) * 100 : 0;

        const dbSuccessRate = databaseChecks.length > 0 ?
            (databaseChecks.filter(d => d.success).length / databaseChecks.length) * 100 : 0;

        return {
            totalDuration: totalDuration,
            totalHealthChecks: healthChecks.length,
            totalDatabaseChecks: databaseChecks.length,
            healthSuccessRate: healthSuccessRate,
            databaseSuccessRate: dbSuccessRate,
            totalErrors: healthMonitor.metrics.errors.length,
            healthChecks: healthChecks.slice(-10), // Last 10 health checks
            databaseChecks: databaseChecks.slice(-10), // Last 10 database checks
            errors: healthMonitor.metrics.errors
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = DatabaseFailureExperiment;