/**
 * ShieldCall AI — Terms of Service Edge Function
 *
 * Serves a full Terms of Service HTML page at:
 *   https://<project>.supabase.co/functions/v1/terms
 *
 * This satisfies the App Store / Play Store requirement for a hosted,
 * publicly accessible Terms of Service / EULA URL.
 */

const EFFECTIVE_DATE = '2026-07-25';
const SUPPORT_EMAIL = 'legal@shieldcallai.com';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — ShieldCall AI</title>
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
      border-left: 3px solid #F59E0B;
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

    <h1>Terms of Service</h1>
    <p class="effective">Effective Date: ${EFFECTIVE_DATE}</p>

    <div class="highlight">
      <p><strong>Important:</strong> By using ShieldCall AI, you agree to these terms. Please read them carefully, especially Section 7 (Call Recording Laws) and Section 11 (Limitation of Liability).</p>
    </div>

    <h2>1. Acceptance of Terms</h2>
    <p>By downloading, installing, or using the ShieldCall AI application ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.</p>
    <p>These Terms constitute a legally binding agreement between you and ShieldCall AI ("we," "us," or "our").</p>

    <h2>2. Description of Service</h2>
    <p>ShieldCall AI is a mobile application that provides:</p>
    <ul>
      <li><strong>Real-time call analysis:</strong> Pattern-matching threat detection on call transcripts to identify potential scam calls.</li>
      <li><strong>Ghost Mode:</strong> An AI persona that can answer suspicious calls on your behalf, while you listen silently.</li>
      <li><strong>AI Dialer:</strong> An AI agent that can place calls to handle routine tasks on your behalf.</li>
      <li><strong>Call history and threat analytics:</strong> A personal record of analyzed calls and threat assessments.</li>
    </ul>
    <p>The App is designed to assist you in identifying potentially fraudulent calls. It is a <strong>tool to help inform your decisions</strong>, not a guarantee of protection against fraud.</p>

    <h2>3. Eligibility</h2>
    <p>You must be at least 13 years old (or 16 in the European Union) to use the App. By using the App, you represent and warrant that you meet this age requirement.</p>

    <h2>4. Account Registration</h2>
    <p>To use the App, you must create an account with a valid email address and password. You are responsible for:</p>
    <ul>
      <li>Maintaining the confidentiality of your account credentials.</li>
      <li>All activity that occurs under your account.</li>
      <li>Notifying us immediately of any unauthorized account access at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</li>
    </ul>
    <p>We reserve the right to terminate accounts that violate these Terms.</p>

    <h2>5. Subscription Plans and Billing</h2>
    <p>ShieldCall AI offers free and paid subscription tiers. Paid subscriptions are billed through Apple App Store (iOS) or Google Play Store (Android). By subscribing, you also agree to the terms of the applicable platform.</p>
    <ul>
      <li>Subscriptions automatically renew at the end of each billing period unless cancelled.</li>
      <li>You may cancel your subscription at any time through your platform's subscription settings.</li>
      <li>Refunds are handled in accordance with the Apple App Store or Google Play refund policies.</li>
      <li>We reserve the right to change subscription pricing with reasonable advance notice.</li>
    </ul>

    <h2>6. Acceptable Use</h2>
    <p>You may use the App only for lawful purposes and in accordance with these Terms. You agree not to:</p>
    <ul>
      <li>Use the App to harass, threaten, or defraud any person.</li>
      <li>Use Ghost Mode or the AI Dialer to impersonate another person with intent to deceive.</li>
      <li>Attempt to circumvent, disable, or interfere with the App's security features.</li>
      <li>Use the App in any way that violates applicable local, national, or international laws or regulations.</li>
      <li>Reverse engineer, decompile, or disassemble the App.</li>
    </ul>

    <h2>7. Call Recording and Monitoring Laws</h2>
    <div class="highlight">
      <p><strong>This section is critical.</strong> ShieldCall AI transcribes phone calls to detect scam patterns. In many jurisdictions, you are legally required to obtain the consent of all parties to a call before recording or monitoring it.</p>
    </div>
    <p>In the United States, the federal Electronic Communications Privacy Act (ECPA) and the laws of many individual states (including California, Florida, Illinois, Maryland, Michigan, Montana, Nevada, New Hampshire, Oregon, Pennsylvania, and Washington) require <strong>all-party consent</strong> to record or monitor a phone call.</p>
    <p>Similar laws exist in Canada, the European Union, Australia, and many other countries.</p>
    <p><strong>You are solely responsible for complying with all applicable call recording, monitoring, and wiretapping laws in your jurisdiction.</strong> ShieldCall AI assumes no liability for your failure to comply with such laws.</p>
    <p>If you are unsure about the laws in your jurisdiction, consult a qualified attorney before using the call analysis or transcription features.</p>

    <h2>8. Accuracy and Limitations of Threat Detection</h2>
    <p>ShieldCall AI's threat detection engine uses pattern matching and heuristics to identify potentially suspicious calls. It is <strong>not infallible</strong>. We make no warranty that the App will:</p>
    <ul>
      <li>Correctly identify all scam calls (false negatives may occur).</li>
      <li>Avoid incorrectly flagging legitimate calls (false positives may occur).</li>
      <li>Prevent you from being defrauded in any situation.</li>
    </ul>
    <p>Always use your own judgment when evaluating any phone call. Do not rely solely on the App's threat score to make decisions.</p>

    <h2>9. Intellectual Property</h2>
    <p>All content, features, and functionality of the App — including the SENTINEL™ engine, Ghost Mode architecture, UI design, and trademarks — are the exclusive property of ShieldCall AI and are protected by copyright, trademark, and other intellectual property laws.</p>
    <p>You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes in accordance with these Terms.</p>

    <h2>10. Privacy</h2>
    <p>Your use of the App is also governed by our <a href="/functions/v1/privacy">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

    <h2>11. Limitation of Liability</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SHIELDCALL AI AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:</p>
    <ul>
      <li>Financial losses resulting from scam calls, whether or not the App detected a threat.</li>
      <li>Legal liability arising from your use of call recording or monitoring features.</li>
      <li>Loss of data, business interruption, or loss of profits.</li>
      <li>Any failure, delay, or interruption of the App or its features.</li>
    </ul>
    <p>IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE AMOUNT YOU PAID FOR THE APP IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.</p>

    <h2>12. Disclaimer of Warranties</h2>
    <p>THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.</p>

    <h2>13. Termination</h2>
    <p>We may suspend or terminate your account at any time for violation of these Terms, without prior notice. You may terminate your account at any time via Settings → Delete My Data in the App.</p>
    <p>Upon termination, your right to use the App ceases immediately and we will delete your account data in accordance with our Privacy Policy.</p>

    <h2>14. Governing Law</h2>
    <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Delaware.</p>

    <h2>15. Changes to Terms</h2>
    <p>We may update these Terms from time to time. We will notify you of material changes via the App or email. Continued use of the App after changes constitutes your acceptance of the updated Terms.</p>

    <h2>16. Contact</h2>
    <p>For questions about these Terms, contact us at: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>

    <footer>
      <p>© ${new Date().getFullYear()} ShieldCall AI. All rights reserved.</p>
      <p><a href="/functions/v1/privacy">Privacy Policy</a> · <a href="mailto:${SUPPORT_EMAIL}">Contact</a></p>
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
