const axios = require('axios');

class ResourceExhaustionExperiment {
    constructor(k8sApi, appsV1Api, config, logger) {
        this.k8sApi = k8sApi;
        this.appsV1Api = appsV1Api;
        this.config = config;
        this.logger = logger;
    }

    async run() {
        const startTime = Date.now();

        try {
            this.logger.info('💾 Starting Resource Exhaustion Experiment', {
                namespace: this.config.namespace,
                duration: this.config.experimentDuration
            });

            // Step 1: Get baseline resource usage
            const baselineMetrics = await this.getResourceMetrics();

            // Step 2: Deploy resource-hungry pods
            const stressPods = await this.deployStressPods();

            // Step 3: Monitor system behavior under stress
            const stressMonitor = this.startStressMonitoring();

            // Step 4: Monitor auto-scaling response
            const scalingResults = await this.monitorAutoScaling();

            // Step 5: Wait for experiment duration
            await this.sleep(this.config.experimentDuration * 1000);

            // Step 6: Clean up stress pods
            await this.cleanupStressPods(stressPods);

            // Step 7: Monitor recovery
            await this.monitorRecovery();

            // Step 8: Stop monitoring and collect final metrics
            const finalMetrics = await this.stopStressMonitoring(stressMonitor);

            const duration = Date.now() - startTime;

            return {
                success: true,
                duration: duration,
                timestamp: new Date().toISOString(),
                metrics: {
                    baselineMetrics: baselineMetrics,
                    stressPods: stressPods.length,
                    scalingResults: scalingResults,
                    finalMetrics: finalMetrics
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            this.logger.error('❌ Resource Exhaustion Experiment failed', {
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

    async getResourceMetrics() {
        try {
            const pods = await this.k8sApi.listNamespacedPod(this.config.namespace);
            const runningPods = pods.body.items.filter(p => p.status.phase === 'Running');

            // Get node information
            const nodes = await this.k8sApi.listNode();

            return {
                totalPods: pods.body.items.length,
                runningPods: runningPods.length,
                totalNodes: nodes.body.items.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.warn('⚠️ Could not get baseline metrics', { error: error.message });
            return { error: error.message };
        }
    }

    async deployStressPods() {
        const stressPods = [];
        const numberOfStressPods = 3;

        for (let i = 0; i < numberOfStressPods; i++) {
            const stressPodName = `chaos-stress-pod-${Date.now()}-${i}`;

            const stressPod = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: {
                    name: stressPodName,
                    namespace: this.config.namespace,
                    labels: {
                        'chaos-experiment': 'resource-exhaustion',
                        'created-by': 'dhakacart-chaos-engineering'
                    }
                },
                spec: {
                    containers: [
                        {
                            name: 'cpu-stress',
                            image: 'progrium/stress',
                            command: ['stress'],
                            args: [
                                '--cpu', '2',      // Stress 2 CPU cores
                                '--io', '1',       // Stress I/O
                                '--vm', '1',       // Stress memory
                                '--vm-bytes', '512M', // Use 512MB memory
                                '--timeout', `${this.config.experimentDuration}s`
                            ],
                            resources: {
                                requests: {
                                    cpu: '500m',
                                    memory: '256Mi'
                                },
                                limits: {
                                    cpu: '2000m',    // 2 CPU cores
                                    memory: '1Gi'    // 1GB memory
                                }
                            }
                        }
                    ],
                    restartPolicy: 'Never'
                }
            };

            try {
                this.logger.info('🚀 Deploying stress pod', { podName: stressPodName });

                const response = await this.k8sApi.createNamespacedPod(
                    this.config.namespace,
                    stressPod
                );

                stressPods.push({
                    name: stressPodName,
                    created: true,
                    timestamp: new Date().toISOString()
                });

                this.logger.info('✅ Stress pod deployed', { podName: stressPodName });

            } catch (error) {
                this.logger.error('❌ Failed to deploy stress pod', {
                    podName: stressPodName,
                    error: error.message
                });

                stressPods.push({
                    name: stressPodName,
                    created: false,
                    error: error.message
                });
            }
        }

        // Wait for pods to start
        await this.sleep(10000);

        return stressPods;
    }

    startStressMonitoring() {
        const metrics = {
            resourceUsage: [],
            applicationHealth: [],
            podCounts: [],
            startTime: Date.now()
        };

        const interval = setInterval(async () => {
            try {
                // Monitor pod counts
                const pods = await this.k8sApi.listNamespacedPod(this.config.namespace);
                const runningPods = pods.body.items.filter(p => p.status.phase === 'Running');
                const pendingPods = pods.body.items.filter(p => p.status.phase === 'Pending');

                metrics.podCounts.push({
                    timestamp: Date.now(),
                    total: pods.body.items.length,
                    running: runningPods.length,
                    pending: pendingPods.length
                });

                // Monitor application health
                try {
                    const start = Date.now();
                    const response = await axios.get(`${this.config.apiUrl}/health`, { timeout: 3000 });
                    const duration = Date.now() - start;

                    metrics.applicationHealth.push({
                        timestamp: Date.now(),
                        duration: duration,
                        status: response.status,
                        success: true
                    });

                } catch (healthError) {
                    metrics.applicationHealth.push({
                        timestamp: Date.now(),
                        error: healthError.message,
                        success: false
                    });
                }

            } catch (error) {
                this.logger.debug('Monitoring error', { error: error.message });
            }
        }, 5000); // Check every 5 seconds

        return { interval, metrics };
    }

    async monitorAutoScaling() {
        const scalingResults = {
            initialReplicas: {},
            finalReplicas: {},
            scalingEvents: []
        };

        try {
            // Get initial replica counts
            const deployments = await this.appsV1Api.listNamespacedDeployment(this.config.namespace);

            for (const deployment of deployments.body.items) {
                scalingResults.initialReplicas[deployment.metadata.name] = deployment.spec.replicas;
            }

            this.logger.info('📊 Initial replica counts', scalingResults.initialReplicas);

            // Monitor for scaling events over the experiment duration
            const monitoringDuration = Math.min(this.config.experimentDuration, 300); // Max 5 minutes
            const checkInterval = 15000; // Check every 15 seconds
            const checks = Math.floor(monitoringDuration * 1000 / checkInterval);

            for (let i = 0; i < checks; i++) {
                await this.sleep(checkInterval);

                try {
                    const currentDeployments = await this.appsV1Api.listNamespacedDeployment(this.config.namespace);

                    for (const deployment of currentDeployments.body.items) {
                        const currentReplicas = deployment.spec.replicas;
                        const initialReplicas = scalingResults.initialReplicas[deployment.metadata.name];

                        if (currentReplicas !== initialReplicas) {
                            scalingResults.scalingEvents.push({
                                timestamp: new Date().toISOString(),
                                deploymentName: deployment.metadata.name,
                                fromReplicas: initialReplicas,
                                toReplicas: currentReplicas,
                                scalingDirection: currentReplicas > initialReplicas ? 'up' : 'down'
                            });

                            this.logger.info('📈 Scaling event detected', {
                                deployment: deployment.metadata.name,
                                from: initialReplicas,
                                to: currentReplicas
                            });

                            // Update the baseline for future comparisons
                            scalingResults.initialReplicas[deployment.metadata.name] = currentReplicas;
                        }
                    }

                } catch (error) {
                    this.logger.debug('Scaling monitoring error', { error: error.message });
                }
            }

            // Get final replica counts
            const finalDeployments = await this.appsV1Api.listNamespacedDeployment(this.config.namespace);
            for (const deployment of finalDeployments.body.items) {
                scalingResults.finalReplicas[deployment.metadata.name] = deployment.spec.replicas;
            }

            this.logger.info('📊 Final replica counts', scalingResults.finalReplicas);

        } catch (error) {
            this.logger.error('❌ Auto-scaling monitoring failed', { error: error.message });
            scalingResults.error = error.message;
        }

        return scalingResults;
    }

    async cleanupStressPods(stressPods) {
        this.logger.info('🧹 Cleaning up stress pods...');

        for (const stressPod of stressPods) {
            if (stressPod.created) {
                try {
                    await this.k8sApi.deleteNamespacedPod(
                        stressPod.name,
                        this.config.namespace,
                        undefined,
                        undefined,
                        0 // Immediate deletion
                    );

                    this.logger.info('✅ Stress pod cleaned up', { podName: stressPod.name });

                } catch (error) {
                    this.logger.warn('⚠️ Failed to cleanup stress pod', {
                        podName: stressPod.name,
                        error: error.message
                    });
                }
            }
        }

        // Wait for cleanup to complete
        await this.sleep(10000);
    }

    async monitorRecovery() {
        const recoveryStart = Date.now();
        const maxWaitTime = 120000; // 2 minutes recovery time
        let recovered = false;

        this.logger.info('⏳ Monitoring system recovery...');

        while (Date.now() - recoveryStart < maxWaitTime && !recovered) {
            try {
                // Check application health
                const response = await axios.get(`${this.config.apiUrl}/health`, { timeout: 5000 });

                // Check resource usage is back to normal
                const pods = await this.k8sApi.listNamespacedPod(this.config.namespace);
                const stressPods = pods.body.items.filter(pod =>
                    pod.metadata.labels?.['chaos-experiment'] === 'resource-exhaustion'
                );

                if (response.status === 200 && stressPods.length === 0) {
                    recovered = true;
                    const recoveryTime = Date.now() - recoveryStart;

                    this.logger.info('✅ System recovery successful', {
                        recoveryTime: recoveryTime
                    });
                }

            } catch (error) {
                // Continue monitoring
                await this.sleep(5000);
            }
        }

        if (!recovered) {
            this.logger.warn('⚠️ System recovery not detected within timeout');
        }

        return recovered;
    }

    async stopStressMonitoring(stressMonitor) {
        clearInterval(stressMonitor.interval);

        const totalDuration = Date.now() - stressMonitor.metrics.startTime;
        const healthChecks = stressMonitor.metrics.applicationHealth;
        const successfulHealthChecks = healthChecks.filter(h => h.success);

        const healthSuccessRate = healthChecks.length > 0 ?
            (successfulHealthChecks.length / healthChecks.length) * 100 : 0;

        const avgResponseTime = successfulHealthChecks.length > 0 ?
            successfulHealthChecks.reduce((sum, h) => sum + h.duration, 0) / successfulHealthChecks.length : 0;

        return {
            totalDuration: totalDuration,
            totalHealthChecks: healthChecks.length,
            healthSuccessRate: healthSuccessRate,
            avgResponseTime: avgResponseTime,
            podCounts: stressMonitor.metrics.podCounts.slice(-5), // Last 5 measurements
            applicationHealth: stressMonitor.metrics.applicationHealth.slice(-10) // Last 10 health checks
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ResourceExhaustionExperiment;