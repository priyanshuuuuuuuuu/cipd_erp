import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
});
// Commit

// ── Design tokens (monochromatic slate) ───────────────────────────────────────
const INK       = '#0D0D0D';   // near-black headings
const DARK      = '#1A1A1A';   // hero bg
const MID       = '#2C2C2C';   // card accents
const SUBTLE    = '#4A4A4A';   // body text
const MUTED     = '#767676';   // secondary text
const BORDER    = '#E0E0E0';
const RULE      = '#F0F0F0';
const BG        = '#F7F7F7';   // page background
const CARD_BG   = '#FFFFFF';
const ACCENT    = '#1A1A1A';   // pill / badge background (dark)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cipd-erp-ic24.vercel.app';

// ── Shell ─────────────────────────────────────────────────────────────────────
function shell(content, previewText = '') {
  const preview = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F7F7F7;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="format-detection" content="telephone=no"/>
  <title>CiPD 360</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');
    * { box-sizing:border-box; }
    body { margin:0; padding:0; width:100%; -webkit-font-smoothing:antialiased; background-color:${BG}; }
    a { color:inherit; text-decoration:none; }
    img { border:0; display:block; }
    /* ── Mobile overrides ── */
    @media only screen and (max-width:620px) {
      .outer-wrap  { padding:20px 0 !important; }
      .email-body  { width:100% !important; border-radius:0 !important; }
      .hero-pad    { padding:32px 24px 28px !important; }
      .hero-title  { font-size:28px !important; }
      .footer-pad  { padding:24px 20px !important; }
      /* Calendar grid: collapse to single-column stacked list */
      .cal-table   { display:block !important; }
      .cal-head-row{ display:none !important; }
      .cal-body-row{ display:block !important; }
      .cal-day-cell{ display:block !important; width:100% !important; padding:0 !important; }
      .cal-day-inner{ display:block !important; border-radius:10px !important; margin:0 0 10px !important; border:1px solid ${BORDER} !important; }
      .cal-day-label{ display:block !important; border-radius:10px 10px 0 0 !important; }
      .mobile-hide { display:none !important; }
      .content-pad { padding:24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:'Inter',Helvetica,Arial,sans-serif;">
${preview}
<table class="outer-wrap" width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background-color:${BG};padding:40px 16px;">
  <tr>
    <td align="center">
      <table class="email-body" width="620" cellpadding="0" cellspacing="0" role="presentation"
        style="max-width:620px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">

        ${content}

        <!-- FOOTER -->
        <tr>
          <td class="footer-pad" style="background:${BG};border-top:1px solid ${BORDER};padding:28px 36px;text-align:center;">
            <p style="margin:0 0 10px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:${INK};">CiPD 360 &nbsp;&middot;&nbsp; IIIT Delhi</p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 14px;">
              <tr>
                <td style="padding:0 8px;">
                  <a href="${APP_URL}/dashboard" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:500;color:${MUTED};">Dashboard</a>
                </td>
                <td style="font-size:11px;color:${BORDER};">&middot;</td>
                <td style="padding:0 8px;">
                  <a href="${APP_URL}/attendance" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:500;color:${MUTED};">Attendance</a>
                </td>
                <td style="font-size:11px;color:${BORDER};">&middot;</td>
                <td style="padding:0 8px;">
                  <a href="${APP_URL}/feedback" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:500;color:${MUTED};">Feedback</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;color:#AAAAAA;">Automated notification &mdash; do not reply. &copy; 2026 CiPD 360</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── CTA button ────────────────────────────────────────────────────────────────
function ctaButton(label, url) {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr>
      <td style="background:${INK};border-radius:8px;">
        <a href="${url}"
           style="display:inline-block;padding:13px 40px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;border-radius:8px;white-space:nowrap;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

// ── ICS generator ─────────────────────────────────────────────────────────────
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
    return [
      'BEGIN:VEVENT',
      `UID:cipd360-${uid_seed}-${i}@cipd.edu`,
      `DTSTAMP:${toICalDate(new Date().toISOString().split('T')[0], new Date().toTimeString().slice(0, 8))}`,
      `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
      `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Course: ${course}\\nFaculty: ${faculty}\\nVenue: ${venue}`,
      `LOCATION:${venue}`,
      `ORGANIZER;CN=CIPD 360:mailto:${process.env.EMAIL_FROM || 'noreply@cipd.edu'}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].join('\r\n');
  });
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CIPD 360//EN',
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    'X-WR-CALNAME:CIPD 360 Schedule', 'X-WR-TIMEZONE:Asia/Kolkata',
    ...events, 'END:VCALENDAR',
  ].join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WEEKLY SCHEDULE EMAIL — Calendar Grid Design
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWeeklyScheduleEmail(studentEmail, studentName, sessions) {
  if (!sessions || sessions.length === 0) return;

  const firstName = studentName.split(' ')[0] || studentName;
  const count     = sessions.length;

  // Sort by date + time
  const sorted = [...sessions].sort((a, b) =>
    ((a.session_date || '') + (a.start_time || '')).localeCompare(
     (b.session_date || '') + (b.start_time || ''))
  );

  // Next upcoming session
  const now = new Date();
  const nextSession = sorted.find(s => new Date(`${s.session_date}T${s.start_time || '00:00'}`) > now);
  const nextTime    = nextSession?.start_time?.slice(0, 5) ?? null;

  // Group by date (YYYY-MM-DD key)
  const byDate = {};
  sorted.forEach(s => {
    const key = s.session_date || 'unknown';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(s);
  });

  // Build ordered list of unique dates
  const dates = Object.keys(byDate).sort();

  // ── Calendar grid: up to 5 columns ────────────────────────────────────────
  // Each date gets a column. More than 5 dates → wrapped rows of 5.
  // We chunk into rows of up to 5.
  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  const rows = chunk(dates, 5);

  // Colour scale for "busyness" — how many sessions in a day
  function dayBg(count) {
    if (count === 0) return '#FAFAFA';
    if (count <= 2)  return '#F4F4F4';
    if (count <= 4)  return '#EFEFEF';
    return '#E8E8E8';
  }

  // Render one session slot inside a calendar cell
  function sessionSlot(s, isNext) {
    const start  = s.start_time?.slice(0, 5) ?? '—';
    const end    = s.end_time?.slice(0, 5)   ?? '—';
    const title  = s.title || s.courses?.name || '—';
    const venue  = s.venues?.name ?? 'TBA';

    const nextMark = isNext
      ? `<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:8px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#fff;background:${INK};border-radius:3px;display:inline-block;padding:2px 6px;margin-bottom:4px;">NEXT</div><br/>`
      : '';

    return `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#fff;border:1px solid ${BORDER};border-radius:8px;margin-bottom:6px;overflow:hidden;">
        <tr>
          <td style="width:3px;background:${isNext ? INK : '#CCCCCC'};border-radius:8px 0 0 8px;">&nbsp;</td>
          <td style="padding:8px 10px;">
            ${nextMark}
            <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;color:${INK};line-height:1.3;">${title}</p>
            <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;color:${MUTED};">${start} &ndash; ${end}</p>
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;color:#AAAAAA;">${venue}</p>
          </td>
        </tr>
      </table>`;
  }

  // Render full calendar grid rows
  let calendarHtml = '';
  rows.forEach((rowDates, rowIdx) => {
    const colWidth = Math.floor(100 / rowDates.length);

    // Header row: day name + date number
    let headCells = '';
    rowDates.forEach(dateKey => {
      const d   = new Date(dateKey + 'T00:00:00');
      const day = d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
      const num = d.getDate();
      const mon = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
      const isToday = dateKey === new Date().toISOString().split('T')[0];

      headCells += `
        <td class="cal-head-cell" style="width:${colWidth}%;padding:0 4px 8px;text-align:center;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background:${isToday ? INK : '#F0F0F0'};border-radius:8px;padding:8px 6px;text-align:center;">
                <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1.2px;color:${isToday ? 'rgba(255,255,255,0.65)' : MUTED};">${day}</p>
                <p style="margin:0 0 1px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:20px;font-weight:900;color:${isToday ? '#fff' : INK};line-height:1;">${num}</p>
                <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:8px;font-weight:600;color:${isToday ? 'rgba(255,255,255,0.6)' : MUTED};">${mon}</p>
              </td>
            </tr>
          </table>
        </td>`;
    });

    // Body row: sessions under each day
    let bodyCells = '';
    rowDates.forEach((dateKey, colIdx) => {
      const daySessions = byDate[dateKey] || [];
      let slots = daySessions.map(s => {
        const isNext = s === nextSession;
        return sessionSlot(s, isNext);
      }).join('');

      if (slots === '') {
        slots = `<p style="margin:8px 0 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;color:#CCCCCC;text-align:center;">—</p>`;
      }

      // Mobile: show as stacked labeled block
      const d   = new Date(dateKey + 'T00:00:00');
      const dayLabelMobile = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

      bodyCells += `
        <td class="cal-day-cell" style="width:${colWidth}%;padding:0 4px;vertical-align:top;">
          <!-- Mobile label (hidden on desktop via cal-head-row trick, shown on mobile) -->
          <div class="mobile-day-label" style="display:none;">
            <p style="margin:0 0 8px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.8px;">${dayLabelMobile}</p>
          </div>
          ${slots}
        </td>`;
    });

    // Row spacer between chunk rows
    if (rowIdx > 0) {
      calendarHtml += `
      <tr class="cal-body-row"><td colspan="${rowDates.length}" style="height:16px;"></td></tr>`;
    }

    calendarHtml += `
    <tr class="cal-head-row">
      ${headCells}
    </tr>
    <tr class="cal-body-row">
      ${bodyCells}
    </tr>`;
  });

  // ── Build content block ────────────────────────────────────────────────────
  // Compute week range label
  const firstDate = new Date(dates[0] + 'T00:00:00');
  const lastDate  = new Date(dates[dates.length - 1] + 'T00:00:00');
  const weekRange = `${firstDate.toLocaleDateString('en-IN', { day:'numeric', month:'short' })} – ${lastDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;

  const content = `
        <!-- HERO -->
        <tr>
          <td class="hero-pad" style="background:${DARK};padding:40px 40px 36px;">
            <p style="margin:0 0 6px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Weekly Schedule</p>
            <p class="hero-title" style="margin:0 0 6px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Hi ${firstName},</p>
            <p style="margin:0 0 28px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">Here is your class schedule for the week of <strong style="color:rgba(255,255,255,0.75);">${weekRange}</strong>.</p>
            <!-- Stats row -->
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:24px;">
                  <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.35);">Total Classes</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;">${count}</p>
                </td>
                <td style="width:1px;background:rgba(255,255,255,0.1);margin:0 24px;">&nbsp;</td>
                <td style="padding-left:24px;">
                  <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.35);">Starting Next</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;">${nextTime ?? '—'}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CALENDAR GRID -->
        <tr>
          <td style="padding:28px 24px 20px;">
            <table class="cal-table" width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${calendarHtml}
            </table>
          </td>
        </tr>

        <!-- ATTENDANCE NOTE -->
        <tr>
          <td style="padding:0 24px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="background:${BG};border:1px solid ${BORDER};border-radius:8px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.6;">
                    <strong style="color:${SUBTLE};">Attendance reminder:</strong> Maintain 75% attendance across all courses for final exam eligibility. Attendance is auto-recorded via Wi-Fi.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 24px 32px;text-align:center;">
            ${ctaButton('View Full Schedule', `${APP_URL}/dashboard`)}
            <p style="margin:14px 0 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;color:#AAAAAA;">
              A calendar file (.ics) is attached &mdash; import to Google Calendar or Outlook.
            </p>
          </td>
        </tr>`;

  const icsContent = generateICS(sorted, studentName);

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Your weekly schedule — ${weekRange}`,
    html: shell(content, `${count} classes this week. Next class at ${nextTime ?? 'TBA'}.`),
    attachments: [{
      filename: 'CIPD360-Schedule.ics',
      content: icsContent,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DAY-BEFORE REMINDER EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendDayBeforeReminderEmail(studentEmail, studentName, session) {
  const date    = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '—';
  const start   = session.start_time?.slice(0, 5) ?? '—';
  const end     = session.end_time?.slice(0, 5)   ?? '—';
  const course  = session.courses?.name ?? '—';
  const venue   = session.venues?.name  ?? 'TBA';
  const faculty = session.faculty?.users
    ? `${session.faculty.users.first_name} ${session.faculty.users.last_name}`
    : 'TBA';
  const title     = session.title || course;
  const firstName = studentName.split(' ')[0] || studentName;

  const content = `
        <!-- HERO -->
        <tr>
          <td class="hero-pad" style="background:${DARK};padding:40px 40px 36px;">
            <p style="margin:0 0 6px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Class Tomorrow</p>
            <p class="hero-title" style="margin:0 0 8px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Don&rsquo;t forget, ${firstName}.</p>
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);">You have a session scheduled for tomorrow.</p>
          </td>
        </tr>

        <!-- SESSION CARD -->
        <tr>
          <td style="padding:28px 28px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
              <!-- Top rule bar -->
              <tr><td colspan="4" style="height:3px;background:${INK};"></td></tr>
              <tr>
                <td style="padding:22px 24px;">
                  <p style="margin:0 0 4px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">${course}</p>
                  <p style="margin:0 0 20px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;color:${INK};line-height:1.2;">${title}</p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="width:50%;padding-bottom:12px;vertical-align:top;">
                        <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Date</p>
                        <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${INK};">${date}</p>
                      </td>
                      <td style="width:50%;padding-bottom:12px;vertical-align:top;">
                        <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Time</p>
                        <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${INK};">${start} &ndash; ${end}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align:top;">
                        <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Venue</p>
                        <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${INK};">${venue}</p>
                      </td>
                      <td style="vertical-align:top;">
                        <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Faculty</p>
                        <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${INK};">${faculty}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- WIFI NOTE -->
        <tr>
          <td style="padding:0 28px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="background:${BG};border:1px solid ${BORDER};border-radius:8px;">
              <tr>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.6;">
                    <strong style="color:${SUBTLE};">Auto attendance:</strong> Your attendance is recorded via Wi-Fi. Ensure your MAC address is registered before class.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 36px;text-align:center;">
            ${ctaButton('Open Dashboard', `${APP_URL}/dashboard`)}
          </td>
        </tr>`;

  const icsContent = generateICS([session], studentName);

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Class tomorrow: ${title} at ${start}`,
    html: shell(content, `"${title}" starts at ${start} tomorrow at ${venue}.`),
    attachments: [{
      filename: 'CIPD360-ClassReminder.ics',
      content: icsContent,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GENERAL / CUSTOM NOTIFICATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendGeneralNotificationEmail(studentEmail, studentName, title, message, type) {
  const firstName = (studentName || '').split(' ')[0] || 'Student';

  const typeConfig = {
    class_reminder:     { label: 'Class Reminder',     tag: 'Reminder' },
    feedback_reminder:  { label: 'Feedback Reminder',  tag: 'Action Required' },
    schedule_change:    { label: 'Schedule Update',    tag: 'Update' },
    attendance_warning: { label: 'Attendance Warning', tag: 'Warning' },
    general:            { label: 'Announcement',       tag: 'Notice' },
  };
  const cfg = typeConfig[type] || typeConfig.general;

  const content = `
        <!-- HERO -->
        <tr>
          <td class="hero-pad" style="background:${DARK};padding:40px 40px 36px;">
            <p style="margin:0 0 6px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">${cfg.tag}</p>
            <p class="hero-title" style="margin:0 0 8px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Hi, ${firstName}.</p>
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);">You have a new notification from CiPD 360.</p>
          </td>
        </tr>

        <!-- MESSAGE CARD -->
        <tr>
          <td style="padding:28px 28px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
              <tr><td style="height:3px;background:${INK};"></td></tr>
              <tr>
                <td style="padding:20px 22px;">
                  <p style="margin:0 0 8px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:${INK};">${title || cfg.label}</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};line-height:1.7;">${message}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 36px;text-align:center;">
            ${ctaButton('View Dashboard', `${APP_URL}/dashboard`)}
          </td>
        </tr>`;

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `${cfg.label}: ${title || cfg.label} — CiPD 360`,
    html: shell(content, message?.slice(0, 100)),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FEEDBACK AVAILABLE EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendFeedbackAvailableEmail(studentEmail, studentName, session, deadline) {
  const firstName  = (studentName || '').split(' ')[0] || 'Student';
  const course     = session.courses?.name || session.title || '—';
  const date       = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '24 hours';

  const content = `
        <!-- HERO -->
        <tr>
          <td class="hero-pad" style="background:${DARK};padding:40px 40px 36px;">
            <p style="margin:0 0 6px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Feedback Form</p>
            <p class="hero-title" style="margin:0 0 8px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Share your thoughts, ${firstName}.</p>
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);">Your feedback form for a recent session is now live.</p>
          </td>
        </tr>

        <!-- SESSION INFO -->
        <tr>
          <td style="padding:28px 28px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
              <tr><td colspan="4" style="height:3px;background:${INK};"></td></tr>
              <tr>
                <td style="padding:18px 22px;">
                  <p style="margin:0 0 4px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">${course}</p>
                  <p style="margin:0 0 16px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:17px;font-weight:800;color:${INK};">${session.title || course}</p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="width:50%;vertical-align:top;">
                        <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Session Date</p>
                        <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:${INK};">${date}</p>
                      </td>
                      <td style="width:50%;vertical-align:top;">
                        <p style="margin:0 0 2px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Deadline</p>
                        <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;color:${INK};">${deadlineStr}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- NOTE -->
        <tr>
          <td style="padding:0 28px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="background:${BG};border:1px solid ${BORDER};border-radius:8px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.7;">
                    Takes under 30 seconds &mdash; answers are pre-filled with positive defaults. Responses are anonymous and count towards your engagement score.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 36px;text-align:center;">
            ${ctaButton('Submit Feedback', `${APP_URL}/feedback`)}
          </td>
        </tr>`;

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Feedback form ready: ${course} — CiPD 360`,
    html: shell(content, `Feedback for "${course}" is due by ${deadlineStr}. Takes 30 seconds.`),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FEEDBACK REMINDER EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendFeedbackReminderEmail(studentEmail, studentName, session, hoursLeft) {
  const firstName = (studentName || '').split(' ')[0] || 'Student';
  const course    = session.courses?.name || session.title || '—';
  const hrs       = Math.round(hoursLeft);

  const content = `
        <!-- HERO -->
        <tr>
          <td class="hero-pad" style="background:${DARK};padding:40px 40px 36px;">
            <p style="margin:0 0 6px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Deadline Approaching</p>
            <p class="hero-title" style="margin:0 0 8px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Time is running out.</p>
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);">Hi ${firstName}, your feedback for <strong style="color:rgba(255,255,255,0.8);">${course}</strong> closes in <strong style="color:#ffffff;">~${hrs} hour${hrs !== 1 ? 's' : ''}</strong>.</p>
          </td>
        </tr>

        <!-- COUNTDOWN -->
        <tr>
          <td style="padding:32px 28px 16px;text-align:center;">
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
              <tr><td style="height:3px;background:${INK};"></td></tr>
              <tr>
                <td style="padding:28px 48px;text-align:center;background:#FAFAFA;">
                  <p style="margin:0 0 4px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:56px;font-weight:900;color:${INK};line-height:1;">${hrs}</p>
                  <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">hour${hrs !== 1 ? 's' : ''} remaining</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- NOTE -->
        <tr>
          <td style="padding:16px 28px 24px;text-align:center;">
            <p style="margin:0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};line-height:1.7;">
              Takes only 30 seconds. Answers are pre-filled &mdash; just review and submit.
            </p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 36px;text-align:center;">
            ${ctaButton('Submit Now', `${APP_URL}/feedback`)}
            <p style="margin:14px 0 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;color:#AAAAAA;">
              After the deadline you will not be able to submit feedback for this session.
            </p>
          </td>
        </tr>`;

  await transporter.sendMail({
    from: `"CiPD 360" <${process.env.EMAIL_FROM}>`,
    to: studentEmail,
    subject: `Feedback closes in ${hrs}h: ${course} — CiPD 360`,
    html: shell(content, `Your feedback for "${course}" closes in ~${hrs} hours. Just 30 seconds!`),
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
