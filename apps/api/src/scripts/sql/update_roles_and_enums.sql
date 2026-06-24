-- SQL Migration: map legacy role values and guidance to add new enum values
-- WARNING: Review and run on a staging DB first. Backup your DB before applying.

-- 1) Convert legacy 'sales' -> 'sales_person' in any tables that store role strings
-- Replace `user_roles` with your actual table name if different.
UPDATE user_roles SET role = 'sales_person' WHERE role = 'sales';
UPDATE profiles SET role = 'sales_person' WHERE role = 'sales';
UPDATE report_dispatch_configs SET recipient_roles = array_replace(recipient_roles, 'sales', 'sales_person') WHERE array_position(recipient_roles, 'sales') IS NOT NULL;

-- 2) If your DB uses a Postgres ENUM type for roles, add new values.
-- Example: If enum type is named app_role, add new values using ALTER TYPE.
-- NOTE: Postgres allows adding enum values but not removing/renaming backed values easily.
-- Replace 'app_role' with your role enum type name.
-- Add brand roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'brand_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'brand_branch_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_person';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'entity';

-- 3) If you need to update columns constrained to an enum, you can temporarily change column type to text,
-- update values, then cast back to enum. Example below (use with caution):
-- BEGIN;
-- ALTER TABLE user_roles ALTER COLUMN role TYPE text;
-- UPDATE user_roles SET role = 'sales_person' WHERE role = 'sales';
-- ALTER TABLE user_roles ALTER COLUMN role TYPE app_role USING role::app_role;
-- COMMIT;

-- 4) Verify report_dispatch_configs enum/list types
-- If your report settings model restricts recipient roles to ('dealer_admin','sales'), update the column
-- so it accepts the new values (text/enum or modify the enum used).

-- Always test these changes on a non-production environment first.
