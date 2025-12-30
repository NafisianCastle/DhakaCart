import logger from './logger';

// API utility with logging and correlation ID support
class ApiClient {
    constructor(baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000') {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const correlationId = logger.newCorrelationId();
        const startTime = Date.now();

        const url = `${this.baseURL}${endpoint}`;
        const requestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'x-correlation-id': correlationId,
                ...options.headers
            }
        };

        logger.info('API request started', {
            method: requestOptions.method || 'GET',
            url,
            correlationId
        });

        try {
            const response = await fetch(url, requestOptions);
            const responseTime = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                logger.error('API request failed', {
                    method: requestOptions.method || 'GET',
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    correlationId,
                    responseTime,
                    errorData
                });

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            logger.info('API request completed', {
                method: requestOptions.method || 'GET',
                url,
                status: response.status,
                correlationId,
                responseTime,
                dataSize: JSON.stringify(data).length
            });

            return {
                data,
                correlationId: response.headers.get('x-correlation-id') || correlationId,
                status: response.status
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            logger.error('API request error', {
                method: requestOptions.method || 'GET',
                url,
                correlationId,
                responseTime,
                error: error.message,
                stack: error.stack
            });

            throw error;
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async patch(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;