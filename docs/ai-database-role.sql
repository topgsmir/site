-- Run as a PostgreSQL administrator after applying the application migration.
-- Replace the sample password through your secret manager; never commit it.
CREATE ROLE topgsm_ai_reader LOGIN NOINHERIT PASSWORD 'replace-through-secret-manager';
ALTER ROLE topgsm_ai_reader SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE topgsm TO topgsm_ai_reader;
GRANT USAGE ON SCHEMA ai_reporting TO topgsm_ai_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ai_reporting TO topgsm_ai_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM topgsm_ai_reader;
REVOKE CREATE ON SCHEMA public FROM topgsm_ai_reader;

-- Run this after future migrations add another reporting view:
-- GRANT SELECT ON ALL TABLES IN SCHEMA ai_reporting TO topgsm_ai_reader;

-- Deployment verification: the first query must be true and the second false.
SELECT has_table_privilege('topgsm_ai_reader', 'ai_reporting.daily_sales', 'SELECT');
SELECT has_table_privilege('topgsm_ai_reader', 'public.users', 'SELECT');
