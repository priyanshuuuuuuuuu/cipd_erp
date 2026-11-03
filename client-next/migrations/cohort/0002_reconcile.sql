-- 0002_reconcile: bring the three pre-existing cohorts (public, july, junedecember2026) to the
-- same structure as a freshly provisioned cohort. Every step is guarded, so it is a no-op on a new
-- cohort and safe to re-run. It NEVER deletes or rewrites cohort data, except:
--   * orphan rows are MOVED (not deleted) to _orphans_<table> before a new FK is added (non-legacy cohorts only);
--   * `july.wifi_snapshots` is dropped only if it is empty.
-- Placeholders ({{schema}}, {{schema_literal}}, {{cohort_id}}) are substituted by the runner.

-- 1. july.wifi_snapshots: empty, unused clone. (public.wifi_snapshots is never touched.)
DO $$
DECLARE v_schema text := {{schema_literal}}; n bigint;
BEGIN
  IF v_schema = 'july' AND to_regclass(format('%I.wifi_snapshots', v_schema)) IS NOT NULL THEN
    EXECUTE format('SELECT count(*) FROM %I.wifi_snapshots', v_schema) INTO n;
    IF n = 0 THEN
      EXECUTE format('DROP TABLE %I.wifi_snapshots', v_schema);
      RAISE NOTICE '%: dropped empty wifi_snapshots', v_schema;
    ELSE
      RAISE NOTICE '%: wifi_snapshots has % rows, left untouched', v_schema, n;
    END IF;
  END IF;
END $$;

-- 2. Own sequences. Clones made with CREATE TABLE ... LIKE shared the sequence of the source schema.
DO $$
DECLARE
  v_schema text := {{schema_literal}};
  r record; v_seq text; v_next bigint;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col
      FROM pg_attrdef d
      JOIN pg_class c ON c.oid = d.adrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
      JOIN pg_depend dep ON dep.objid = d.oid
                        AND dep.classid = 'pg_attrdef'::regclass
                        AND dep.refclassid = 'pg_class'::regclass
      JOIN pg_class s ON s.oid = dep.refobjid AND s.relkind = 'S'
     WHERE c.relnamespace = v_schema::regnamespace
       AND s.relnamespace <> c.relnamespace
  LOOP
    v_seq := r.tbl || '_' || r.col || '_seq';
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I.%I OWNED BY %I.%I.%I', v_schema, v_seq, v_schema, r.tbl, r.col);
    EXECUTE format('SELECT COALESCE(max(%I), 0) + 1 FROM %I.%I', r.col, v_schema, r.tbl) INTO v_next;
    PERFORM setval(format('%I.%I', v_schema, v_seq), v_next, false);  -- next value is exactly max+1
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT nextval(%L)',
                   v_schema, r.tbl, r.col, format('%I.%I', v_schema, v_seq));
    RAISE NOTICE '%: %.% now uses its own sequence (next = %)', v_schema, r.tbl, r.col, v_next;
  END LOOP;
END $$;

-- 3. Missing foreign keys (non-legacy cohorts only). Legacy archived cohorts keep their data exactly as it is.
DO $$
DECLARE
  v_schema text := {{schema_literal}};
  v_legacy boolean;
  r record; v_orphans bigint;
BEGIN
  SELECT is_legacy INTO v_legacy FROM core.cohorts WHERE schema_name = v_schema;
  IF COALESCE(v_legacy, false) THEN
    RAISE NOTICE '%: legacy cohort, FK reconcile skipped', v_schema;
    RETURN;
  END IF;

  FOR r IN SELECT * FROM (VALUES
    ('attendance_ping_logs',     'attendance_ping_logs_session_id_fkey',          'session_id',  'sessions',   'id', 'CASCADE'),
    ('attendance_ping_logs',     'attendance_ping_logs_student_id_fkey',          'student_id',  'students',   'id', 'CASCADE'),
    ('google_tokens',            'google_tokens_user_id_fkey',                    'user_id',     'users',      'id', 'CASCADE'),
    ('leave_requests',           'leave_requests_reviewed_by_fkey',               'reviewed_by', 'users',      'id', 'SET NULL'),
    ('leave_requests',           'leave_requests_session_id_fkey',                'session_id',  'sessions',   'id', 'SET NULL'),
    ('leave_requests',           'leave_requests_student_id_fkey',                'student_id',  'students',   'id', 'CASCADE'),
    ('session_skills',           'session_skills_session_id_fkey',                'session_id',  'sessions',   'id', 'CASCADE'),
    ('session_skills',           'session_skills_skill_id_fkey',                  'skill_id',    'skills',     'id', 'CASCADE'),
    ('sessions',                 'sessions_category_id_fkey',                     'category_id', 'categories', 'id', 'SET NULL'),
    ('student_attendance_marks', 'student_attendance_marks_course_id_fkey',       'course_id',   'courses',    'id', 'SET NULL'),
    ('student_attendance_marks', 'student_attendance_marks_session_id_fkey',      'session_id',  'sessions',   'id', 'SET NULL'),
    ('student_attendance_marks', 'student_attendance_marks_student_id_fkey',      'student_id',  'students',   'id', 'CASCADE'),
    ('student_course_attendance','student_course_attendance_course_id_fkey',      'course_id',   'courses',    'id', 'CASCADE'),
    ('student_course_attendance','student_course_attendance_student_id_fkey',     'student_id',  'students',   'id', 'CASCADE')
  ) AS t(tbl, conname, col, reftbl, refcol, ondelete)
  LOOP
    CONTINUE WHEN to_regclass(format('%I.%I', v_schema, r.tbl)) IS NULL
               OR to_regclass(format('%I.%I', v_schema, r.reftbl)) IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = r.conname AND conrelid = format('%I.%I', v_schema, r.tbl)::regclass);

    EXECUTE format(
      'SELECT count(*) FROM %1$I.%2$I t WHERE t.%3$I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM %1$I.%4$I p WHERE p.%5$I = t.%3$I)',
      v_schema, r.tbl, r.col, r.reftbl, r.refcol) INTO v_orphans;

    IF v_orphans > 0 THEN
      EXECUTE format('CREATE TABLE IF NOT EXISTS %1$I.%2$I (LIKE %1$I.%3$I)', v_schema, '_orphans_' || r.tbl, r.tbl);
      EXECUTE format(
        'WITH moved AS (
           DELETE FROM %1$I.%2$I t WHERE t.%3$I IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM %1$I.%4$I p WHERE p.%5$I = t.%3$I)
           RETURNING t.*)
         INSERT INTO %1$I.%6$I SELECT * FROM moved',
        v_schema, r.tbl, r.col, r.reftbl, r.refcol, '_orphans_' || r.tbl);
      RAISE NOTICE '%: moved % orphan row(s) of % to _orphans_%', v_schema, v_orphans, r.tbl, r.tbl;
    END IF;

    EXECUTE format(
      'ALTER TABLE %1$I.%2$I ADD CONSTRAINT %3$I FOREIGN KEY (%4$I) REFERENCES %1$I.%5$I (%6$I) ON DELETE %7$s',
      v_schema, r.tbl, r.conname, r.col, r.reftbl, r.refcol, r.ondelete);
  END LOOP;
END $$;

-- 4. Auto-enroll existing students when a course is created (public has it; july and later cohorts did not).
--    The legacy `public` cohort already has its own trigger/function and is left untouched.
DO $outer$
DECLARE v_schema text := {{schema_literal}};
BEGIN
  IF v_schema = 'public' OR to_regclass(format('%I.courses', v_schema)) IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION %1$I.auto_enroll_all_in_new_course()
    RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN
      INSERT INTO %1$I.course_enrollments (student_id, course_id, enrolled_at)
      SELECT s.id, NEW.id, now() FROM %1$I.students s
      ON CONFLICT (course_id, student_id) DO NOTHING;
      RETURN NEW;
    END;
    $body$$f$, v_schema);

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'trg_auto_enroll_course'
                    AND tgrelid = format('%I.courses', v_schema)::regclass) THEN
    EXECUTE format(
      'CREATE TRIGGER trg_auto_enroll_course AFTER INSERT ON %1$I.courses
         FOR EACH ROW EXECUTE FUNCTION %1$I.auto_enroll_all_in_new_course()', v_schema);
  END IF;
END
$outer$;

-- 5. Row-level security: enabled with zero policies on legacy tables. Access control lives in the app.
DO $$
DECLARE v_schema text := {{schema_literal}}; r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c
            WHERE c.relnamespace = v_schema::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
              AND NOT (v_schema = 'public' AND c.relname = 'wifi_snapshots')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', v_schema, r.relname);
  END LOOP;
END $$;
