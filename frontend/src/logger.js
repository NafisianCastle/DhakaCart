// Frontend logging utility with correlation ID support
class Logger {
    constructor() {
        this.correlationId = this.generateCorrelationId();
        this.sessionId = this.getOrCreateSessionId();
    }

    generateCorrelationId() {
        // Use cryptographically secure random values when available
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            let i = 0;
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = bytes[i++] & 0x0f; // use 4 random bits per hex digit
                const v = c === 'x' ? r : ((r & 0x3) | 0x8); // set variant bits for 'y'
                return v.toString(16);
            });
        }

        // Fallback for environments without crypto.getRandomValues
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = this.generateCorrelationId();
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    createLogEntry(level, message, meta = {}) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            service: 'dhakacart-frontend',
            environment: process.env.NODE_ENV || 'development',
            correlationId: this.correlationId,
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent,
            ...meta
        };
    }

    log(level, message, meta = {}) {
        const logEntry = this.createLogEntry(level, message, meta);

        // Console logging for development
        if (process.env.NODE_ENV === 'development') {
            console[level] || console.log(logEntry);
        }

        // Send to backend logging endpoint in production
        if (process.env.NODE_ENV === 'production' && level === 'error') {
            this.sendToBackend(logEntry);
        }

        return logEntry;
    }

    info(message, meta = {}) {
        return this.log('info', message, meta);
    }

    warn(message, meta = {}) {
        return this.log('warn', message, meta);
    }

    error(message, meta = {}) {
        return this.log('error', message, meta);
    }

    debug(message, meta = {}) {
        return this.log('debug', message, meta);
    }

    // Send logs to backend (for error tracking)
    async sendToBackend(logEntry) {
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-correlation-id': this.correlationId
                },
                body: JSON.stringify(logEntry)
            });
        } catch (err) {
            // Silently fail - don't want logging to break the app
            console.error('Failed to send log to backend:', err);
        }
    }

    // Create new correlation ID for new requests
    newCorrelationId() {
        this.correlationId = this.generateCorrelationId();
        return this.correlationId;
    }

    // Get current correlation ID
    getCorrelationId() {
        return this.correlationId;
    }
}

// Create singleton instance
const logger = new Logger();

export default logger;