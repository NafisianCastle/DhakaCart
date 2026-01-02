const logger = require('../logger');

class EmailSchedulerService {
    constructor(dbPool, emailService) {
        this.dbPool = dbPool;
        this.emailService = emailService;
        this.intervals = new Map();
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) {
            logger.warn('Email scheduler already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting email scheduler service');

        // Schedule abandoned cart emails (check every 30 minutes)
        this.scheduleJob('abandonedCart', 30 * 60 * 1000, () => this.processAbandonedCarts());

        // Schedule welcome email reminders (check every hour)
        this.scheduleJob('welcomeReminders', 60 * 60 * 1000, () => this.processWelcomeReminders());

        // Schedule order follow-ups (check every 2 hours)
        this.scheduleJob('orderFollowups', 2 * 60 * 60 * 1000, () => this.processOrderFollowups());

        logger.info('Email scheduler service started with all jobs');
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Clear all intervals
        for (const [jobName, intervalId] of this.intervals) {
            clearInterval(intervalId);
            logger.info(`Stopped email scheduler job: ${jobName}`);
        }

        this.intervals.clear();
        logger.info('Email scheduler service stopped');
    }

    scheduleJob(jobName, intervalMs, jobFunction) {
        if (this.intervals.has(jobName)) {
            clearInterval(this.intervals.get(jobName));
        }

        const intervalId = setInterval(async () => {
            try {
                await jobFunction();
            } catch (error) {
                logger.error(`Email scheduler job ${jobName} failed`, {
                    error: error.message,
                    jobName
                });
            }
        }, intervalMs);

        this.intervals.set(jobName, intervalId);
        logger.info(`Scheduled email job: ${jobName} (interval: ${intervalMs}ms)`);
    }

    // Process abandoned cart emails
    async processAbandonedCarts() {
        try {
            if (!this.emailService || !this.emailService.isInitialized) {
                return;
            }

            // Find carts that have been abandoned for 1 hour
            const abandonedCartsResult = await this.dbPool.query(`
        SELECT DISTINCT 
          c.user_id,
          u.email,
          u.first_name,
          u.last_name,
          c.updated_at as last_activity,
          COUNT(ci.id) as item_count
        FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE c.updated_at < NOW() - INTERVAL '1 hour'
          AND c.updated_at > NOW() - INTERVAL '24 hours'
          AND u.email_notifications = true
          AND u.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM email_logs el 
            WHERE el.recipient_email = u.email 
              AND el.template_name = 'abandoned-cart'
              AND el.sent_at > NOW() - INTERVAL '24 hours'
          )
        GROUP BY c.user_id, u.email, u.first_name, u.last_name, c.updated_at
        HAVING COUNT(ci.id) > 0
        LIMIT 50
      `);

            const abandonedCarts = abandonedCartsResult.rows;

            if (abandonedCarts.length === 0) {
                logger.debug('No abandoned carts found for email processing');
                return;
            }

            let emailsSent = 0;
            let emailsFailed = 0;

            for (const cart of abandonedCarts) {
                try {
                    // Get cart items for this user
                    const cartItemsResult = await this.dbPool.query(`
            SELECT ci.quantity, p.name as product_name, p.price
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            JOIN products p ON ci.product_id = p.id
            WHERE c.user_id = $1
            ORDER BY ci.created_at DESC
            LIMIT 5
          `, [cart.user_id]);

                    const cartItems = cartItemsResult.rows;

                    // Send abandoned cart email
                    const result = await this.emailService.sendAbandonedCartEmail(
                        {
                            email: cart.email,
                            first_name: cart.first_name,
                            last_name: cart.last_name
                        },
                        cartItems
                    );

                    if (result.success) {
                        emailsSent++;

                        // Log the email
                        await this.logEmail({
                            campaignId: null,
                            recipientEmail: cart.email,
                            templateName: 'abandoned-cart',
                            subject: 'Complete Your Purchase',
                            status: 'sent',
                            messageId: result.messageId
                        });
                    } else {
                        emailsFailed++;

                        // Log the failure
                        await this.logEmail({
                            campaignId: null,
                            recipientEmail: cart.email,
                            templateName: 'abandoned-cart',
                            subject: 'Complete Your Purchase',
                            status: 'failed',
                            errorMessage: result.error
                        });
                    }
                } catch (error) {
                    emailsFailed++;
                    logger.error('Failed to send abandoned cart email', {
                        userId: cart.user_id,
                        email: cart.email,
                        error: error.message
                    });
                }
            }

            logger.info('Processed abandoned cart emails', {
                totalCarts: abandonedCarts.length,
                emailsSent,
                emailsFailed
            });
        } catch (error) {
            logger.error('Failed to process abandoned carts', {
                error: error.message
            });
        }
    }

    // Process welcome email reminders for users who haven't verified
    async processWelcomeReminders() {
        try {
            if (!this.emailService || !this.emailService.isInitialized) {
                return;
            }

            // Find users who registered but haven't been sent a welcome reminder
            const usersResult = await this.dbPool.query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.created_at
        FROM users u
        WHERE u.created_at > NOW() - INTERVAL '7 days'
          AND u.created_at < NOW() - INTERVAL '24 hours'
          AND u.email_notifications = true
          AND u.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM email_logs el 
            WHERE el.recipient_email = u.email 
              AND el.template_name = 'welcome-reminder'
              AND el.sent_at > NOW() - INTERVAL '7 days'
          )
        LIMIT 20
      `);

            const users = usersResult.rows;

            if (users.length === 0) {
                logger.debug('No users found for welcome reminder emails');
                return;
            }

            let emailsSent = 0;
            let emailsFailed = 0;

            for (const user of users) {
                try {
                    // Send welcome reminder using newsletter template
                    const result = await this.emailService.sendEmail(
                        user.email,
                        'Welcome to DhakaCart - Get Started!',
                        'newsletter',
                        {
                            title: 'Welcome to DhakaCart!',
                            content: `Hi ${user.first_name || user.email.split('@')[0]}, welcome to DhakaCart! We're excited to have you join our community. Start exploring our products and find great deals today.`,
                            ctaText: 'Start Shopping',
                            ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/products`,
                            unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(user.email)}`
                        }
                    );

                    if (result.success) {
                        emailsSent++;

                        // Log the email
                        await this.logEmail({
                            campaignId: null,
                            recipientEmail: user.email,
                            templateName: 'welcome-reminder',
                            subject: 'Welcome to DhakaCart - Get Started!',
                            status: 'sent',
                            messageId: result.messageId
                        });
                    } else {
                        emailsFailed++;

                        // Log the failure
                        await this.logEmail({
                            campaignId: null,
                            recipientEmail: user.email,
                            templateName: 'welcome-reminder',
                            subject: 'Welcome to DhakaCart - Get Started!',
                            status: 'failed',
                            errorMessage: result.error
                        });
                    }
                } catch (error) {
                    emailsFailed++;
                    logger.error('Failed to send welcome reminder email', {
                        userId: user.id,
                        email: user.email,
                        error: error.message
                    });
                }
            }

            logger.info('Processed welcome reminder emails', {
                totalUsers: users.length,
                emailsSent,
                emailsFailed
            });
        } catch (error) {
            logger.error('Failed to process welcome reminders', {
                error: error.message
            });
        }
    }

    // Process order follow-up emails
    async processOrderFollowups() {
        try {
            if (!this.emailService || !this.emailService.isInitialized) {
                return;
            }

            // Find delivered orders that need follow-up emails (after 3 days)
            const ordersResult = await this.dbPool.query(`
        SELECT o.id, o.order_number, o.total_amount, o.updated_at,
               u.email, u.first_name, u.last_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.status = 'delivered'
          AND o.updated_at < NOW() - INTERVAL '3 days'
          AND o.updated_at > NOW() - INTERVAL '30 days'
          AND u.email_notifications = true
          AND u.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM email_logs el 
            WHERE el.recipient_email = u.email 
              AND el.template_name = 'order-followup'
              AND el.sent_at > NOW() - INTERVAL '30 days'
          )
        LIMIT 30
      `);

            const orders = ordersResult.rows;

            if (orders.length === 0) {
                logger.debug('No orders found for follow-up emails');
                return;
            }

            let emailsSent = 0;
            let emailsFailed = 0;

            for (const order of orders) {
                try {
                    // Send order follow-up using newsletter template
                    const result = await this.emailService.sendEmail(
                        order.email,
                        'How was your DhakaCart experience?',
                        'newsletter',
                        {
                            title: 'Thank you for your order!',
                            content: `Hi ${order.first_name || order.email.split('@')[0]}, we hope you're enjoying your recent purchase from order #${order.order_number}. We'd love to hear about your experience and help you find more great products.`,
                            ctaText: 'Shop Again',
                            ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/products`,
                            unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(order.email)}`
                        }
                    );

                    if (result.success) {
                        emailsSent++;

                        // Log the email
                        await this.logEmail({
                            campaignId: null,
                            recipientEmail: order.email,
                            templateName: 'order-followup',
                            subject: 'How was your DhakaCart experience?',
                            status: 'sent',
                            messageId: result.messageId
                        });
                    } else {
                        emailsFailed++;

                        // Log the failure
                        await this.logEmail({
                            campaignId: null,
                            recipientEmail: order.email,
                            templateName: 'order-followup',
                            subject: 'How was your DhakaCart experience?',
                            status: 'failed',
                            errorMessage: result.error
                        });
                    }
                } catch (error) {
                    emailsFailed++;
                    logger.error('Failed to send order follow-up email', {
                        orderId: order.id,
                        email: order.email,
                        error: error.message
                    });
                }
            }

            logger.info('Processed order follow-up emails', {
                totalOrders: orders.length,
                emailsSent,
                emailsFailed
            });
        } catch (error) {
            logger.error('Failed to process order follow-ups', {
                error: error.message
            });
        }
    }

    // Helper method to log emails
    async logEmail(emailData) {
        try {
            await this.dbPool.query(`
        INSERT INTO email_logs (
          campaign_id, recipient_email, template_name, subject, 
          status, error_message, message_id, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
                emailData.campaignId,
                emailData.recipientEmail,
                emailData.templateName,
                emailData.subject,
                emailData.status,
                emailData.errorMessage || null,
                emailData.messageId || null
            ]);
        } catch (error) {
            logger.error('Failed to log email', {
                error: error.message,
                emailData
            });
        }
    }

    // Get scheduler status
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.intervals.keys()),
            jobCount: this.intervals.size
        };
    }
}

module.exports = EmailSchedulerService;