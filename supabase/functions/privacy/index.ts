/**
 * ShieldCall AI — Privacy Policy Edge Function
 *
 * Serves a full Privacy Policy HTML page at:
 *   https://<project>.supabase.co/functions/v1/privacy
 *
 * This satisfies the App Store / Play Store requirement for a hosted,
 * publicly accessible privacy policy URL.
 */

const EFFECTIVE_DATE = '2026-07-25';
const SUPPORT_EMAIL = 'privacy@shieldcallai.com';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — ShieldCall AI</title>
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
    .container { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
    .logo-icon { font-size: 28px; }
    .logo-name { font-size: 20px; font-weight: 900; color: #00B4D8; letter-spacing: 2px; }
    h1 { font-size: 32px; font-weight: 900; color: #FFFFFF; margin: 0 0 8px; }
    .effective { font-size: 13px; color: #64748B; margin-bottom: 40px; }
    h2 { font-size: 18px; font-weight: 700; color: #00B4D8; margin: 40px 0 12px; border-bottom: 1px solid #1E3A5F; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #94A3B8; margin: 0 0 14px; }
    ul { padding-left: 20px; margin: 0 0 14px; }
    li { margin-bottom: 6px; }
    strong { color: #E2E8F0; }
    .highlight {
      background: #0D2137;
      border: 1px solid #1E3A5F;
      border-left: 3px solid #00B4D8;
      border-radius: 6px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .highlight p { margin: 0; color: #CBD5E1; }
    a { color: #00B4D8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #1E3A5F; font-size: 13px; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="logo-icon">🛡️</span>
      <span class="logo-name">SHIELDCALL AI</span>
    </div>

    <h1>Privacy Policy</h1>
    <p class="effective">Effective Date: ${EFFECTIVE_DATE}</p>

    <div class="highlight">
      <p><strong>The short version:</strong> ShieldCall AI transcribes calls via a secure cloud service to detect scams. We never sell your data. You can delete your account and all your data at any time.</p>
    </div>

    <h2>1. Who We Are</h2>
    <p>ShieldCall AI ("we," "our," or "us") operates the ShieldCall AI mobile application. We are committed to protecting your personal information and being transparent about how we use it.</p>
    <p>For privacy-related inquiries, contact us at: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>

    <h2>2. What Data We Collect</h2>
    <p>We collect only the data necessary to provide call protection services:</p>
    <ul>
      <li><strong>Account Information:</strong> Your full name, email address, and phone number when you register.</li>
      <li><strong>Call Metadata:</strong> Caller name, caller number, call duration, threat assessment scores, and call timestamps. This data is stored in your account.</li>
      <li><strong>Call Transcripts (temporary):</strong> When you enable Live Call Analysis, audio from your microphone is sent to a secure cloud speech recognition service (Deepgram) for transcription. The resulting text is analyzed for scam patterns. <strong>We do not store raw audio recordings.</strong> Transcripts used for AI analysis are not retained beyond the active call session.</li>
      <li><strong>Ghost Mode Conversation Text:</strong> If Ghost Mode is active, anonymized call transcript text is sent to an AI provider to generate responses. This text is not stored after the session ends.</li>
      <li><strong>Device Push Token:</strong> To deliver threat alert notifications.</li>
      <li><strong>Contacts (on-device only):</strong> With your permission, we access your contacts to identify callers. Contact data is never uploaded to our servers.</li>
    </ul>

    <h2>3. How We Use Your Data</h2>
    <ul>
      <li>To provide real-time scam detection and caller threat scoring.</li>
      <li>To power Ghost Mode AI responses during active calls.</li>
      <li>To show you your personal call history and threat analytics.</li>
      <li>To send you notifications about high-risk calls.</li>
      <li>To maintain and improve the service.</li>
    </ul>
    <p>We do <strong>not</strong> use your data for advertising, sell your data to third parties, or share your data with anyone except as described in Section 5.</p>

    <h2>4. Cloud Service Providers</h2>
    <p>We use the following third-party services to process data on your behalf:</p>
    <ul>
      <li><strong>Supabase</strong> (database and authentication) — <a href="https://supabase.com/privacy" target="_blank">Privacy Policy</a></li>
      <li><strong>Deepgram</strong> (speech-to-text transcription) — <a href="https://deepgram.com/privacy" target="_blank">Privacy Policy</a></li>
      <li><strong>Google Gemini / AI Provider</strong> (Ghost Mode AI responses) — processing is limited to anonymized transcript text during active sessions only.</li>
    </ul>
    <p>These providers are contractually required to protect your data and may not use it for their own purposes.</p>

    <h2>5. Data Sharing</h2>
    <p>We do not sell, rent, or share your personal information with third parties except:</p>
    <ul>
      <li>With the cloud service providers listed in Section 4, as required to operate the app.</li>
      <li>If required by law, legal process, or a valid government request.</li>
      <li>To protect the rights, property, or safety of ShieldCall AI, our users, or the public.</li>
    </ul>

    <h2>6. Your Rights (GDPR / CCPA)</h2>
    <p>Depending on your jurisdiction, you may have the right to:</p>
    <ul>
      <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
      <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
      <li><strong>Deletion:</strong> Request deletion of your account and all associated data. You can do this directly in the app via Settings → Delete My Data, or by emailing us.</li>
      <li><strong>Portability:</strong> Request your call records in a machine-readable format.</li>
      <li><strong>Opt-out:</strong> Opt out of non-essential data processing at any time.</li>
    </ul>
    <p>To exercise any of these rights, contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

    <h2>7. Data Retention</h2>
    <ul>
      <li><strong>Account data:</strong> Retained until you delete your account.</li>
      <li><strong>Call records:</strong> Retained in your account until you delete them or delete your account.</li>
      <li><strong>Audio data:</strong> Never stored — processed in real-time and discarded.</li>
      <li><strong>Ghost Mode transcripts:</strong> Not retained beyond the active call session.</li>
    </ul>

    <h2>8. Data Security</h2>
    <p>We implement industry-standard security measures including TLS encryption for all data in transit, row-level security on our database (only you can access your own records), and no storage of raw audio or sensitive call content beyond the active session.</p>

    <h2>9. Children's Privacy</h2>
    <p>ShieldCall AI is not directed to children under 13 (or 16 in the EU). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, contact us and we will delete it promptly.</p>

    <h2>10. Call Recording Consent</h2>
    <p>ShieldCall AI transcribes your calls to detect scam patterns. In many jurisdictions (including California, Florida, Illinois, and other US states, as well as many countries), you are legally required to inform all parties on a call that the call may be monitored or recorded. <strong>It is your responsibility to comply with the call recording and monitoring laws that apply in your location.</strong></p>

    <h2>11. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of material changes via the app or by email. The "Effective Date" at the top of this page indicates when the policy was last updated. Continued use of the app after changes constitutes acceptance of the updated policy.</p>

    <h2>12. Contact Us</h2>
    <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
    <p><strong>ShieldCall AI Privacy Team</strong><br /><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>

    <footer>
      <p>© ${new Date().getFullYear()} ShieldCall AI. All rights reserved.</p>
      <p><a href="/functions/v1/terms">Terms of Service</a> · <a href="mailto:${SUPPORT_EMAIL}">Contact</a></p>
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
