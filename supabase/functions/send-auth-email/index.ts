// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: Send Auth Emails via Brevo API
// Handles email confirmation and password reset emails
//
// Deploy: npx supabase functions deploy send-auth-email
//
// Set secrets:
// supabase secrets set BREVO_API_KEY=your_api_key_here
//
declare const Deno: any;

interface SendAuthEmailRequest {
  type: 'confirmation' | 'password_reset';
  to: string;
  userName?: string;
  link: string;
  userType?: string;
}

const SENDER_EMAIL = 'no-reply@pesdosurigao.online';

function badRequest(message: string, details?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, details }), {
    status: 400,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function getEmailTemplate(type: string, userName: string, link: string, userType: string = 'user'): { subject: string; html: string } {
  const userTypeLabel = userType === 'jobseeker' ? 'Jobseeker' : userType === 'employer' ? 'Employer' : 'User';
  const baseUrl = Deno.env.get('REACT_APP_BASE_URL') || 'https://pesdosurigao.online';
  
  if (type === 'confirmation') {
    return {
      subject: 'Confirm Your Email - PESDO Surigao',
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
                <a href="${link}" class="button">Confirm Email Address</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p class="link-fallback">${link}</p>
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
      `
    };
  } else {
    return {
      subject: 'Reset Your Password - PESDO Surigao',
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
                <a href="${link}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p class="link-fallback">${link}</p>
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
      `
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  let payload: SendAuthEmailRequest;
  try {
    payload = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { type, to, userName, link, userType } = payload || {};
  if (!type || !to || !link) {
    return badRequest('Missing required fields: type, to, link');
  }

  if (type !== 'confirmation' && type !== 'password_reset') {
    return badRequest('Invalid type. Must be "confirmation" or "password_reset"');
  }

  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY is not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const template = getEmailTemplate(type, userName || 'User', link, userType || 'user');
  const text = template.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  const body = {
    sender: { email: SENDER_EMAIL, name: 'PESDO Surigao' },
    to: [{ email: to }],
    subject: template.subject,
    htmlContent: template.html,
    textContent: text,
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Brevo API error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to send email', provider: errText }), {
        status: 502,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await res.json().catch(() => ({}));
    console.log(`✅ ${type} email sent to ${to}`);
    return ok({ success: true, provider: data, type });
  } catch (error) {
    console.error('Error sending auth email:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email', details: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

