const { v4: uuidv4 } = require('uuid');

module.exports = {
    // Generate random string for product names
    randomString: function (context, events, done) {
        context.vars.randomString = `product-${uuidv4().substring(0, 8)}`;
        return done();
    },

    // Generate random number within range
    randomNumber: function (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Generate random integer within range
    randomInt: function (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Log response times for analysis
    logResponse: function (requestParams, response, context, ee, next) {
        if (response.statusCode >= 400) {
            console.log(`Error response: ${response.statusCode} for ${requestParams.url}`);
        }

        // Log slow responses (over 2 seconds)
        if (response.timings && response.timings.response > 2000) {
            console.log(`Slow response: ${response.timings.response}ms for ${requestParams.url}`);
        }

        return next();
    },

    // Custom metrics for business logic
    trackBusinessMetrics: function (context, events, done) {
        // Track custom metrics like cart operations, user sessions, etc.
        context.vars.sessionId = uuidv4();
        context.vars.timestamp = Date.now();
        return done();
    }
};