import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ── Design tokens ────────────────────────────────────────────────────────────
const BRAND   = '#3B2D82';
const ACCENT  = '#00A5A0';
const TEXT    = '#1a1a2e';
const MUTED   = '#6b7280';
const BORDER  = '#e5e7eb';
const BG_CARD = '#f9fafb';

// ── Shell wrapper ─────────────────────────────────────────────────────────────
function shell(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

        <!-- Wordmark -->
        <tr>
          <td style="padding-bottom:24px;text-align:center;">
            <div style="display:inline-block;border:2px solid ${BRAND};border-radius:6px;padding:6px 14px;">
              <span style="font-size:13px;font-weight:800;letter-spacing:3px;color:${BRAND};text-transform:uppercase;">CIPD&nbsp;360</span>
            </div>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:12px;border:1px solid ${BORDER};overflow:hidden;">
            <!-- Accent bar -->
            <div style="height:4px;background:linear-gradient(90deg,${BRAND},${ACCENT});"></div>

            <!-- Body -->
            <div style="padding:36px 40px 40px;">
              ${content}
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;letter-spacing:0.3px;">
              Centre for Intelligent Product Development &nbsp;&middot;&nbsp; IIIT Delhi
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">
              This is an automated message — please do not reply.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const divider = `<div style="height:1px;background:${BORDER};margin:24px 0;"></div>`;

// ── Single session block ──────────────────────────────────────────────────────
function sessionBlock(s) {
  const date = s.session_date
    ? new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const start  = s.start_time ? s.start_time.slice(0, 5) : '—';
  const end    = s.end_time   ? s.end_time.slice(0, 5)   : '—';
  const course = s.courses?.name || '—';
  const venue  = s.venues?.name  || 'TBA';
  const faculty = s.faculty?.users
    ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}`
    : 'TBA';
  const title  = s.title || course;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:8px;margin-bottom:12px;">
    <tr>
      <td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${TEXT};">${title}</p>
        <p style="margin:0 0 14px;font-size:12px;color:${MUTED};font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">${course}</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="width:50%;vertical-align:top;padding-bottom:8px;">
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Date</p>
              <p style="margin:0;font-size:13px;font-weight:600;color:${TEXT};">${date}</p>
            </td>
            <td style="width:50%;vertical-align:top;padding-bottom:8px;">
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Time</p>
              <p style="margin:0;font-size:13px;font-weight:600;color:${TEXT};font-variant-numeric:tabular-nums;">${start} &ndash; ${end}</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Venue</p>
              <p style="margin:0;font-size:13px;font-weight:600;color:${TEXT};">${venue}</p>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Faculty</p>
              <p style="margin:0;font-size:13px;font-weight:600;color:${TEXT};">${faculty}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// ── 1. Weekly Schedule Email ────────────────────────────────────────────────
export async function sendWeeklyScheduleEmail(studentEmail, studentName, sessions) {
  if (!sessions || sessions.length === 0) return;

  const sessionBlocks = sessions.map(sessionBlock).join('');
  const firstName = studentName.split(' ')[0] || studentName;
  const count = sessions.length;

  const content = `
    <p style="margin:0 0 6px;font-size:24px;font-weight:800;color:${TEXT};">
      Your schedule is updated
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:${MUTED};line-height:1.6;">
      Hi ${firstName}, here are your upcoming classes for this week.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
      <tr>
        <td>
          <p style="margin:0;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">
            ${count} upcoming class${count !== 1 ? 'es' : ''}
          </p>
        </td>
      </tr>
    </table>

    ${sessionBlocks}

    ${divider}

    <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.7;">
      Log in to the
      <a href="http://localhost:3000" style="color:${BRAND};font-weight:600;text-decoration:none;">CiPD portal</a>
      to view attendance records, submit feedback, and access learning materials.
    </p>`;

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Your weekly schedule — CiPD 360`,
    html: shell(content),
  });
}

// ── 2. Day-Before Reminder Email ────────────────────────────────────────────
export async function sendDayBeforeReminderEmail(studentEmail, studentName, session) {
  const date = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—';
  const start  = session.start_time ? session.start_time.slice(0, 5) : '—';
  const end    = session.end_time   ? session.end_time.slice(0, 5)   : '—';
  const course = session.courses?.name || '—';
  const venue  = session.venues?.name  || 'TBA';
  const faculty = session.faculty?.users
    ? `${session.faculty.users.first_name} ${session.faculty.users.last_name}`
    : 'TBA';
  const title  = session.title || course;
  const firstName = studentName.split(' ')[0] || studentName;

  const content = `
    <p style="margin:0 0 6px;font-size:24px;font-weight:800;color:${TEXT};">
      Class reminder
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:${MUTED};line-height:1.6;">
      Hi ${firstName}, you have a class scheduled for tomorrow.
    </p>

    <!-- Highlight block -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${BRAND};border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#ffffff;">${title}</p>
          <p style="margin:0 0 20px;font-size:12px;color:rgba(255,255,255,0.6);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">${course}</p>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:50%;">
                <p style="margin:0 0 2px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px;">Date</p>
                <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${date}</p>
              </td>
              <td style="width:50%;">
                <p style="margin:0 0 2px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px;">Time</p>
                <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${start} &ndash; ${end}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Details row -->
    <table width="100%" cellpadding="12" cellspacing="0" role="presentation"
      style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:8px;font-size:13px;margin-bottom:24px;">
      <tr style="border-bottom:1px solid ${BORDER};">
        <td style="width:40%;padding:12px 16px;">
          <p style="margin:0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Venue</p>
        </td>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${TEXT};">${venue}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Faculty</p>
        </td>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${TEXT};">${faculty}</p>
        </td>
      </tr>
    </table>

    ${divider}

    <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.7;">
      Attendance is recorded automatically via Wi-Fi. Ensure your device's MAC address is registered on the
      <a href="http://localhost:3000/dashboard" style="color:${BRAND};font-weight:600;text-decoration:none;">CiPD portal</a>
      before your class.
    </p>`;

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Class tomorrow: ${title}`,
    html: shell(content),
  });
}

// ── Connection test ───────────────────────────────────────────────────────────
export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
