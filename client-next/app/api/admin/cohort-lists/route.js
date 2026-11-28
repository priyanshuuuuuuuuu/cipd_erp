export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { venues, sessionTypes, skills, categories, courses, sessions, sessionSkills } from '@/drizzle/schema';
import { asc, count, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// GET /api/admin/cohort-lists: the cohort-specific lookup lists (venues, class types, skills, categories) with usage counts,
// for the "Cohort settings" section of /admin/programs.
async function handler() {
  try {
    const usage = async (col, table) => {
      const rows = await db.select({ id: col, n: count() }).from(table).groupBy(col);
      return Object.fromEntries(rows.filter(r => r.id).map(r => [r.id, Number(r.n)]));
    };
    const [venueRows, typeRows, skillRows, categoryRows, courseRows, venueUse, typeUse, skillUse, categoryUse] = await Promise.all([
      db.select({ id: venues.id, name: venues.name, building: venues.building, router_bssid: venues.routerBssid, is_active: venues.isActive }).from(venues).orderBy(asc(venues.name)),
      db.select({ id: sessionTypes.id, name: sessionTypes.name }).from(sessionTypes).orderBy(asc(sessionTypes.name)),
      db.select({ id: skills.id, name: skills.name, details: skills.details, category_id: skills.categoryId, category_name: categories.name })
        .from(skills).leftJoin(categories, eq(skills.categoryId, categories.id)).orderBy(asc(skills.name)),
      db.select({ id: categories.id, name: categories.name, course_id: categories.courseId, course_name: courses.name })
        .from(categories).leftJoin(courses, eq(categories.courseId, courses.id)).orderBy(asc(categories.name)),
      db.select({ id: courses.id, name: courses.name }).from(courses).orderBy(asc(courses.name)),
      usage(sessions.venueId, sessions),
      usage(sessions.sessionTypeId, sessions),
      usage(sessionSkills.skillId, sessionSkills),
      usage(sessions.categoryId, sessions),
    ]);
    const skillsPerCategory = {};
    for (const s of skillRows) if (s.category_id) skillsPerCategory[s.category_id] = (skillsPerCategory[s.category_id] || 0) + 1;

    return NextResponse.json({
      venues: venueRows.map(v => ({ ...v, used_by: venueUse[v.id] || 0 })),
      sessionTypes: typeRows.map(t => ({ ...t, used_by: typeUse[t.id] || 0 })),
      skills: skillRows.map(s => ({ ...s, used_by: skillUse[s.id] || 0 })),
      categories: categoryRows.map(c => ({ ...c, used_by: categoryUse[c.id] || 0, skill_count: skillsPerCategory[c.id] || 0 })),
      courses: courseRows,
    });
  } catch (err) {
    console.error('cohort-lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
