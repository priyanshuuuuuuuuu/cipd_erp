import { connection } from '@/lib/db';
import { HttpError, qid } from '@/lib/sql-ident';

const MAX_COURSES_PER_REQUEST = 50;
const MAX_PROGRAM_NAME = 120;
const MAX_COURSE_NAME = 200;
const MAX_COURSE_CODE = 40;
const MAX_DESCRIPTION = 5000;

function normalizeProgramName(value) {
  const name = String(value || '').trim();
  if (!name) throw new HttpError(400, 'Program name is required.');
  if (name.length > MAX_PROGRAM_NAME) throw new HttpError(400, `Program name cannot exceed ${MAX_PROGRAM_NAME} characters.`);
  return name;
}

function normalizeCourses(input, { required = true } = {}) {
  if (!Array.isArray(input)) {
    if (!required && input == null) return [];
    throw new HttpError(400, 'courses must be an array.');
  }
  if (required && input.length === 0) throw new HttpError(400, 'Add at least one course to the program.');
  if (input.length > MAX_COURSES_PER_REQUEST) {
    throw new HttpError(400, `A maximum of ${MAX_COURSES_PER_REQUEST} courses can be added at once.`);
  }

  const seenCodes = new Set();
  return input.map((raw, index) => {
    const name = String(raw?.name || '').trim();
    const code = String(raw?.code || '').trim().toUpperCase();
    const description = String(raw?.description || '').trim();
    if (!name) throw new HttpError(400, `Course ${index + 1}: name is required.`);
    if (!code) throw new HttpError(400, `Course ${index + 1}: code is required.`);
    if (name.length > MAX_COURSE_NAME) throw new HttpError(400, `Course ${index + 1}: name is too long.`);
    if (code.length > MAX_COURSE_CODE) throw new HttpError(400, `Course ${index + 1}: code is too long.`);
    if (description.length > MAX_DESCRIPTION) throw new HttpError(400, `Course ${index + 1}: description is too long.`);
    if (seenCodes.has(code)) throw new HttpError(409, `Course code "${code}" appears more than once.`);
    seenCodes.add(code);
    return { name, code, description: description || null };
  });
}

function requireRunningCohort(cohort) {
  if (!cohort) throw new HttpError(409, 'Select a cohort before managing courses.');
  if (cohort.status !== 'running') throw new HttpError(409, 'Courses can only be changed in a running cohort.');
}

async function insertCourses(tx, cohort, programId, courses) {
  const schema = qid(cohort.schema_name || cohort.schema);
  const created = [];
  for (const course of courses) {
    try {
      const [row] = await tx.unsafe(
        `INSERT INTO ${schema}.courses (name, code, description, program_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, code, description, program_id, created_at`,
        [course.name, course.code, course.description, programId]
      );
      created.push(row);
    } catch (err) {
      if (err?.code === '23505') throw new HttpError(409, `Course code "${course.code}" already exists in this cohort.`);
      throw err;
    }
  }
  return created;
}

export async function listPrograms() {
  return connection`SELECT id, name FROM core.programs ORDER BY lower(name), id`;
}

/** Programs are global; nested courses belong only to the resolved cohort. */
export async function listProgramCatalog(cohort) {
  const programs = await listPrograms();
  if (!cohort) return { programs: programs.map((p) => ({ ...p, courses: [] })), unassignedCourses: [] };

  const schema = qid(cohort.schema_name || cohort.schema);
  const courses = await connection.unsafe(
    `SELECT id, name, code, description, program_id, created_at
       FROM ${schema}.courses
      ORDER BY lower(name), code NULLS LAST`
  );
  const byProgram = new Map(programs.map((p) => [Number(p.id), { ...p, courses: [] }]));
  const unassignedCourses = [];
  for (const course of courses) {
    const program = course.program_id == null ? null : byProgram.get(Number(course.program_id));
    if (program) program.courses.push(course);
    else unassignedCourses.push(course);
  }
  return { programs: [...byProgram.values()], unassignedCourses };
}

/** Create one global program and its first cohort-local courses atomically. */
export async function createProgramWithCourses(input, cohort) {
  requireRunningCohort(cohort);
  const { name, courses } = input || {};
  const programName = normalizeProgramName(name);
  const normalizedCourses = normalizeCourses(courses);

  return connection.begin(async (tx) => {
    // Serialise case-insensitive name checks without requiring a potentially
    // disruptive new index on installations that already contain programs.
    await tx`SELECT pg_advisory_xact_lock(hashtext('core.programs:name'))`;
    const [existing] = await tx`SELECT id FROM core.programs WHERE lower(name) = ${programName.toLowerCase()}`;
    if (existing) throw new HttpError(409, `A program named "${programName}" already exists.`);

    const [program] = await tx`
      INSERT INTO core.programs (name) VALUES (${programName})
      RETURNING id, name`;
    const createdCourses = await insertCourses(tx, cohort, program.id, normalizedCourses);
    return { ...program, courses: createdCourses };
  });
}

/** Rename a (global) program. */
export async function updateProgram(programId, input) {
  const id = Number(programId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid program id.');
  const name = normalizeProgramName(input?.name);

  return connection.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('core.programs:name'))`;
    const [clash] = await tx`SELECT id FROM core.programs WHERE lower(name) = ${name.toLowerCase()} AND id <> ${id}`;
    if (clash) throw new HttpError(409, `A program named "${name}" already exists.`);
    const [program] = await tx`UPDATE core.programs SET name = ${name} WHERE id = ${id} RETURNING id, name`;
    if (!program) throw new HttpError(404, 'Program not found.');
    return program;
  });
}

/** Edit a course's name, code and description in the resolved cohort. */
export async function updateCourse(courseId, input, cohort) {
  requireRunningCohort(cohort);
  const [course] = normalizeCourses([{ name: input?.name, code: input?.code, description: input?.description }]);
  const schema = qid(cohort.schema_name || cohort.schema);
  try {
    const rows = await connection.unsafe(
      `UPDATE ${schema}.courses SET name = $1, code = $2, description = $3
        WHERE id = $4
        RETURNING id, name, code, description, program_id, created_at`,
      [course.name, course.code, course.description, courseId]
    );
    if (!rows.length) throw new HttpError(404, 'Course not found.');
    return rows[0];
  } catch (err) {
    if (err?.code === '23505') throw new HttpError(409, `Course code "${course.code}" already exists in this cohort.`);
    throw err;
  }
}

/** Add one or more courses to an existing program in the resolved cohort. */
export async function addCoursesToProgram(programId, courses, cohort) {
  requireRunningCohort(cohort);
  const id = Number(programId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid program id.');
  const normalizedCourses = normalizeCourses(courses);

  return connection.begin(async (tx) => {
    const [program] = await tx`SELECT id, name FROM core.programs WHERE id = ${id}`;
    if (!program) throw new HttpError(404, 'Program not found.');
    const createdCourses = await insertCourses(tx, cohort, program.id, normalizedCourses);
    return { program, courses: createdCourses };
  });
}
