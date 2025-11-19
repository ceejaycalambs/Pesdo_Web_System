/**
 * Email Service
 * Handles sending emails via Brevo API through Supabase Edge Function
 */

import { supabase } from '../supabase.js';

/**
 * Get base URL for email links
 * Uses Vite's import.meta.env or falls back to default
 */
const getBaseUrl = () => {
  // Try Vite environment variable first
  if (import.meta.env?.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL;
  }
  // Fallback to default production URL
  return 'https://pesdosurigao.online';
};

/**
 * Get admin URL for email links
 * Returns admin subdomain URL (admin.pesdosurigao.online)
 */
const getAdminUrl = () => {
  // Try Vite environment variable for admin URL first
  if (import.meta.env?.VITE_ADMIN_URL) {
    return import.meta.env.VITE_ADMIN_URL;
  }
  // Extract base URL and convert to admin subdomain
  const baseUrl = getBaseUrl();
  // If base URL is pesdosurigao.online, convert to admin.pesdosurigao.online
  if (baseUrl.includes('pesdosurigao.online')) {
    return baseUrl.replace('pesdosurigao.online', 'admin.pesdosurigao.online');
  }
  // For localhost or other domains, use /admin path
  return `${baseUrl}/admin`;
};

/**
 * Send Email via Brevo API
 * NOTE: This calls a Supabase Edge Function to keep email API credentials secure
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email body
 * @param {string} options.text - Plain text email body (optional)
 * @param {string} options.senderName - Sender name (optional, defaults to 'PESDO Surigao')
 * @returns {Promise<Object>} - Result object
 */
export const sendEmail = async ({ to, subject, html, text, senderName }) => {
  try {
    console.log('📧 Email Service: Attempting to send email', { 
      to, 
      subject,
      htmlLength: html?.length,
      timestamp: new Date().toISOString()
    });
    
    // Call Supabase Edge Function (Recommended)
    // This keeps your email API credentials secure on the server
    console.log('🔗 Email Service: Invoking Edge Function "send-email"');
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { 
        to, 
        subject, 
        html,
        ...(text ? { text } : {}),
        ...(senderName ? { senderName } : {})
      }
    });

    console.log('📥 Email Service: Edge Function response received', { 
      hasData: !!data, 
      hasError: !!error,
      errorMessage: error?.message 
    });

    if (error) {
      console.error('❌ Email Service: Error from Edge Function', {
        message: error.message,
        context: error.context,
        status: error.status
      });
      return { success: false, error: error.message };
    }

    console.log('✅ Email Service: Email sent successfully', data);
    return { success: true, data };

  } catch (error) {
    console.error('❌ Email Service: Exception occurred', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 300)
    });
    return { success: false, error: error.message };
  }
};

/**
 * Email Templates
 */

// Application status update email
export const sendApplicationStatusEmail = async (email, userName, jobTitle, status, companyName) => {
  const statusInfo = {
    accepted: {
      subject: `🎉 Application Accepted - ${jobTitle} at ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Congratulations!</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Great news! Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been <strong>ACCEPTED</strong>!</p>
              <p>The employer will be in touch with you soon regarding the next steps.</p>
              <p style="text-align: center;">
                <a href="${getBaseUrl()}/jobseeker" class="button">View Dashboard</a>
              </p>
              <p>Best regards,<br>PESDO Surigao</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    rejected: {
      subject: `Application Update - ${jobTitle} at ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #005177; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Application Update</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Thank you for applying to <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
              <p>Unfortunately, your application was not selected for this position. We encourage you to keep applying to other opportunities that match your skills.</p>
              <p style="text-align: center;">
                <a href="${getBaseUrl()}/jobseeker" class="button">Browse More Jobs</a>
              </p>
              <p>Best regards,<br>PESDO Surigao</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    referred: {
      subject: `📋 You've Been Referred - ${jobTitle} at ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Referral Notification</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Great news! You've been <strong>REFERRED</strong> by PESDO for the position <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
              <p>The employer will review your profile and may contact you directly. Please keep an eye on your dashboard for updates.</p>
              <p style="text-align: center;">
                <a href="${getBaseUrl()}/jobseeker" class="button">View Dashboard</a>
              </p>
              <p>Best regards,<br>PESDO Surigao</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };

  const emailInfo = statusInfo[status] || statusInfo.rejected;
  const text = emailInfo.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: emailInfo.subject,
    html: emailInfo.html,
    text: text
  });
};

// New application notification (for employers)
export const sendNewApplicationEmail = async (email, employerName, jobseekerName, jobTitle) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #005177; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📨 New Application Received</h1>
        </div>
        <div class="content">
          <p>Hi ${employerName},</p>
          <p>You have received a new application for <strong>${jobTitle}</strong> from <strong>${jobseekerName}</strong>.</p>
          <p>Please review the application in your dashboard and take appropriate action.</p>
          <p style="text-align: center;">
            <a href="${getBaseUrl()}/employer" class="button">View Dashboard</a>
          </p>
          <p>Best regards,<br>PESDO Surigao</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: `New Application: ${jobTitle} - ${jobseekerName}`,
    html: html,
    text: text
  });
};

// Employer verification notification
export const sendEmployerVerificationEmail = async (email, employerName, status, rejectionReason = null) => {
  const isApproved = status === 'approved';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: ${isApproved ? '#10b981' : '#005177'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .success { background: #d1f2eb; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isApproved ? '✅ Account Verification Approved' : '⚠️ Account Verification Update'}</h1>
        </div>
        <div class="content">
          <p>Hi ${employerName},</p>
          ${isApproved 
            ? `<div class="success">
                 <p><strong>Great news!</strong> Your employer account has been <strong>APPROVED</strong> and verified by PESDO.</p>
                 <p>You can now:</p>
                 <ul>
                   <li>Post job vacancies</li>
                   <li>Review applications from jobseekers</li>
                   <li>Manage your job postings</li>
                 </ul>
               </div>
               <p>Start by posting your first job vacancy and connecting with qualified candidates.</p>`
            : `<div class="warning">
                 <p>Your employer account verification has been <strong>REJECTED</strong>.</p>
                 ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : '<p>Please check your dashboard for more details.</p>'}
               </div>
               <p>If you believe this is an error or have additional documentation, please contact PESDO support or resubmit your verification documents.</p>`
          }
          <p style="text-align: center;">
            <a href="${getBaseUrl()}/employer" class="button">View Dashboard</a>
          </p>
          <p>Best regards,<br>PESDO Surigao Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: isApproved 
      ? `✅ Account Verification Approved - PESDO Surigao` 
      : `⚠️ Account Verification Update - PESDO Surigao`,
    html: html,
    text: text
  });
};

// Job approval notification (for employers)
export const sendJobApprovalEmail = async (email, employerName, jobTitle, status) => {
  const isApproved = status === 'approved';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: ${isApproved ? '#10b981' : '#005177'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isApproved ? '✅ Job Vacancy Approved' : '📋 Job Vacancy Update'}</h1>
        </div>
        <div class="content">
          <p>Hi ${employerName},</p>
          ${isApproved 
            ? `<p>Your job vacancy "<strong>${jobTitle}</strong>" has been <strong>APPROVED</strong> and is now live on the PESDO platform!</p>
               <p>Jobseekers can now view and apply to this position. You will receive notifications when applications are submitted.</p>`
            : `<p>Update on your job vacancy "<strong>${jobTitle}</strong>": ${status}.</p>
               <p>Please check your dashboard for more details.</p>`
          }
          <p style="text-align: center;">
            <a href="${getBaseUrl()}/employer" class="button">View Dashboard</a>
          </p>
          <p>Best regards,<br>PESDO Surigao</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: isApproved 
      ? `✅ Job Vacancy Approved: ${jobTitle}` 
      : `Job Vacancy Update: ${jobTitle}`,
    html: html,
    text: text
  });
};

// Email confirmation (for new signups)
export const sendConfirmationEmail = async (email, userName, confirmationLink, userType = 'user') => {
  const userTypeLabel = userType === 'jobseeker' ? 'Jobseeker' : userType === 'employer' ? 'Employer' : 'User';
  const baseUrl = getBaseUrl();
  const dashboardUrl = userType === 'jobseeker' 
    ? `${baseUrl}/jobseeker`
    : userType === 'employer'
    ? `${baseUrl}/employer`
    : baseUrl;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #005177; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .link-fallback { word-break: break-all; color: #005177; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Confirm Your Email Address</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>Thank you for registering with PESDO Surigao! Please confirm your email address to complete your ${userTypeLabel.toLowerCase()} account setup.</p>
          <p>Click the button below to verify your email:</p>
          <p style="text-align: center;">
            <a href="${confirmationLink}" class="button">Confirm Email Address</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p class="link-fallback">${confirmationLink}</p>
          <p><strong>This link will expire in 24 hours.</strong></p>
          <p>If you didn't create an account with PESDO Surigao, please ignore this email.</p>
          <p>Best regards,<br>PESDO Surigao Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: `Confirm Your Email - PESDO Surigao`,
    html: html,
    text: text
  });
};

// Password reset email
export const sendPasswordResetEmail = async (email, userName, resetLink) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .link-fallback { word-break: break-all; color: #005177; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>We received a request to reset your password for your PESDO Surigao account.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p class="link-fallback">${resetLink}</p>
          <div class="warning">
            <p><strong>⚠️ Security Notice:</strong></p>
            <ul>
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Your password will remain unchanged if you don't click the link</li>
            </ul>
          </div>
          <p>Best regards,<br>PESDO Surigao Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: `Reset Your Password - PESDO Surigao`,
    html: html,
    text: text
  });
};

// Welcome email
export const sendWelcomeEmail = async (email, userName, userType) => {
  const userTypeLabel = userType === 'jobseeker' ? 'Jobseeker' : userType === 'employer' ? 'Employer' : 'User';
  const baseUrl = getBaseUrl();
  const dashboardUrl = userType === 'jobseeker' 
    ? `${baseUrl}/jobseeker`
    : userType === 'employer'
    ? `${baseUrl}/employer`
    : baseUrl;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #005177; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to PESDO Surigao!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Welcome to PESDO Surigao! Your ${userTypeLabel.toLowerCase()} account has been successfully created.</p>
          <p>You can now start using our platform to ${userType === 'jobseeker' ? 'browse and apply for job opportunities' : userType === 'employer' ? 'post job vacancies and find qualified candidates' : 'access our services'}.</p>
          <p style="text-align: center;">
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </p>
          <p>If you have any questions, feel free to contact us.</p>
          <p>Best regards,<br>PESDO Surigao Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: `Welcome to PESDO Surigao, ${userName}!`,
    html: html,
    text: text
  });
};

// New job vacancy submission notification (for admins)
export const sendNewJobSubmissionEmail = async (email, adminName, jobTitle, employerName, companyName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #005177, #0079a1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #005177; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 New Job Vacancy Pending Review</h1>
        </div>
        <div class="content">
          <p>Hi ${adminName},</p>
          <p>A new job vacancy has been submitted and requires your review.</p>
          <div class="info-box">
            <p><strong>Job Title:</strong> ${jobTitle}</p>
            <p><strong>Employer:</strong> ${employerName}${companyName ? ` (${companyName})` : ''}</p>
            <p><strong>Status:</strong> Pending Approval</p>
          </div>
          <p>Please review the job vacancy details and take appropriate action (approve or reject).</p>
          <p style="text-align: center;">
            <a href="${getAdminUrl()}/jobs" class="button">Review Job Vacancy</a>
          </p>
          <p>Best regards,<br>PESDO Surigao Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return await sendEmail({ 
    to: email, 
    subject: `📋 New Job Vacancy Pending Review: ${jobTitle}`,
    html: html,
    text: text
  });
};

