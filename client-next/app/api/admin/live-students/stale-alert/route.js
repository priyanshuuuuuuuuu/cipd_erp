export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { withRole } from '@/lib/middleware';

// ── Server-side cooldown so we don't spam emails ──────────────────────────────
// One alert per COOLDOWN_MS window (30 minutes), reset when data becomes fresh.
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
let lastAlertSentAt = null; // module-level (survives across requests in same process)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function handler(req) {
  try {
    const now = Date.now();

    // Enforce cooldown
    if (lastAlertSentAt && now - lastAlertSentAt < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastAlertSentAt)) / 60000);
      return NextResponse.json({
        skipped: true,
        reason: `Alert already sent. Next alert allowed in ~${remaining} minute(s).`,
      });
    }

    const from = (process.env.EMAIL_FROM || 'cipd@iiitd.ac.in').trim();
    const to   = 'cipd@iiitd.ac.in';

    const subject = 'CiPD 360 - Wi-Fi Scanner Offline: Attendance Not Being Recorded';

    const nowStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'Asia/Kolkata',
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Wi-Fi Scanner Offline</title>
  <style>
    body { margin:0; padding:0; background:#f7f7f7; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; }
    .wrap { max-width:580px; margin:40px auto; background:#ffffff; border-radius:12px; border:1px solid #e0e0e0; overflow:hidden; }
    .hero { background:#1a1a1a; padding:32px 36px; }
    .hero h1 { margin:0; color:#ffffff; font-size:22px; font-weight:700; }
    .hero p  { margin:6px 0 0; color:#999999; font-size:13px; }
    .body    { padding:30px 36px; }
    .alert-box { background:#fff3cd; border:1px solid #ffc107; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
    .alert-box p { margin:0; font-size:14px; color:#856404; font-weight:600; }
    .body p  { margin:0 0 16px; font-size:14px; color:#333333; line-height:1.6; }
    .steps   { background:#f7f7f7; border-radius:8px; padding:18px 22px; margin:0 0 24px; }
    .steps ol { margin:0; padding-left:20px; }
    .steps li { font-size:14px; color:#1a1a1a; line-height:1.8; font-weight:500; }
    .footer  { background:#f7f7f7; border-top:1px solid #e0e0e0; padding:20px 36px; text-align:center; }
    .footer p { margin:0; font-size:11px; color:#aaaaaa; }
    .timestamp { font-size:12px; color:#888888; margin-top:8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Wi-Fi Scanner Offline</h1>
      <p>Automated alert from CiPD 360 Attendance System</p>
    </div>
    <div class="body">
      <div class="alert-box">
        <p>No new Wi-Fi snapshot has been received for more than 10 minutes. Attendance is currently NOT being recorded.</p>
      </div>
      <p>The router has been switched off due to which attendance is not being recorded, please do the following:</p>
      <div class="steps">
        <ol>
          <li>Make sure router is on and Ethernet cable connected to CPU</li>
          <li>Restart the Computer</li>
        </ol>
      </div>
      <p class="timestamp">Alert triggered at: ${nowStr} IST</p>
    </div>
    <div class="footer">
      <p>Automated notification &mdash; do not reply &nbsp;&middot;&nbsp; CiPD 360, IIIT Delhi</p>
    </div>
  </div>
</body>
</html>`;

    const text = [
      'Wi-Fi Scanner Offline — Attendance Not Being Recorded',
      '',
      'The router has been switched off due to which attendance is not being recorded, please do the following:',
      '',
      '1. Make sure router is on and Ethernet cable connected to CPU',
      '2. Restart the Computer',
      '',
      `Alert triggered at: ${nowStr} IST`,
      '',
      '— CiPD 360 Automated Alert, IIIT Delhi',
    ].join('\n');

    await transporter.sendMail({
      from: `"CiPD 360 Alert" <${from}>`,
      to,
      subject,
      text,
      html,
    });

    lastAlertSentAt = now;

    console.log(`[stale-alert] Alert email sent to ${to} at ${new Date().toISOString()}`);

    return NextResponse.json({ sent: true, to, sentAt: new Date().toISOString() });
  } catch (err) {
    console.error('[stale-alert] Failed to send alert email:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
