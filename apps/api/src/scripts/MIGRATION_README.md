Migration notes: Roles & Location.brands

1) Location.brands (MongoDB)
- Run the included script to normalize existing `locations` documents so `brands` is always
  an array of objects with the shape `{ name: string, is_active: boolean }`.

  From the `apps/api` folder run:

  ```bash
  npx tsx src/scripts/migrate_location_brands.ts
  ```

2) Role + enum updates (Postgres / Supabase)
- If you use Postgres/Supabase for application data (the `apiDbQuery` layer), you may need to
  update existing role values and adjust enum types.
- See `src/scripts/sql/update_roles_and_enums.sql` for safe UPDATE statements and guidance.

3) Recommended procedure
- Backup DBs (both Mongo and Postgres) before applying migrations.
- Run the Mongo migration locally or against staging first.
- Run the SQL statements in a staging Postgres database and verify your application.
- Deploy to production only after validation.

If you want, I can also:
- Add a small npm script to the `apps/api/package.json` to run the migration easily.
- Generate a one-off Supabase migration file for your CI if you share the enum type names.
