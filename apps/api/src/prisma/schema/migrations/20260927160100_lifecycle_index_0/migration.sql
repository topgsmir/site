CREATE INDEX CONCURRENTLY users_account_status_created_at_idx ON users(account_status, created_at DESC, id DESC);
