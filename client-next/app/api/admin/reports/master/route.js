export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(request) {
  try {
    // ── Run all flat queries in parallel ─────────────────────────────────────
    const [
      { data: sessions,      error: sessErr  },
      { data: feedbackRaw                    },
      { data: courseRows                     },
      { data: facultyRows                    },
      { data: userRows                       },
      { data: venueRows                      },
      { data: sessionTypeRows                },
      { data: sessionSkillRows               },
      { data: skillRows                      },
    ] = await Promise.all([
      supabaseAdmin
        .from('sessions')
        .select('id, title, session_date, start_time, end_time, status, course_id, faculty_id, venue_id, session_type_id')
        .order('session_date', { ascending: true })
        .order('start_time',   { ascending: true }),

      supabaseAdmin
        .from('feedback_responses')
        .select('session_id, rating')
        .not('rating', 'is', null),

      supabaseAdmin.from('courses').select('id, name'),

      supabaseAdmin.from('faculty').select('id, years_experience, designation'),

      supabaseAdmin.from('users').select('id, first_name, last_name'),

      supabaseAdmin.from('venues').select('id, name'),

      supabaseAdmin.from('session_types').select('id, name'),

      supabaseAdmin.from('session_skills').select('session_id, skill_id'),

      supabaseAdmin.from('skills').select('id, name, details'),
    ]);

    if (sessErr) throw sessErr;

    // ── Build lookup maps ─────────────────────────────────────────────────────
    const courseById     = Object.fromEntries((courseRows      || []).map(r => [r.id, r]));
    const facultyById    = Object.fromEntries((facultyRows     || []).map(r => [r.id, r]));
    const userById       = Object.fromEntries((userRows        || []).map(r => [r.id, r]));
    const venueById      = Object.fromEntries((venueRows       || []).map(r => [r.id, r]));
    const sessTypeById   = Object.fromEntries((sessionTypeRows || []).map(r => [r.id, r]));
    const skillById      = Object.fromEntries((skillRows       || []).map(r => [r.id, r]));

    // Skills per session
    const skillNamesBySession = {};
    (sessionSkillRows || []).forEach(ss => {
      if (!skillNamesBySession[ss.session_id]) skillNamesBySession[ss.session_id] = [];
      const sk = skillById[ss.skill_id];
      if (sk) skillNamesBySession[ss.session_id].push(sk.name);
    });

    // Ratings per session
    const ratingsBySession = {};
    (feedbackRaw || []).forEach(r => {
      if (!ratingsBySession[r.session_id]) ratingsBySession[r.session_id] = [];
      ratingsBySession[r.session_id].push(r.rating);
    });
    const avgRatingForSession = (id) => {
      const arr = ratingsBySession[id];
      if (!arr || arr.length === 0) return null;
      return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const expBucket = (yrs) => {
      if (yrs === null || yrs === undefined) return 'Unknown';
      if (typeof yrs === 'string' && yrs.toLowerCase() === 'self') return 'Self';
      const n = Number(yrs);
      if (n < 5)  return '<5';
      if (n < 10) return '5-10';
      if (n < 20) return '10-20';
      if (n < 30) return '20-30';
      if (n < 40) return '30-40';
      return '>40';
    };

    const durationMins = (s) => {
      if (!s.start_time || !s.end_time) return 0;
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    };

    // ── Master rows ───────────────────────────────────────────────────────────
    const masterRows = (sessions || []).map((s, idx) => {
      const faculty      = facultyById[s.faculty_id];
      const user         = faculty ? userById[faculty.id] : null;
      const facultyName  = user ? `${user.first_name} ${user.last_name}` : 'TBA';
      const skills       = (skillNamesBySession[s.id] || []).join(', ');

      return {
        row:           idx + 1,
        date:          s.session_date,
        month:         s.session_date ? s.session_date.slice(0, 7) : '—',
        domain:        courseById[s.course_id]?.name     || '—',
        category:      '—',
        title:         s.title                           || '—',
        instructor:    facultyName,
        experience:    faculty?.years_experience         ?? null,
        exp_bucket:    expBucket(faculty?.years_experience),
        session_type:  sessTypeById[s.session_type_id]?.name || '—',
        venue:         venueById[s.venue_id]?.name       || '—',
        duration_mins: durationMins(s),
        skills,
        avg_rating:    avgRatingForSession(s.id),
        status:        s.status,
        session_id:    s.id,
      };
    });

    // ── 5. Sessions & hours per DOMAIN ────────────────────────────────────────
    const domainMap = {};
    masterRows.forEach(r => {
      const d = r.domain;
      if (!domainMap[d]) domainMap[d] = { domain: d, sessions: 0, completed: 0, hours: 0, ratings: [] };
      domainMap[d].sessions  += 1;
      domainMap[d].hours     += r.duration_mins;
      if (r.status === 'completed') domainMap[d].completed += 1;
      if (r.avg_rating !== null) domainMap[d].ratings.push(r.avg_rating);
    });
    const domainAnalytics = Object.values(domainMap)
      .map(d => ({
        domain:     d.domain,
        sessions:   d.sessions,
        completed:  d.completed,
        hours:      parseFloat((d.hours / 60).toFixed(1)),
        avg_rating: d.ratings.length > 0
          ? parseFloat((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(1))
          : null,
      }))
      .filter(d => d.domain !== '—')
      .sort((a, b) => b.sessions - a.sessions);

    // ── 6. Sessions per MONTH (timeline) ─────────────────────────────────────
    const monthMap = {};
    masterRows.forEach(r => {
      if (!r.date) return;
      const m = r.month;
      if (!monthMap[m]) monthMap[m] = { month: m, sessions: 0, completed: 0, hours: 0 };
      monthMap[m].sessions  += 1;
      monthMap[m].hours     += r.duration_mins;
      if (r.status === 'completed') monthMap[m].completed += 1;
    });
    const monthlyTimeline = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        hours: parseFloat((m.hours / 60).toFixed(1)),
        label: new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      }));

    // ── 7. Session type distribution ─────────────────────────────────────────
    const typeMap = {};
    masterRows.forEach(r => {
      const t = r.session_type;
      if (!typeMap[t]) typeMap[t] = { type: t, sessions: 0, hours: 0 };
      typeMap[t].sessions += 1;
      typeMap[t].hours    += r.duration_mins;
    });
    const sessionTypeChart = Object.values(typeMap)
      .filter(t => t.type !== '—')
      .sort((a, b) => b.sessions - a.sessions)
      .map(t => ({ ...t, hours: parseFloat((t.hours / 60).toFixed(1)) }));

    // ── 8. Instructor load ────────────────────────────────────────────────────
    const instructorMap = {};
    masterRows.forEach(r => {
      const key = r.instructor;
      if (!instructorMap[key]) {
        instructorMap[key] = {
          name:          r.instructor,
          experience:    r.experience,
          exp_bucket:    r.exp_bucket,
          sessions:      0,
          total_minutes: 0,
          completed:     0,
          domains:       new Set(),
          ratings:       [],
        };
      }
      instructorMap[key].sessions      += 1;
      instructorMap[key].total_minutes += r.duration_mins;
      if (r.status === 'completed') instructorMap[key].completed += 1;
      if (r.domain !== '—') instructorMap[key].domains.add(r.domain);
      if (r.avg_rating !== null) instructorMap[key].ratings.push(r.avg_rating);
    });
    const instructors = Object.values(instructorMap).map(i => ({
      name:          i.name,
      experience:    i.experience,
      exp_bucket:    i.exp_bucket,
      sessions:      i.sessions,
      completed:     i.completed,
      total_minutes: i.total_minutes,
      hours:         parseFloat((i.total_minutes / 60).toFixed(1)),
      domains:       [...i.domains],
      avg_rating:    i.ratings.length > 0
        ? parseFloat((i.ratings.reduce((a, b) => a + b, 0) / i.ratings.length).toFixed(1))
        : null,
    })).sort((a, b) => b.total_minutes - a.total_minutes);

    // ── 9. Rating timeline ────────────────────────────────────────────────────
    const ratingTimeline = monthlyTimeline.map(m => {
      const monthRows = masterRows.filter(r => r.month === m.month && r.avg_rating !== null);
      const avg = monthRows.length > 0
        ? parseFloat((monthRows.reduce((a, r) => a + r.avg_rating, 0) / monthRows.length).toFixed(1))
        : null;
      return { ...m, avg_rating: avg };
    });

    // ── 10. Experience pivot ──────────────────────────────────────────────────
    const expPivot = {};
    masterRows.forEach(r => {
      const bucket = r.exp_bucket;
      if (!expPivot[bucket]) expPivot[bucket] = { bucket, total_minutes: 0, sessions: 0 };
      expPivot[bucket].total_minutes += r.duration_mins;
      expPivot[bucket].sessions      += 1;
    });
    const EXP_ORDER = ['<5', '5-10', '10-20', '20-30', '30-40', '>40', 'Self', 'Unknown'];
    const experiencePivot = EXP_ORDER.filter(b => expPivot[b]).map(b => expPivot[b]);

    // ── 11. Skills coverage matrix ────────────────────────────────────────────
    const coveredSkillIds    = new Set((sessionSkillRows || []).map(ss => ss.skill_id));
    const sessionDatesBySkill = {};
    (sessionSkillRows || []).forEach(ss => {
      if (!sessionDatesBySkill[ss.skill_id]) sessionDatesBySkill[ss.skill_id] = [];
      const session = (sessions || []).find(s => s.id === ss.session_id);
      if (session?.session_date) sessionDatesBySkill[ss.skill_id].push(session.session_date);
    });
    const skillsCoverage = (skillRows || []).map(sk => ({
      skill_id:      sk.id,
      skill_name:    sk.name,
      details:       sk.details || '—',
      category:      '—',
      domain:        '—',
      covered:       coveredSkillIds.has(sk.id),
      session_dates: (sessionDatesBySkill[sk.id] || []).sort(),
    }));

    // ── 12. Summary stats ─────────────────────────────────────────────────────
    const completedSessions = masterRows.filter(r => r.status === 'completed').length;
    const totalMinutes      = masterRows.reduce((s, r) => s + r.duration_mins, 0);
    const uniqueInstructors = new Set(masterRows.map(r => r.instructor).filter(n => n !== 'TBA')).size;
    const uniqueDomains     = new Set(masterRows.map(r => r.domain).filter(d => d !== '—')).size;
    const allRatings        = masterRows.filter(r => r.avg_rating !== null).map(r => r.avg_rating);
    const overallAvgRating  = allRatings.length > 0
      ? parseFloat((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1))
      : null;

    return NextResponse.json({
      summary: {
        total_sessions:    masterRows.length,
        completed_sessions: completedSessions,
        total_minutes:     totalMinutes,
        unique_instructors: uniqueInstructors,
        unique_domains:    uniqueDomains,
        skills_covered:    skillsCoverage.filter(s => s.covered).length,
        skills_total:      skillsCoverage.length,
        overall_avg_rating: overallAvgRating,
      },
      masterRows,
      domainAnalytics,
      monthlyTimeline,
      ratingTimeline,
      sessionTypeChart,
      experiencePivot,
      skillsCoverage,
      instructors,
    });

  } catch (error) {
    console.error('Master Report API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
