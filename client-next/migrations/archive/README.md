# Archived SQL (historical – DO NOT RE-RUN)

These scripts were applied by hand, mostly through the Supabase SQL editor, before the schema was managed by
`npm run migrate`. Several use Supabase roles (`anon`, `authenticated`, `service_role`) that do not exist on the
college VM, and several hard-code the `july` schema. They are kept only as a record of how the schema evolved.

The current structure is defined by `migrations/cohort/0001_baseline.sql` plus later numbered migrations.
