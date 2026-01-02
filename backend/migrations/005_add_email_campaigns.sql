-- Migration: Add email campaigns table
-- Description: Create table to track email campaigns and statistics

-- Create email campaigns table
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('newsletter', 'bulk', 'transactional')),
    subject VARCHAR(500) NOT NULL,
    template_name VARCHAR(100),
    total_recipients INTEGER NOT NULL DEFAULT 0,
    successful INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    admin_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_campaigns_type ON email_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_admin_id ON email_campaigns(admin_id);

-- Add email notification preferences to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS newsletter_subscribed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN DEFAULT true;

-- Create email templates table for future use
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    description TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for email templates
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Create email logs table for detailed tracking
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES email_campaigns(id),
    recipient_email VARCHAR(255) NOT NULL,
    template_name VARCHAR(100),
    subject VARCHAR(500),
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'bounced', 'delivered', 'opened', 'clicked')),
    error_message TEXT,
    message_id VARCHAR(255),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP
);

-- Add indexes for email logs
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to email campaigns table
DROP TRIGGER IF EXISTS update_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER update_email_campaigns_updated_at
    BEFORE UPDATE ON email_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to email templates table
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();