const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for email endpoints
const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 email operations per hour
    message: {
        error: 'Too many email requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class EmailController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.dbPool = dbPool;
        this.redisPool = redisPool;
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // Send newsletter to all subscribers
    sendNewsletter = async (req, res) => {
        try {
            const { subject, content, ctaText, ctaUrl } = req.validatedData;

            if (!this.emailService || !this.emailService.isInitialized) {
                return res.status(503).json({
                    error: 'Email service not available',
                    code: 'EMAIL_SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            // Get all active users (newsletter subscribers)
            const subscribersResult = await this.dbPool.query(`
                SELECT id, email, first_name, last_name 
                FROM users 
                WHERE is_active = true 
                AND email_notifications = true
                ORDER BY created_at DESC
            `);

            const subscribers = subscribersResult.rows;

            if (subscribers.length === 0) {
                return res.status(400).json({
                    error: 'No active subscribers found',
                    code: 'NO_SUBSCRIBERS',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            // Send newsletter emails
            const results = await this.emailService.sendNewsletterEmail(
                subscribers,
                subject,
                content,
                ctaText,
                ctaUrl
            );

            // Count successful and failed sends
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            // Log newsletter campaign
            await this.logEmailCampaign({
                type: 'newsletter',
                subject,
                totalRecipients: subscribers.length,
                successful,
                failed,
                adminId: req.user.userId
            });

            logger.info('Newsletter sent', {
                subject,
                totalRecipients: subscribers.length,
                successful,
                failed,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Newsletter sent successfully',
                data: {
                    totalRecipients: subscribers.length,
                    successful,
                    failed,
                    results: results.slice(0, 10) // Return first 10 results as sample
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Newsletter send failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to send newsletter',
                code: 'NEWSLETTER_SEND_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Send bulk email to specific recipients
    sendBulkEmail = async (req, res) => {
        try {
            const { recipients, subject, templateName, templateData } = req.validatedData;

            if (!this.emailService || !this.emailService.isInitialized) {
                return res.status(503).json({
                    error: 'Email service not available',
                    code: 'EMAIL_SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const results = [];
            let successful = 0;
            let failed = 0;

            // Send emails to each recipient
            for (const recipient of recipients) {
                try {
                    const result = await this.emailService.sendEmail(
                        recipient.email,
                        subject,
                        templateName,
                        { ...templateData, ...recipient }
                    );

                    results.push({
                        email: recipient.email,
                        success: result.success,
                        messageId: result.messageId,
                        error: result.error
                    });

                    if (result.success) {
                        successful++;
                    } else {
                        failed++;
                    }
                } catch (emailError) {
                    results.push({
                        email: recipient.email,
                        success: false,
                        error: emailError.message
                    });
                    failed++;
                }
            }

            // Log bulk email campaign
            await this.logEmailCampaign({
                type: 'bulk',
                subject,
                templateName,
                totalRecipients: recipients.length,
                successful,
                failed,
                adminId: req.user.userId
            });

            logger.info('Bulk email sent', {
                subject,
                templateName,
                totalRecipients: recipients.length,
                successful,
                failed,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Bulk email sent successfully',
                data: {
                    totalRecipients: recipients.length,
                    successful,
                    failed,
                    results
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Bulk email send failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to send bulk email',
                code: 'BULK_EMAIL_SEND_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get available email templates
    getEmailTemplates = async (req, res) => {
        try {
            if (!this.emailService) {
                return res.status(503).json({
                    error: 'Email service not available',
                    code: 'EMAIL_SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const templates = Array.from(this.emailService.templates.keys());

            logger.info('Email templates retrieved', {
                templateCount: templates.length,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { templates },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get email templates failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to retrieve email templates',
                code: 'EMAIL_TEMPLATES_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Create new email template
    createEmailTemplate = async (req, res) => {
        try {
            const { name, content } = req.validatedData;

            // This would require implementing template creation in EmailService
            // For now, return a placeholder response
            res.status(501).json({
                error: 'Template creation not yet implemented',
                code: 'NOT_IMPLEMENTED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Create email template failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to create email template',
                code: 'EMAIL_TEMPLATE_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Update email template
    updateEmailTemplate = async (req, res) => {
        try {
            const { templateName } = req.params;
            const { content } = req.validatedData;

            // This would require implementing template update in EmailService
            // For now, return a placeholder response
            res.status(501).json({
                error: 'Template update not yet implemented',
                code: 'NOT_IMPLEMENTED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update email template failed', {
                error: error.message,
                templateName: req.params.templateName,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to update email template',
                code: 'EMAIL_TEMPLATE_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get email statistics
    getEmailStats = async (req, res) => {
        try {
            const { period = '30d' } = req.query;

            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();

            switch (period) {
                case '7d':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '90d':
                    startDate.setDate(endDate.getDate() - 90);
                    break;
                default:
                    startDate.setDate(endDate.getDate() - 30);
            }

            // Get email statistics from database
            const statsResult = await this.dbPool.query(`
                SELECT 
                    COUNT(*) as total_campaigns,
                    SUM(total_recipients) as total_emails_sent,
                    SUM(successful) as total_successful,
                    SUM(failed) as total_failed,
                    AVG(successful::float / NULLIF(total_recipients, 0)) as avg_success_rate
                FROM email_campaigns 
                WHERE created_at >= $1 AND created_at <= $2
            `, [startDate, endDate]);

            const stats = statsResult.rows[0] || {
                total_campaigns: 0,
                total_emails_sent: 0,
                total_successful: 0,
                total_failed: 0,
                avg_success_rate: 0
            };

            // Get recent campaigns
            const recentCampaignsResult = await this.dbPool.query(`
                SELECT type, subject, total_recipients, successful, failed, created_at
                FROM email_campaigns 
                WHERE created_at >= $1 AND created_at <= $2
                ORDER BY created_at DESC
                LIMIT 10
            `, [startDate, endDate]);

            logger.info('Email statistics retrieved', {
                period,
                totalCampaigns: stats.total_campaigns,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    period,
                    stats: {
                        totalCampaigns: parseInt(stats.total_campaigns),
                        totalEmailsSent: parseInt(stats.total_emails_sent),
                        totalSuccessful: parseInt(stats.total_successful),
                        totalFailed: parseInt(stats.total_failed),
                        averageSuccessRate: parseFloat(stats.avg_success_rate) || 0
                    },
                    recentCampaigns: recentCampaignsResult.rows
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get email statistics failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to retrieve email statistics',
                code: 'EMAIL_STATS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get email logs
    getEmailLogs = async (req, res) => {
        try {
            const { page = 1, limit = 50, type } = req.query;
            const offset = (page - 1) * limit;

            let whereClause = '';
            let queryParams = [limit, offset];

            if (type) {
                whereClause = 'WHERE type = $3';
                queryParams.push(type);
            }

            const logsResult = await this.dbPool.query(`
                SELECT id, type, subject, total_recipients, successful, failed, admin_id, created_at
                FROM email_campaigns 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            `, queryParams);

            const countResult = await this.dbPool.query(`
                SELECT COUNT(*) as total
                FROM email_campaigns 
                ${whereClause}
            `, type ? [type] : []);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            logger.info('Email logs retrieved', {
                page,
                limit,
                type,
                total,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    logs: logsResult.rows,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages
                    }
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get email logs failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to retrieve email logs',
                code: 'EMAIL_LOGS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Send test email
    sendTestEmail = async (req, res) => {
        try {
            const { email, templateName = 'newsletter', subject = 'Test Email' } = req.body;

            if (!this.emailService || !this.emailService.isInitialized) {
                return res.status(503).json({
                    error: 'Email service not available',
                    code: 'EMAIL_SERVICE_UNAVAILABLE',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const result = await this.emailService.sendEmail(
                email || req.user.email,
                subject,
                templateName,
                {
                    title: 'Test Email',
                    content: 'This is a test email sent from the DhakaCart admin panel.',
                    ctaText: 'Visit Dashboard',
                    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/dashboard`
                }
            );

            logger.info('Test email sent', {
                email: email || req.user.email,
                templateName,
                success: result.success,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Test email sent successfully',
                data: {
                    email: email || req.user.email,
                    templateName,
                    result
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Send test email failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to send test email',
                code: 'TEST_EMAIL_SEND_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Helper method to log email campaigns
    async logEmailCampaign(campaignData) {
        try {
            await this.dbPool.query(`
                INSERT INTO email_campaigns (
                    type, subject, template_name, total_recipients, 
                    successful, failed, admin_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                campaignData.type,
                campaignData.subject,
                campaignData.templateName || null,
                campaignData.totalRecipients,
                campaignData.successful,
                campaignData.failed,
                campaignData.adminId
            ]);
        } catch (error) {
            logger.error('Failed to log email campaign', {
                error: error.message,
                campaignData
            });
        }
    }
}

module.exports = { EmailController, emailLimiter };