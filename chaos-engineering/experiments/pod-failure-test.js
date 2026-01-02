const axios = require('axios');

class PodFailureExperiment {
    constructor(k8sApi, config, logger) {
        this.k8sApi = k8sApi;
        this.config = config;
        this.logger = logger;
    }

    async run() {
        const startTime = Date.now();

        try {
            this.logger.info('💥 Starting Pod Failure Experiment', {
                namespace: this.config.namespace,
                duration: this.config.experimentDuration
            });

            // Step 1: Get current pods
            const initialPods = await this.getCurrentPods();
            this.logger.info('📊 Initial pod state', {
                totalPods: initialPods.length,
                runningPods: initialPods.filter(p => p.status.phase === 'Running').length
            });

            // Step 2: Validate initial application health
            await this.validateApplicationHealth();

            // Step 3: Select target pods for failure
            const targetPods = this.selectTargetPods(initialPods);
            this.logger.info('🎯 Selected target pods for failure', {
                targetPods: targetPods.map(p => p.metadata.name)
            });

            // Step 4: Start monitoring application health
            const healthMonitor = this.startHealthMonitoring();

            // Step 5: Execute pod failures
            const failureResults = await this.executePodFailures(targetPods);

            // Step 6: Monitor recovery
            const recoveryResults = await this.monitorRecovery(targetPods);

            // Step 7: Stop health monitoring and collect metrics
            const healthMetrics = await this.stopHealthMonitoring(healthMonitor);

            // Step 8: Validate final state
            await this.validateFinalState();

            const duration = Date.now() - startTime;

            return {
                success: true,
                duration: duration,
                timestamp: new Date().toISOString(),
                metrics: {
                    initialPods: initialPods.length,
                    targetPods: targetPods.length,
                    failureResults: failureResults,
                    recoveryResults: recoveryResults,
                    healthMetrics: healthMetrics
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            this.logger.error('❌ Pod Failure Experiment failed', {
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

    async getCurrentPods() {
        const response = await this.k8sApi.listNamespacedPod(this.config.namespace);
        return response.body.items;
    }

    async validateApplicationHealth() {
        const response = await axios.get(`${this.config.apiUrl}/health`, { timeout: 5000 });
        if (response.status !== 200) {
            throw new Error(`Application health check failed: ${response.status}`);
        }
        return response.data;
    }

    selectTargetPods(pods) {
        // Select backend pods for failure (avoid killing all instances)
        const backendPods = pods.filter(pod =>
            pod.metadata.name.includes('backend') &&
            pod.status.phase === 'Running'
        );

        // Select 1 pod for failure (to test resilience, not cause total outage)
        return backendPods.slice(0, 1);
    }

    startHealthMonitoring() {
        const metrics = {
            requests: [],
            errors: [],
            startTime: Date.now()
        };

        const interval = setInterval(async () => {
            try {
                const start = Date.now();
                const response = await axios.get(`${this.config.apiUrl}/health`, { timeout: 2000 });
                const duration = Date.now() - start;

                metrics.requests.push({
                    timestamp: Date.now(),
                    duration: duration,
                    status: response.status,
                    success: true
                });

            } catch (error) {
                metrics.errors.push({
                    timestamp: Date.now(),
                    error: error.message,
                    success: false
                });
            }
        }, 1000); // Check every second

        return { interval, metrics };
    }

    async executePodFailures(targetPods) {
        const results = [];

        for (const pod of targetPods) {
            try {
                this.logger.info('💀 Terminating pod', { podName: pod.metadata.name });

                const deleteStart = Date.now();
                await this.k8sApi.deleteNamespacedPod(
                    pod.metadata.name,
                    this.config.namespace,
                    undefined,
                    undefined,
                    0 // Immediate termination
                );

                const deleteTime = Date.now() - deleteStart;

                results.push({
                    podName: pod.metadata.name,
                    success: true,
                    deleteTime: deleteTime,
                    timestamp: new Date().toISOString()
                });

                this.logger.info('✅ Pod terminated successfully', {
                    podName: pod.metadata.name,
                    deleteTime: deleteTime
                });

            } catch (error) {
                results.push({
                    podName: pod.metadata.name,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });

                this.logger.error('❌ Failed to terminate pod', {
                    podName: pod.metadata.name,
                    error: error.message
                });
            }
        }

        return results;
    }

    async monitorRecovery(targetPods) {
        const recoveryResults = [];
        const maxWaitTime = this.config.recoveryTimeout * 1000; // Convert to milliseconds

        for (const originalPod of targetPods) {
            const recoveryStart = Date.now();
            let recovered = false;
            let newPodName = null;

            this.logger.info('⏳ Monitoring recovery for pod', {
                originalPod: originalPod.metadata.name
            });

            while (Date.now() - recoveryStart < maxWaitTime && !recovered) {
                try {
                    const currentPods = await this.getCurrentPods();

                    // Look for new pod with same labels/selector
                    const newPod = currentPods.find(pod =>
                        pod.metadata.name !== originalPod.metadata.name &&
                        pod.metadata.labels?.app === originalPod.metadata.labels?.app &&
                        pod.status.phase === 'Running'
                    );

                    if (newPod) {
                        recovered = true;
                        newPodName = newPod.metadata.name;

                        // Validate the new pod is actually healthy
                        await this.validateApplicationHealth();
                    }

                } catch (error) {
                    // Continue monitoring even if health check fails temporarily
                    this.logger.debug('Health check failed during recovery monitoring', {
                        error: error.message
                    });
                }

                if (!recovered) {
                    await this.sleep(2000); // Wait 2 seconds before next check
                }
            }

            const recoveryTime = Date.now() - recoveryStart;

            recoveryResults.push({
                originalPod: originalPod.metadata.name,
                newPod: newPodName,
                recovered: recovered,
                recoveryTime: recoveryTime,
                timestamp: new Date().toISOString()
            });

            this.logger.info(recovered ? '✅ Pod recovery successful' : '❌ Pod recovery failed', {
                originalPod: originalPod.metadata.name,
                newPod: newPodName,
                recoveryTime: recoveryTime,
                recovered: recovered
            });

            // Validate recovery meets requirement (30 seconds - Requirement 1.4)
            if (recovered && recoveryTime > 30000) {
                this.logger.warn('⚠️ Recovery time exceeds requirement', {
                    recoveryTime: recoveryTime,
                    requirement: '30 seconds',
                    originalPod: originalPod.metadata.name
                });
            }
        }

        return recoveryResults;
    }

    async stopHealthMonitoring(healthMonitor) {
        clearInterval(healthMonitor.interval);

        const totalDuration = Date.now() - healthMonitor.metrics.startTime;
        const totalRequests = healthMonitor.metrics.requests.length;
        const totalErrors = healthMonitor.metrics.errors.length;
        const successRate = totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0;

        const avgResponseTime = totalRequests > 0
            ? healthMonitor.metrics.requests.reduce((sum, req) => sum + req.duration, 0) / totalRequests
            : 0;

        return {
            totalDuration: totalDuration,
            totalRequests: totalRequests,
            totalErrors: totalErrors,
            successRate: successRate,
            avgResponseTime: avgResponseTime,
            requests: healthMonitor.metrics.requests,
            errors: healthMonitor.metrics.errors
        };
    }

    async validateFinalState() {
        // Ensure application is healthy after experiment
        await this.validateApplicationHealth();

        // Ensure we have running pods
        const finalPods = await this.getCurrentPods();
        const runningPods = finalPods.filter(p => p.status.phase === 'Running');

        if (runningPods.length === 0) {
            throw new Error('No running pods found after experiment');
        }

        this.logger.info('✅ Final state validation successful', {
            runningPods: runningPods.length,
            totalPods: finalPods.length
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = PodFailureExperiment;