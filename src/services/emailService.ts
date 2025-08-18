import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private static isInitialized = false;

  /**
   * Initialize SendGrid
   */
  static initialize() {
    if (!env.sendgridApiKey) {
      console.warn('SendGrid API key not found. Email notifications will be logged only.');
      return;
    }

    sgMail.setApiKey(env.sendgridApiKey);
    this.isInitialized = true;
    console.log('✅ Email service initialized with SendGrid');
  }

  /**
   * Send email notification
   */
  static async sendEmail(to: string, template: EmailTemplate) {
    try {
      if (!this.isInitialized) {
        // Fallback to console logging
        console.log('📧 Email would be sent:', {
          to,
          subject: template.subject,
          text: template.text
        });
        return { success: true, message: 'Email logged (SendGrid not configured)' };
      }

      const msg = {
        to,
        from: env.sendgridFromEmail || 'noreply@knockwise.com',
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${to}`);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Generate territory assignment email template
   */
  static generateTerritoryAssignmentTemplate(data: {
    zoneName: string;
    effectiveFrom: Date;
    assignmentId: string;
    isTeamAssignment?: boolean;
    teamName?: string;
  }): EmailTemplate {
    const formattedDate = new Date(data.effectiveFrom).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const subject = data.isTeamAssignment 
      ? `Team Territory Assignment: ${data.zoneName}`
      : `New Territory Assignment: ${data.zoneName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Territory Assignment</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 Territory Assignment</h1>
          </div>
          <div class="content">
            <h2>${data.isTeamAssignment ? 'Team Territory Assignment' : 'New Territory Assignment'}</h2>
            <p>Hello!</p>
            <p>${data.isTeamAssignment 
              ? `Your team <strong>"${data.teamName}"</strong> has been assigned to a new territory.`
              : 'You have been assigned to a new territory.'
            }</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0;">Assignment Details</h3>
              <p><strong>Territory:</strong> ${data.zoneName}</p>
              <p><strong>Effective Date:</strong> ${formattedDate}</p>
              <p><strong>Assignment ID:</strong> ${data.assignmentId}</p>
            </div>

            <p>The assignment is now active and ready for you to begin work.</p>
            
            <a href="${env.frontendUrl || 'http://localhost:3000'}/dashboard" class="button">
              View Dashboard
            </a>
          </div>
          <div class="footer">
            <p>This is an automated notification from KnockWise</p>
            <p>If you have any questions, please contact your administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Territory Assignment

${data.isTeamAssignment ? 'Team Territory Assignment' : 'New Territory Assignment'}

Hello!

${data.isTeamAssignment 
  ? `Your team "${data.teamName}" has been assigned to a new territory.`
  : 'You have been assigned to a new territory.'
}

Assignment Details:
- Territory: ${data.zoneName}
- Effective Date: ${formattedDate}
- Assignment ID: ${data.assignmentId}

The assignment is now active and ready for you to begin work.

View your dashboard: ${env.frontendUrl || 'http://localhost:3000'}/dashboard

This is an automated notification from KnockWise
If you have any questions, please contact your administrator.
    `;

    return { subject, html, text };
  }

  /**
   * Generate scheduled assignment reminder template
   */
  static generateScheduledAssignmentTemplate(data: {
    zoneName: string;
    scheduledDate: Date;
    assignmentId: string;
    isTeamAssignment?: boolean;
    teamName?: string;
  }): EmailTemplate {
    const formattedDate = new Date(data.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = data.isTeamAssignment 
      ? `Scheduled Team Assignment: ${data.zoneName}`
      : `Scheduled Territory Assignment: ${data.zoneName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Scheduled Territory Assignment</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Scheduled Assignment</h1>
          </div>
          <div class="content">
            <h2>${data.isTeamAssignment ? 'Scheduled Team Assignment' : 'Scheduled Territory Assignment'}</h2>
            <p>Hello!</p>
            <p>${data.isTeamAssignment 
              ? `Your team <strong>"${data.teamName}"</strong> has been scheduled for a territory assignment.`
              : 'You have been scheduled for a territory assignment.'
            }</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="margin-top: 0;">Scheduled Assignment Details</h3>
              <p><strong>Territory:</strong> ${data.zoneName}</p>
              <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
              <p><strong>Assignment ID:</strong> ${data.assignmentId}</p>
            </div>

            <p>This assignment will become active on the scheduled date. You will receive another notification when it's activated.</p>
            
            <a href="${env.frontendUrl || 'http://localhost:3000'}/dashboard" class="button">
              View Dashboard
            </a>
          </div>
          <div class="footer">
            <p>This is an automated notification from KnockWise</p>
            <p>If you have any questions, please contact your administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Scheduled Territory Assignment

${data.isTeamAssignment ? 'Scheduled Team Assignment' : 'Scheduled Territory Assignment'}

Hello!

${data.isTeamAssignment 
  ? `Your team "${data.teamName}" has been scheduled for a territory assignment.`
  : 'You have been scheduled for a territory assignment.'
}

Scheduled Assignment Details:
- Territory: ${data.zoneName}
- Scheduled Date: ${formattedDate}
- Assignment ID: ${data.assignmentId}

This assignment will become active on the scheduled date. You will receive another notification when it's activated.

View your dashboard: ${env.frontendUrl || 'http://localhost:3000'}/dashboard

This is an automated notification from KnockWise
If you have any questions, please contact your administrator.
    `;

    return { subject, html, text };
  }
}
