-- 0005_must_change_password: accounts created with a shared default password must set their own on first login.
-- Cleared by setPassword() (lib/accounts.js). Existing accounts are unaffected (default false).
ALTER TABLE core.accounts ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
