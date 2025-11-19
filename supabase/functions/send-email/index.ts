// deno-lint-ignore-file no-explicit-any
// Minimal Supabase Edge Function to send transactional emails via Brevo API.
// Reads BREVO_API_KEY from environment. Expects JSON body: { to, subject, html }.
// Optional: { cc, bcc, text, senderName }
// Note: We declare Deno for local linting; Supabase Edge provides it at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  senderName?: string;
}

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

const SENDER_EMAIL = 'no-reply@pesdosurigao.online';

Deno.serve(async (req) => {
  // Handle CORS preflight requests - MUST return 200 status
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  let payload: SendEmailRequest;
  try {
    payload = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { to, subject, html, text, cc, bcc, senderName } = payload || {};
  if (!to || !subject || !html) return badRequest('Missing required fields: to, subject, html');

  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY is not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const body = {
    sender: { email: SENDER_EMAIL, name: senderName || 'PESDO Surigao' },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
    ...(Array.isArray(cc) && cc.length ? { cc: cc.map((e) => ({ email: e })) } : {}),
    ...(Array.isArray(bcc) && bcc.length ? { bcc: bcc.map((e) => ({ email: e })) } : {}),
  };

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
    return new Response(JSON.stringify({ error: 'Failed to send email', provider: errText }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const data = await res.json().catch(() => ({}));
  return ok({ success: true, provider: data });
});
