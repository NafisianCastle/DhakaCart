const express = require('express');
const { EmailController, emailLimiter } = require('../controllers/emailController');
const { authenticateToken, requireAdmin } = require('../auth/middleware');
const {
    validate,
    sendNewsletterSchema,
    sendBulkEmailSchema,
    emailTemplateSchema
} = require('../validation/emailValidation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let emailController = null;

const initializeController = (dbPool, redisPool, webSocketService = null, emailService = null) => {
    emailController = new EmailController(dbPool, redisPool, webSocketService, emailService);
};

// All email routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);
router.use(emailLimiter);

// Newsletter and bulk email routes
router.post('/newsletter',
    validate(sendNewsletterSchema),
    (req, res) => emailController.sendNewsletter(req, res)
);

router.post('/bulk',
    validate(sendBulkEmailSchema),
    (req, res) => emailController.sendBulkEmail(req, res)
);

// Email template management
router.get('/templates',
    (req, res) => emailController.getEmailTemplates(req, res)
);

router.post('/templates',
    validate(emailTemplateSchema),
    (req, res) => emailController.createEmailTemplate(req, res)
);

router.put('/templates/:templateName',
    validate(emailTemplateSchema),
    (req, res) => emailController.updateEmailTemplate(req, res)
);

// Email statistics and logs
router.get('/stats',
    (req, res) => emailController.getEmailStats(req, res)
);

router.get('/logs',
    (req, res) => emailController.getEmailLogs(req, res)
);

// Test email functionality
router.post('/test',
    (req, res) => emailController.sendTestEmail(req, res)
);

module.exports = { router, initializeController };