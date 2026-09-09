/**
 * ShieldCall AI — Support Page Edge Function
 *
 * Serves a support/contact page at:
 *   https://<project>.supabase.co/functions/v1/support
 */

const SUPPORT_EMAIL = 'support@shieldcallai.com';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Support — ShieldCall AI</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #060E1E;
      color: #E2E8F0;
      margin: 0;
      padding: 0;
      line-height: 1.7;
    }
    .container { max-width: 640px; margin: 0 auto; padding: 48px 24px 80px; text-align: center; }
    .logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 48px; }
    .logo-icon { font-size: 28px; }
    .logo-name { font-size: 20px; font-weight: 900; color: #00B4D8; letter-spacing: 2px; }
    h1 { font-size: 36px; font-weight: 900; color: #FFFFFF; margin: 0 0 16px; }
    p { font-size: 16px; color: #94A3B8; margin: 0 0 16px; }
    .card {
      background: #0D2137;
      border: 1px solid #1E3A5F;
      border-radius: 12px;
      padding: 28px;
      margin: 32px 0;
      text-align: left;
    }
    .card h2 { font-size: 16px; font-weight: 700; color: #00B4D8; margin: 0 0 8px; }
    .card p { margin: 0; font-size: 14px; }
    .btn {
      display: inline-block;
      background: #00B4D8;
      color: #060E1E;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 50px;
      text-decoration: none;
      margin-top: 24px;
    }
    a { color: #00B4D8; }
    footer { margin-top: 60px; font-size: 13px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="logo-icon">🛡️</span>
      <span class="logo-name">SHIELDCALL AI</span>
    </div>

    <h1>Support</h1>
    <p>We're here to help. Reach out and we'll get back to you within 1 business day.</p>

    <a class="btn" href="mailto:${SUPPORT_EMAIL}">Email Support</a>

    <div class="card">
      <h2>🚨 Reporting a Bug</h2>
      <p>Please describe what happened, what you expected, and your device model and iOS/Android version. Screenshots help!</p>
    </div>

    <div class="card">
      <h2>💳 Billing & Subscriptions</h2>
      <p>For billing issues, subscription changes, or refund requests, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. Refunds are processed through the App Store or Google Play.</p>
    </div>

    <div class="card">
      <h2>🔒 Privacy & Data Deletion</h2>
      <p>You can delete your account and all data directly in the app via <strong>Settings → Delete My Data</strong>. For additional data requests, email <a href="mailto:privacy@shieldcallai.com">privacy@shieldcallai.com</a>.</p>
    </div>

    <div class="card">
      <h2>⚖️ Legal Inquiries</h2>
      <p>For legal, law enforcement, or compliance matters, contact <a href="mailto:legal@shieldcallai.com">legal@shieldcallai.com</a>.</p>
    </div>

    <footer>
      <p><a href="/functions/v1/privacy">Privacy Policy</a> · <a href="/functions/v1/terms">Terms of Service</a></p>
      <p>© ${new Date().getFullYear()} ShieldCall AI</p>
    </footer>
  </div>
</body>
</html>`;

Deno.serve((_req: Request) => {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
