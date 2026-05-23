-- This migration registers the previously applied migrations in the schema_migrations table
-- and serves as a synchronization point for migrations that were applied outside of the CLI

-- Register all previously applied migrations
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20260503085602', '3feb3b9e-232a-4666-8439-7fca767e63ea'),
  ('20260503085613', '6f645715-78f0-4ae2-a095-21dc335ba344'),
  ('20260503091235', 'f6085da3-9de6-46c2-9f0f-00e175c09b2f'),
  ('20260504212238', 'd273fa75-d546-4c8c-b608-b37fcdedf593'),
  ('20260504212258', 'bdb36ed5-d167-498d-8ef1-7625ca8b9f55'),
  ('20260504212327', '3ba4b60e-334e-4472-abfa-85ae775ca00b'),
  ('20260508114129', 'd9db175c-99fc-41dc-913d-a4459275f217')
ON CONFLICT (version) DO NOTHING;
