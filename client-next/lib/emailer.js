import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ── Design tokens (Lumina Academic palette) ───────────────────────────────────
const PRIMARY   = '#6355F1';   // Purple (primary)
const SECONDARY = '#8B2CF5';   // Violet (secondary)
const TERTIARY  = '#13B88A';   // Teal green (tertiary)
const TEXT      = '#1a1a2e';
const MUTED     = '#6b7280';
const BORDER    = '#e5e7eb';
const BG        = '#F8FAFC';   // Neutral background

// ── App URL ───────────────────────────────────────────────────────────────────
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cipd-erp-ic24.vercel.app';

// ── Shell wrapper ─────────────────────────────────────────────────────────────
function shell(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>CIPD 360</title>
</head>
<body style="margin:0;padding:0;background:#EBEBF5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#EBEBF5;padding:32px 12px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;">

        <!-- Logo row -->
        <tr>
          <td style="padding-bottom:20px;text-align:center;">
            <img src="${APP_URL}/logo.png" alt="CIPD 360" width="120"
              style="max-width:120px;height:auto;display:block;margin:0 auto;"/>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(99,85,241,0.10);">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 16px 8px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;">
              Centre for Intelligent Product Development &nbsp;&middot;&nbsp; IIIT Delhi
            </p>
            <p style="margin:0 0 8px;font-size:11px;color:#c4c9d4;">
              This is an automated notification — please do not reply.
            </p>
            <p style="margin:0;font-size:10px;color:#d1d5db;">
              &copy; 2026 CiPD 360 Academic ERP
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── CTA Button ────────────────────────────────────────────────────────────────
function ctaButton(label, url) {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr>
      <td style="border-radius:50px;background:linear-gradient(135deg,${PRIMARY} 0%,${SECONDARY} 100%);">
        <a href="${url}"
           style="display:inline-block;padding:14px 40px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:50px;">
          ${label} &nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

// ── Single session card ───────────────────────────────────────────────────────
function sessionBlock(s, isFirst) {
  const date = s.session_date
    ? new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const start   = s.start_time ? s.start_time.slice(0, 5) : '—';
  const end     = s.end_time   ? s.end_time.slice(0, 5)   : '—';
  const course  = s.courses?.name || '—';
  const venue   = s.venues?.name  || 'TBA';
  const faculty = s.faculty?.users
    ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}`
    : 'TBA';
  const title   = s.title || course;

  const nextBadge = isFirst
    ? `<span style="display:inline-block;background:${TERTIARY};color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:6px;">NEXT</span><br/>`
    : '';

  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="border:1px solid ${BORDER};border-radius:14px;margin-bottom:12px;overflow:hidden;background:#fff;">
    <tr>
      <!-- Teal-green left accent -->
      <td style="width:4px;background:${TERTIARY};border-radius:14px 0 0 14px;"></td>
      <td style="padding:16px 18px;">
        ${nextBadge}
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">${course}</p>
        <p style="margin:0 0 12px;font-size:17px;font-weight:800;color:${TEXT};">${title}</p>
        <!-- 2x2 meta grid -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="width:50%;padding-bottom:6px;vertical-align:top;">
              <p style="margin:0;font-size:12px;color:${MUTED};">&#128197;&nbsp; <span style="color:${TEXT};font-weight:600;">${date}</span></p>
            </td>
            <td style="width:50%;padding-bottom:6px;vertical-align:top;">
              <p style="margin:0;font-size:12px;color:${MUTED};">&#128336;&nbsp; <span style="color:${PRIMARY};font-weight:700;">${start} &ndash; ${end}</span></p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0;font-size:12px;color:${MUTED};">&#128205;&nbsp; <span style="color:${TEXT};font-weight:600;">${venue}</span></p>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0;font-size:12px;color:${MUTED};">&#128100;&nbsp; <span style="color:${TEXT};font-weight:600;">${faculty}</span></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// ── .ics Calendar Invite Generator ───────────────────────────────────────────
function generateICS(sessions, studentName) {
  function toICalDate(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-');
    const [hh, mm] = (timeStr || '00:00').split(':');
    return `${y}${m}${d}T${hh}${mm}00`;
  }
  function escapeText(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  const uid_seed = Date.now();

  const events = sessions.map((s, i) => {
    const dtStart = toICalDate(s.session_date, s.start_time);
    const dtEnd   = toICalDate(s.session_date, s.end_time || s.start_time);
    const course  = escapeText(s.courses?.name || '');
    const title   = escapeText(s.title || course);
    const venue   = escapeText(s.venues?.name || 'TBA');
    const faculty = s.faculty?.users
      ? escapeText(`${s.faculty.users.first_name} ${s.faculty.users.last_name}`)
      : 'TBA';
    const desc = `Course: ${course}\\nFaculty: ${faculty}\\nVenue: ${venue}`;

    return [
      'BEGIN:VEVENT',
      `UID:cipd360-${uid_seed}-${i}@cipd.edu`,
      `DTSTAMP:${toICalDate(new Date().toISOString().split('T')[0], new Date().toTimeString().slice(0, 8))}`,
      `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
      `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${venue}`,
      `ORGANIZER;CN=CIPD 360:mailto:${process.env.EMAIL_FROM || 'noreply@cipd.edu'}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CIPD 360//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'X-WR-CALNAME:CIPD 360 Schedule',
    'X-WR-TIMEZONE:Asia/Kolkata',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// ── 1. Weekly Schedule Email ─────────────────────────────────────────────────
export async function sendWeeklyScheduleEmail(studentEmail, studentName, sessions) {
  if (!sessions || sessions.length === 0) return;

  const firstName = studentName.split(' ')[0] || studentName;
  const count     = sessions.length;

  // Sort sessions by date then time
  const sorted = [...sessions].sort((a, b) => {
    const da = (a.session_date || '') + (a.start_time || '');
    const db = (b.session_date || '') + (b.start_time || '');
    return da.localeCompare(db);
  });

  // Find "next" class start time
  const now = new Date();
  const nextSession = sorted.find(s => {
    const d = new Date(`${s.session_date}T${s.start_time || '00:00'}`);
    return d > now;
  });
  const nextTime = nextSession?.start_time ? nextSession.start_time.slice(0, 5) : null;

  const sessionBlocks = sorted.map((s, i) => sessionBlock(s, i === 0 && nextSession)).join('');

  const content = `
    <!-- Hero gradient -->
    <div style="background:linear-gradient(135deg,${PRIMARY} 0%,${SECONDARY} 100%);padding:32px 28px 28px;border-radius:20px 20px 0 0;">
      <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:14px;">&#128197;&nbsp; Upcoming Week</span>
      <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Hi ${firstName}</p>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.78);line-height:1.6;">Here&rsquo;s what&rsquo;s coming up this week.</p>
    </div>

    <!-- Stats + next class strip -->
    <div style="padding:0 20px;">

      <!-- Total classes pill -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="background:${BG};border:1px solid ${BORDER};border-radius:12px;margin:16px 0 10px;">
        <tr>
          <td style="padding:14px 18px;">
            <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">TOTAL CLASSES</p>
            <p style="margin:0;font-size:16px;font-weight:800;color:${TEXT};">&#128218;&nbsp; ${count} Class${count !== 1 ? 'es' : ''} this week</p>
          </td>
        </tr>
      </table>

      ${nextTime ? `
      <!-- Next class banner -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="background:linear-gradient(90deg,${PRIMARY},${SECONDARY});border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 18px;">
            <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:1px;">STARTING NEXT</p>
            <p style="margin:0;font-size:16px;font-weight:800;color:#ffffff;">&#9201;&nbsp; Next: ${nextTime}</p>
          </td>
        </tr>
      </table>
      ` : ''}

      <!-- Section label -->
      <p style="margin:0 0 14px;font-size:15px;font-weight:800;color:${TEXT};">Daily Roadmap</p>

      <!-- Session cards -->
      ${sessionBlocks}

      <!-- CTA -->
      <div style="padding:8px 0 28px;text-align:center;">
        ${ctaButton('View Full Schedule', `${APP_URL}/dashboard`)}
      </div>

    </div>

    <!-- Info footer inside card -->
    <div style="background:${BG};border-top:1px solid ${BORDER};padding:18px 24px;border-radius:0 0 20px 20px;">
      <p style="margin:0 0 6px;font-size:11px;color:${MUTED};text-align:center;font-style:italic;">
        This is an automated notification based on your registered course load.<br/>
        Please maintain 75% attendance for final exam eligibility.
      </p>
      <p style="margin:8px 0 0;text-align:center;">
        <a href="${APP_URL}/dashboard" style="font-size:11px;color:${PRIMARY};text-decoration:none;font-weight:600;">Dashboard</a>
        &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/attendance" style="font-size:11px;color:${PRIMARY};text-decoration:none;font-weight:600;">Attendance</a>
        &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/feedback" style="font-size:11px;color:${PRIMARY};text-decoration:none;font-weight:600;">Feedback</a>
      </p>
    </div>`;

  const icsContent = generateICS(sorted, studentName);

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Your weekly schedule — CiPD 360`,
    html: shell(content),
    attachments: [
      {
        filename: 'CIPD360-Schedule.ics',
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ],
  });
}

// ── 2. Day-Before Reminder Email ─────────────────────────────────────────────
export async function sendDayBeforeReminderEmail(studentEmail, studentName, session) {
  const date    = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—';
  const start   = session.start_time ? session.start_time.slice(0, 5) : '—';
  const end     = session.end_time   ? session.end_time.slice(0, 5)   : '—';
  const course  = session.courses?.name || '—';
  const venue   = session.venues?.name  || 'TBA';
  const faculty = session.faculty?.users
    ? `${session.faculty.users.first_name} ${session.faculty.users.last_name}`
    : 'TBA';
  const title     = session.title || course;
  const firstName = studentName.split(' ')[0] || studentName;

  const content = `
    <!-- Hero -->
    <div style="background:linear-gradient(135deg,${PRIMARY} 0%,${SECONDARY} 100%);padding:32px 28px 28px;border-radius:20px 20px 0 0;">
      <span style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:14px;">&#9201;&nbsp; Class Reminder</span>
      <p style="margin:0 0 6px;font-size:26px;font-weight:800;color:#ffffff;">Hi ${firstName}</p>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.78);">Don&rsquo;t forget &mdash; you have a class tomorrow!</p>
    </div>

    <div style="padding:20px 20px 0;">
      <!-- Session card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="border:1px solid ${BORDER};border-radius:14px;overflow:hidden;background:#fff;margin-bottom:16px;">
        <tr>
          <td style="width:4px;background:${TERTIARY};"></td>
          <td style="padding:18px 18px;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">${course}</p>
            <p style="margin:0 0 14px;font-size:19px;font-weight:800;color:${TEXT};">${title}</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="width:50%;padding-bottom:8px;vertical-align:top;">
                  <p style="margin:0;font-size:12px;color:${MUTED};">&#128197;&nbsp; <span style="color:${TEXT};font-weight:600;">${date}</span></p>
                </td>
                <td style="width:50%;padding-bottom:8px;vertical-align:top;">
                  <p style="margin:0;font-size:12px;color:${MUTED};">&#128336;&nbsp; <span style="color:${PRIMARY};font-weight:700;">${start} &ndash; ${end}</span></p>
                </td>
              </tr>
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0;font-size:12px;color:${MUTED};">&#128205;&nbsp; <span style="color:${TEXT};font-weight:600;">${venue}</span></p>
                </td>
                <td style="vertical-align:top;">
                  <p style="margin:0;font-size:12px;color:${MUTED};">&#128100;&nbsp; <span style="color:${TEXT};font-weight:600;">${faculty}</span></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="padding:4px 0 28px;text-align:center;">
        ${ctaButton('Open Dashboard', `${APP_URL}/dashboard`)}
      </div>
    </div>

    <!-- Info footer inside card -->
    <div style="background:${BG};border-top:1px solid ${BORDER};padding:16px 24px;border-radius:0 0 20px 20px;">
      <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;font-style:italic;">
        &#128274;&nbsp; Attendance is auto-recorded via Wi-Fi. Ensure your MAC address is registered on the portal.
      </p>
    </div>`;

  const icsContent = generateICS([session], studentName);

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Class tomorrow: ${title}`,
    html: shell(content),
    attachments: [
      {
        filename: 'CIPD360-ClassReminder.ics',
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ],
  });
}

// ── 3. General / Custom Notification Email ───────────────────────────────────
export async function sendGeneralNotificationEmail(studentEmail, studentName, title, message, type) {
  const firstName = (studentName || '').split(' ')[0] || 'Student';

  // Pick icon + accent colour based on type
  const typeConfig = {
    class_reminder:     { emoji: '🔔', accent: PRIMARY,   label: 'Class Reminder' },
    feedback_reminder:  { emoji: '📝', accent: '#e11d48', label: 'Feedback Reminder' },
    schedule_change:    { emoji: '📅', accent: '#d97706', label: 'Schedule Update' },
    attendance_warning: { emoji: '⚠️', accent: '#dc2626', label: 'Attendance Warning' },
    general:            { emoji: '📢', accent: TERTIARY,  label: 'Announcement' },
  };
  const cfg = typeConfig[type] || typeConfig.general;

  const content = `
    <!-- Coloured type banner -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${cfg.accent};border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1.5px;">
            ${cfg.emoji}&nbsp; ${cfg.label}
          </p>
        </td>
      </tr>
    </table>

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:${TEXT};">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:13px;color:${MUTED};line-height:1.7;">
      You have a new notification from CiPD 360.
    </p>

    <!-- Message card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${BG};border:1px solid ${BORDER};border-left:4px solid ${cfg.accent};border-radius:8px;margin-bottom:28px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${TEXT};">${title || cfg.label}</p>
          <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.7;">${message}</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
      <tr>
        <td style="border-radius:50px;background:linear-gradient(135deg,${PRIMARY} 0%,${SECONDARY} 100%);">
          <a href="${APP_URL}/dashboard"
             style="display:inline-block;padding:13px 36px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;">
            View Dashboard &nbsp;&rarr;
          </a>
        </td>
      </tr>
    </table>`;

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `${cfg.emoji} ${title || cfg.label} — CiPD 360`,
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
