# Database Migrations

This directory contains all Supabase SQL migrations for the CIPD ERP system.

## Naming Convention

```
NNN_description.sql
```

Where `NNN` is a zero-padded sequential number:

```
001_initial_schema.sql
002_add_attendance_points.sql
003_add_leave_requests.sql
...
```

## Running Migrations

Migrations are run manually against the Supabase project via the Supabase SQL Editor
or using the Supabase CLI:

```bash
# Using Supabase CLI (if configured)
supabase db push

# Or manually: copy the SQL and run in the Supabase Dashboard SQL editor
# https://supabase.com/dashboard/project/<your-project>/sql
```

## Adding a New Migration

1. Create a new file: `NNN_short_description.sql` (next number in sequence)
2. Write only **idempotent** SQL where possible (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.)
3. Test locally against a dev/staging Supabase project first
4. Commit the file and open a PR — **never run untested migrations on production**

## Migration History

| File | Description | Date |
|------|-------------|------|
| *(migrations will be listed here as they are added)* | | |

## Archive

One-off data fix scripts (`fix_data.mjs`, `fill_empty.mjs`, etc.) that were run once
during development are stored in [`archive/`](./archive/) for reference only.
They should **not** be re-run.
