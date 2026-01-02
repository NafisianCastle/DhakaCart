const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const mjml = require('mjml');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');
const { htmlToText } = require('html-to-text');

class EmailService {
    constructor() {
        this.transporter = null;
        this.templates = new Map();
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Create transporter based on environment
            if (process.env.NODE_ENV === 'production') {
                // Use AWS SES in production
                this.transporter = nodemailer.createTransporter({
                    SES: {
                        aws: {
                            region: process.env.AWS_REGION || 'us-east-1'
                        }
                    }
                });
            } else {
                // Use SMTP for development (can be configured for services like SendGrid)
                this.transporter = nodemailer.createTransporter({
                    host: process.env.SMTP_HOST || 'localhost',
                    port: process.env.SMTP_PORT || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: process.env.SMTP_USER ? {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    } : undefined
                });
            }

            // Verify transporter configuration
            if (this.transporter.options.auth || process.env.NODE_ENV === 'production') {
                await this.transporter.verify();
                logger.info('Email service initialized successfully');
            } else {
                logger.warn('Email service initialized without authentication (development mode)');
            }

            // Load email templates
            await this.loadTemplates();

            this.isInitialized = true;
            return true;
        } catch (error) {
            logger.error('Failed to initialize email service', { error: error.message });
            this.isInitialized = false;
            return false;
        }
    }

    async loadTemplates() {
        try {
            const templatesDir = path.join(__dirname, '../templates/email');

            // Create templates directory if it doesn't exist
            try {
                await fs.access(templatesDir);
            } catch {
                await fs.mkdir(templatesDir, { recursive: true });
                logger.info('Created email templates directory');
            }

            // Load existing templates
            const templateFiles = await fs.readdir(templatesDir).catch(() => []);

            for (const file of templateFiles) {
                if (file.endsWith('.mjml')) {
                    const templateName = path.basename(file, '.mjml');
                    const templatePath = path.join(templatesDir, file);
                    const mjmlContent = await fs.readFile(templatePath, 'utf8');

                    // Compile MJML to HTML
                    const { html, errors } = mjml(mjmlContent);

                    if (errors.length > 0) {
                        logger.warn(`MJML template ${templateName} has warnings`, { errors });
                    }

                    // Compile with Handlebars for dynamic content
                    const template = handlebars.compile(html);
                    this.templates.set(templateName, template);

                    logger.debug(`Loaded email template: ${templateName}`);
                }
            }

            // Create default templates if none exist
            if (this.templates.size === 0) {
                await this.createDefaultTemplates();
            }

            logger.info(`Loaded ${this.templates.size} email templates`);
        } catch (error) {
            logger.error('Failed to load email templates', { error: error.message });
        }
    }

    async createDefaultTemplates() {
        const templatesDir = path.join(__dirname, '../templates/email');

        // Welcome email template
        const welcomeTemplate = `
<mjml>
  <mj-head>
    <mj-title>Welcome to DhakaCart</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#333333" align="center" font-weight="bold">
          Welcome to DhakaCart!
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Hi {{firstName}},
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Thank you for joining DhakaCart! We're excited to have you as part of our community.
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Your account has been successfully created with email: {{email}}
        </mj-text>
        <mj-button background-color="#007bff" color="white" href="{{loginUrl}}">
          Start Shopping
        </mj-button>
        <mj-text font-size="14px" color="#999999" align="center">
          If you have any questions, feel free to contact our support team.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

        // Order confirmation template
        const orderConfirmationTemplate = `
<mjml>
  <mj-head>
    <mj-title>Order Confirmation - {{orderNumber}}</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#333333" align="center" font-weight="bold">
          Order Confirmation
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Hi {{customerName}},
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Thank you for your order! We've received your order and it's being processed.
        </mj-text>
        <mj-text font-size="16px" color="#333333" font-weight="bold">
          Order Details:
        </mj-text>
        <mj-text font-size="14px" color="#666666">
          Order Number: {{orderNumber}}<br>
          Order Date: {{orderDate}}<br>
          Total Amount: ${{ totalAmount }}
        </mj-text>
        <mj-button background-color="#28a745" color="white" href="{{orderUrl}}">
          View Order Details
        </mj-button>
        <mj-text font-size="14px" color="#999999" align="center">
          We'll send you another email when your order ships.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

        // Order status update template
        const orderStatusTemplate = `
<mjml>
  <mj-head>
    <mj-title>Order Update - {{orderNumber}}</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#333333" align="center" font-weight="bold">
          Order Status Update
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Hi {{customerName}},
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Your order {{orderNumber}} status has been updated to: <strong>{{status}}</strong>
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          {{statusMessage}}
        </mj-text>
        <mj-button background-color="#007bff" color="white" href="{{trackingUrl}}">
          Track Your Order
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

        // Password reset template
        const passwordResetTemplate = `
<mjml>
  <mj-head>
    <mj-title>Password Reset Request</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#333333" align="center" font-weight="bold">
          Password Reset Request
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          Hi {{firstName}},
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          We received a request to reset your password for your DhakaCart account.
        </mj-text>
        <mj-button background-color="#dc3545" color="white" href="{{resetUrl}}">
          Reset Password
        </mj-button>
        <mj-text font-size="14px" color="#999999">
          This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

        // Newsletter template
        const newsletterTemplate = `
<mjml>
  <mj-head>
    <mj-title>{{subject}}</mj-title>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#333333" align="center" font-weight="bold">
          {{title}}
        </mj-text>
        <mj-text font-size="16px" color="#666666" line-height="24px">
          {{content}}
        </mj-text>
        {{#if ctaText}}
        <mj-button background-color="#007bff" color="white" href="{{ctaUrl}}">
          {{ctaText}}
        </mj-button>
        {{/if}}
        <mj-text font-size="12px" color="#999999" align="center">
          <a href="{{unsubscribeUrl}}">Unsubscribe</a> from these emails.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

        // Save templates
        const templates = {
            'welcome': welcomeTemplate,
            'order-confirmation': orderConfirmationTemplate,
            'order-status': orderStatusTemplate,
            'password-reset': passwordResetTemplate,
            'newsletter': newsletterTemplate
        };

        for (const [name, content] of Object.entries(templates)) {
            const filePath = path.join(templatesDir, `${name}.mjml`);
            await fs.writeFile(filePath, content.trim());

            // Compile and store template
            const { html } = mjml(content);
            const template = handlebars.compile(html);
            this.templates.set(name, template);

            logger.info(`Created default email template: ${name}`);
        }
    }

    async sendEmail(to, subject, templateName, templateData = {}) {
        if (!this.isInitialized) {
            logger.error('Email service not initialized');
            return { success: false, error: 'Email service not initialized' };
        }

        try {
            // Get template
            const template = this.templates.get(templateName);
            if (!template) {
                throw new Error(`Email template '${templateName}' not found`);
            }

            // Render template with data
            const html = template({
                ...templateData,
                baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@dhakacart.com',
                companyName: 'DhakaCart'
            });

            // Email options
            const mailOptions = {
                from: process.env.FROM_EMAIL || 'noreply@dhakacart.com',
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html,
                // Add text version for better deliverability
                text: this.htmlToText(html)
            };

            // Send email
            const result = await this.transporter.sendMail(mailOptions);

            logger.info('Email sent successfully', {
                to: mailOptions.to,
                subject,
                templateName,
                messageId: result.messageId
            });

            return {
                success: true,
                messageId: result.messageId,
                to: mailOptions.to,
                subject
            };
        } catch (error) {
            logger.error('Failed to send email', {
                to,
                subject,
                templateName,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                to,
                subject
            };
        }
    }

    // Convert HTML to plain text for email clients that don't support HTML
    htmlToText(html) {
        if (!html) {
            return '';
        }

        // Use a robust library to convert HTML to plain text without reintroducing HTML tags
        const text = htmlToText(html, {
            wordwrap: false
        });

        // Normalize whitespace similarly to the previous implementation
        return text.replace(/\s+/g, ' ').trim();
    }

    // Email workflow methods
    async sendWelcomeEmail(user) {
        return this.sendEmail(
            user.email,
            'Welcome to DhakaCart!',
            'welcome',
            {
                firstName: user.first_name || user.email.split('@')[0],
                email: user.email,
                loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
            }
        );
    }

    async sendOrderConfirmationEmail(user, order) {
        return this.sendEmail(
            user.email,
            `Order Confirmation - ${order.order_number}`,
            'order-confirmation',
            {
                customerName: user.first_name || user.email.split('@')[0],
                orderNumber: order.order_number,
                orderDate: new Date(order.created_at).toLocaleDateString(),
                totalAmount: order.total_amount,
                orderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order.id}`
            }
        );
    }

    async sendOrderStatusEmail(user, order) {
        const statusMessages = {
            'confirmed': 'Your order has been confirmed and is being prepared.',
            'processing': 'Your order is currently being processed.',
            'shipped': 'Great news! Your order has been shipped and is on its way.',
            'delivered': 'Your order has been delivered successfully.',
            'cancelled': 'Your order has been cancelled. If you have any questions, please contact support.'
        };

        return this.sendEmail(
            user.email,
            `Order Update - ${order.order_number}`,
            'order-status',
            {
                customerName: user.first_name || user.email.split('@')[0],
                orderNumber: order.order_number,
                status: order.status.charAt(0).toUpperCase() + order.status.slice(1),
                statusMessage: statusMessages[order.status] || 'Your order status has been updated.',
                trackingUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order.id}`
            }
        );
    }

    async sendPasswordResetEmail(user, resetToken) {
        return this.sendEmail(
            user.email,
            'Password Reset Request',
            'password-reset',
            {
                firstName: user.first_name || user.email.split('@')[0],
                resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
            }
        );
    }

    async sendNewsletterEmail(subscribers, subject, content, ctaText = null, ctaUrl = null) {
        const results = [];

        for (const subscriber of subscribers) {
            const result = await this.sendEmail(
                subscriber.email,
                subject,
                'newsletter',
                {
                    title: subject,
                    content,
                    ctaText,
                    ctaUrl,
                    unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`
                }
            );

            results.push({
                email: subscriber.email,
                success: result.success,
                error: result.error
            });
        }

        return results;
    }

    // Abandoned cart email
    async sendAbandonedCartEmail(user, cartItems) {
        const itemsText = cartItems.map(item =>
            `${item.product_name} (Qty: ${item.quantity})`
        ).join(', ');

        return this.sendEmail(
            user.email,
            'Complete Your Purchase',
            'newsletter',
            {
                title: 'You left something in your cart!',
                content: `Hi ${user.first_name || user.email.split('@')[0]}, you have items waiting in your cart: ${itemsText}. Complete your purchase before they're gone!`,
                ctaText: 'Complete Purchase',
                ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cart`,
                unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(user.email)}`
            }
        );
    }

    // Get service status
    getStatus() {
        return {
            initialized: this.isInitialized,
            templatesLoaded: this.templates.size,
            transporterConfigured: !!this.transporter
        };
    }
}

module.exports = EmailService;